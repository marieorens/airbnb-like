import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isMailerConfigured, newMessageEmail, sendEmail } from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import { localizePath } from "@/i18n/routing";
import { parseTranslations } from "@/utils/listingText";

/**
 * Notification par email a la reception d'un message.
 *
 * Appelee par le web et par le mobile juste apres l'envoi. L'identite vient du
 * jeton Supabase, jamais du corps : on verifie que l'appelant est bien
 * l'expediteur du message annonce.
 *
 * Chaque message notifie, sans regroupement ni delai : choix produit assume.
 *
 * Tant que le push n'existe pas, c'est le seul canal qui previent un
 * destinataire dont l'application est fermee.
 */

/**
 * Controle de configuration.
 *
 * Ne renvoie que des booleens, jamais une valeur : sans cela, un envoi qui
 * echoue en silence est impossible a diagnostiquer depuis l'exterieur.
 */
/**
 * Journal de l'envoi, visible dans le terminal en local et dans les logs de
 * fonction chez Vercel. Prefixe unique pour pouvoir filtrer d'un coup d'oeil.
 */
const log = (...parts: unknown[]) => console.log("[notify-message]", ...parts);

/** On ne journalise jamais une adresse complete. */
const maskEmail = (email: string) => email.replace(/^(.{1,2})[^@]*(@.*)$/, "$1***$2");

export async function GET() {
  return NextResponse.json({
    mailerConfigured: isMailerConfigured(),
    serverUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SERVER_URL),
  });
}

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
    log("refuse : session invalide");
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
    log("refuse : identifiant de message manquant");
    return NextResponse.json({ message: "Identifiant de message manquant." }, { status: 400 });
  }

  log("recu — message", messageId, "de", user.id);

  // Sans configuration SMTP, on ne fait pas echouer l'envoi du message.
  if (!isMailerConfigured()) {
    log("ignore : GMAIL_USER ou GMAIL_APP_PASSWORD absent");
    return NextResponse.json({ ok: true, skipped: "mailer-not-configured" });
  }

  const admin = createAdminClient();

  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("id", messageId)
    .single();

  if (messageError || !message) {
    log("echec : message", messageId, "introuvable");
    return NextResponse.json({ message: "Message introuvable." }, { status: 404 });
  }

  if (message.sender_id !== user.id) {
    log("refuse :", user.id, "n'est pas l'expediteur du message", messageId);
    return NextResponse.json({ message: "Message non autorise." }, { status: 403 });
  }

  // Les types generes ne decrivent pas les relations imbriquees : meme
  // conversion que dans les services existants.
  type ConversationRow = {
    id: string;
    guest_id: string;
    host_id: string;
    listings?: { title: string; translations: unknown } | null;
  };

  const { data: conversationData, error: conversationError } = await admin
    .from("conversations")
    .select("id, guest_id, host_id, listings(title, translations)")
    .eq("id", message.conversation_id)
    .single();

  const conversation = conversationData as unknown as ConversationRow | null;

  if (conversationError || !conversation) {
    log("echec : conversation du message", messageId, "introuvable");
    return NextResponse.json({ message: "Conversation introuvable." }, { status: 404 });
  }

  const recipientId =
    conversation.host_id === user.id ? conversation.guest_id : conversation.host_id;

  const [{ data: recipient }, { data: sender }] = await Promise.all([
    admin.from("profiles").select("email, full_name").eq("id", recipientId).single(),
    admin.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (!recipient?.email) {
    log("ignore : le destinataire", recipientId, "n'a pas d'adresse email");
    return NextResponse.json({ ok: true, skipped: "no-recipient-email" });
  }

  const origin = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(/\/+$/, "");

  const listingTitle = conversation.listings?.title ?? "VacationHub";
  const translations = parseTranslations(conversation.listings?.translations);
  const conversationPath = `/messages?c=${conversation.id}`;

  const email = newMessageEmail({
    senderName: sender?.full_name || null,
    listingTitles: {
      fr: translations?.fr.title ?? listingTitle,
      en: translations?.en.title ?? listingTitle,
    },
    body: message.body,
    conversationUrls: {
      fr: `${origin}${localizePath(conversationPath, "fr")}`,
      en: `${origin}${localizePath(conversationPath, "en")}`,
    },
  });

  const startedAt = Date.now();
  log(`envoi a ${maskEmail(recipient.email)} — « ${email.subject} »`);

  try {
    const info = await sendEmail({ to: recipient.email, refId: message.id, ...email });
    log(`envoye en ${Date.now() - startedAt} ms — ${info.messageId} — ${info.response}`);
  } catch (error) {
    // L'echec d'un email ne doit jamais remonter jusqu'a l'utilisateur :
    // son message est deja parti.
    log("ECHEC apres", `${Date.now() - startedAt} ms :`, error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, skipped: "send-failed" });
  }

  return NextResponse.json({ ok: true, notified: true });
}
