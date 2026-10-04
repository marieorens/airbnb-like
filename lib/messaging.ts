import { createClient } from "@/lib/supabase/browser";
import type { Tables } from "@/types/supabase";

const normalizeStorageUrl = (url: string) =>
  url.replace(/\.supabase\.co\/rest\/v1\//, ".supabase.co/");

const CONVERSATION_SELECT = `
  id,listing_id,guest_id,host_id,last_message_at,guest_last_read_at,host_last_read_at,
  listings(title,listing_photos(public_url,storage_path,position)),
  guest:profiles!conversations_guest_id_fkey(id,full_name,avatar_url),
  host:profiles!conversations_host_id_fkey(id,full_name,avatar_url)
`;

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImageUrl: string | null;
  otherParty: { id: string; name: string | null; avatarUrl: string | null };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  unread: boolean;
};

export type ConversationRole = "guest" | "host";

type ProfileRef = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url">;

type ConversationRow = Pick<
  Tables<"conversations">,
  | "id"
  | "listing_id"
  | "guest_id"
  | "host_id"
  | "last_message_at"
  | "guest_last_read_at"
  | "host_last_read_at"
> & {
  listings?: {
    title: string;
    listing_photos?:
      | Pick<Tables<"listing_photos">, "public_url" | "storage_path" | "position">[]
      | null;
  } | null;
  guest?: ProfileRef | null;
  host?: ProfileRef | null;
};

export const toMessage = (row: Tables<"messages">): Message => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  body: row.body,
  createdAt: row.created_at,
});

/**
 * Fils de l'utilisateur, les plus recents d'abord.
 *
 * Meme logique que le mobile : l'apercu vient d'une seconde requete plutot que
 * d'une colonne denormalisee a maintenir.
 */
export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .or(`guest_id.eq.${userId},host_id.eq.${userId}`)
    .order("last_message_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as ConversationRow[];
  if (rows.length === 0) return [];

  const { data: recent, error: messagesError } = await supabase
    .from("messages")
    .select("conversation_id,sender_id,body,created_at")
    .in(
      "conversation_id",
      rows.map((row) => row.id)
    )
    .order("created_at", { ascending: false });

  if (messagesError) throw messagesError;

  const lastByConversation = new Map<
    string,
    { sender_id: string; body: string; created_at: string }
  >();
  (recent ?? []).forEach((message) => {
    if (!lastByConversation.has(message.conversation_id)) {
      lastByConversation.set(message.conversation_id, message);
    }
  });

  return rows.map((row) => {
    const isHost = row.host_id === userId;
    const otherProfile = isHost ? row.guest : row.host;
    const lastReadAt = isHost ? row.host_last_read_at : row.guest_last_read_at;
    const last = lastByConversation.get(row.id);

    const cover = [...(row.listings?.listing_photos ?? [])].sort(
      (a, b) => a.position - b.position
    )[0];
    const rawUrl = cover?.public_url || cover?.storage_path || null;

    return {
      id: row.id,
      listingId: row.listing_id,
      listingTitle: row.listings?.title ?? "Annonce",
      listingImageUrl: rawUrl ? normalizeStorageUrl(rawUrl) : null,
      otherParty: {
        id: isHost ? row.guest_id : row.host_id,
        name: otherProfile?.full_name ?? null,
        avatarUrl: otherProfile?.avatar_url ?? null,
      },
      lastMessageAt: row.last_message_at,
      lastMessagePreview: last?.body ?? null,
      lastMessageFromMe: last?.sender_id === userId,
      unread: Boolean(
        last && last.sender_id !== userId && (!lastReadAt || last.created_at > lastReadAt)
      ),
    };
  });
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toMessage);
}

export async function sendMessage({
  conversationId,
  senderId,
  body,
}: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<Message> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() })
    .select("*")
    .single();

  if (error) throw error;

  void notifyRecipient(supabase, data.id);
  return toMessage(data);
}

/**
 * Previent le destinataire par email, sans bloquer l'envoi.
 *
 * La route ignore d'elle-meme les conversations actives : inutile de filtrer
 * ici. Un echec reseau ne doit jamais empecher l'affichage du message.
 */
async function notifyRecipient(
  supabase: ReturnType<typeof createClient>,
  messageId: string
) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    await fetch("/api/notify-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messageId }),
    });
  } catch {
    // Silencieux par construction.
  }
}

export async function markConversationRead(
  conversationId: string,
  role: ConversationRole
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const payload = role === "host" ? { host_last_read_at: now } : { guest_last_read_at: now };

  const { error } = await supabase
    .from("conversations")
    .update(payload)
    .eq("id", conversationId);

  if (error) throw error;
}

/** Ouvre le fil d'une annonce, ou recupere celui qui existe deja. */
export async function openConversation({
  listingId,
  guestId,
  hostId,
}: {
  listingId: string;
  guestId: string;
  hostId: string;
}): Promise<string> {
  const supabase = createClient();

  const { data: existing, error: selectError } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("guest_id", guestId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ listing_id: listingId, guest_id: guestId, host_id: hostId })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function fetchConversationRole(
  conversationId: string,
  userId: string
): Promise<ConversationRole | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select("guest_id,host_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return data.host_id === userId ? "host" : "guest";
}

const timeOnly = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayAndMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const formatMessageTime = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) return timeOnly.format(date);
  if (date.getFullYear() === now.getFullYear()) return dayAndMonth.format(date);
  return fullDate.format(date);
};
