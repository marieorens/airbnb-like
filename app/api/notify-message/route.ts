import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isMailerConfigured, newMessageEmail, sendEmail } from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Notification par email a la reception d'un message.
 *
 * Appelee par le web et par le mobile juste apres l'envoi. L'identite vient du
 * jeton Supabase, jamais du corps : on verifie que l'appelant est bien
 * l'expediteur du message annonce.
 *
 * Tant que le push n'existe pas, c'est le seul canal qui previent un
 * destinataire dont l'application est fermee.
 */

/** Au-dela de ce delai, on considere que la conversation n'est plus active. */
const ACTIVE_CONVERSATION_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ message: "Authentification requise." }, { status: 401 });
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ message: "Session invalide." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Requete invalide." }, { status: 400 });
  }

  const messageId = body.messageId;
  if (typeof messageId !== "string") {
    return NextResponse.json({ message: "Identifiant de message manquant." }, { status: 400 });
  }

  // Sans configuration SMTP, on ne fait pas echouer l'envoi du message.
  if (!isMailerConfigured()) {
    return NextResponse.json({ ok: true, skipped: "mailer-not-configured" });
  }

  const admin = createAdminClient();

  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("id", messageId)
    .single();

  if (messageError || !message) {
    return NextResponse.json({ message: "Message introuvable." }, { status: 404 });
  }

  if (message.sender_id !== user.id) {
    return NextResponse.json({ message: "Message non autorise." }, { status: 403 });
  }

  // Les types generes ne decrivent pas les relations imbriquees : meme
  // conversion que dans les services existants.
  type ConversationRow = {
    id: string;
    guest_id: string;
    host_id: string;
    listings?: { title: string } | null;
  };

  const { data: conversationData, error: conversationError } = await admin
    .from("conversations")
    .select("id, guest_id, host_id, listings(title)")
    .eq("id", message.conversation_id)
    .single();

  const conversation = conversationData as unknown as ConversationRow | null;

  if (conversationError || !conversation) {
    return NextResponse.json({ message: "Conversation introuvable." }, { status: 404 });
  }

  const recipientId =
    conversation.host_id === user.id ? conversation.guest_id : conversation.host_id;

  // Conversation active : les deux echangent en direct, un email serait du bruit.
  const { data: previous } = await admin
    .from("messages")
    .select("created_at")
    .eq("conversation_id", message.conversation_id)
    .lt("created_at", message.created_at)
    .order("created_at", { ascending: false })
    .limit(1);

  const previousAt = previous?.[0]?.created_at;
  if (
    previousAt &&
    new Date(message.created_at).getTime() - new Date(previousAt).getTime() <
      ACTIVE_CONVERSATION_WINDOW_MS
  ) {
    return NextResponse.json({ ok: true, skipped: "conversation-active" });
  }

  const [{ data: recipient }, { data: sender }] = await Promise.all([
    admin.from("profiles").select("email, full_name").eq("id", recipientId).single(),
    admin.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (!recipient?.email) {
    return NextResponse.json({ ok: true, skipped: "no-recipient-email" });
  }

  const origin = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(/\/+$/, "");

  const email = newMessageEmail({
    senderName: sender?.full_name || "Un membre VacationHub",
    listingTitle: conversation.listings?.title ?? "votre annonce",
    body: message.body,
    conversationUrl: `${origin}/messages?c=${conversation.id}`,
  });

  try {
    await sendEmail({ to: recipient.email, ...email });
  } catch (error) {
    // L'echec d'un email ne doit jamais remonter jusqu'a l'utilisateur :
    // son message est deja parti.
    console.error("notify-message", error);
    return NextResponse.json({ ok: false, skipped: "send-failed" });
  }

  return NextResponse.json({ ok: true, notified: true });
}
