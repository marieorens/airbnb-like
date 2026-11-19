"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCornerUpLeft, FiSend, FiSlash, FiTrash2, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { useLocale, useTranslations } from "next-intl";

import { localizedTitle } from "@/utils/listingText";

import Image from "@/components/Image";
import SpinnerMini from "@/components/Loader";
import { createClient } from "@/lib/supabase/browser";
import {
  deleteMessage,
  fetchConversationRole,
  fetchConversations,
  fetchMessages,
  formatMessageTime,
  markConversationRead,
  mergeConfirmed,
  sendMessage,
  toMessage,
  type ConversationSummary,
  type Message,
} from "@/lib/messaging";
import type { Tables } from "@/types/supabase";
import { Link } from "@/i18n/navigation";

type MessagesClientProps = {
  userId: string;
  initialConversationId?: string;
};

function ConversationItem({
  conversation,
  active,
  onSelect,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const lastText = conversation.lastMessageDeleted
    ? t("deleted")
    : conversation.lastMessagePreview;
  const preview = lastText
    ? conversation.lastMessageFromMe
      ? t("fromMe", { text: lastText })
      : lastText
    : t("noMessageYet");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 border-b border-neutral-200 p-3 text-left transition hover:bg-neutral-50 ${
        active ? "bg-neutral-50" : "bg-white"
      }`}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
        {conversation.listingImageUrl ? (
          <Image
            imageSrc={conversation.listingImageUrl}
            fill
            alt={localizedTitle(
              conversation.listingTitle,
              conversation.listingTranslations,
              locale,
            )}
            className="object-cover"
            sizes="48px"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-black text-neutral-950">
            {conversation.otherParty.name ?? t("defaultMember")}
          </p>
          <span className="ml-auto shrink-0 text-[11px] font-medium text-neutral-400">
            {formatMessageTime(conversation.lastMessageAt, locale)}
          </span>
        </div>
        <p className="truncate text-xs font-semibold text-neutral-500">
          {localizedTitle(
            conversation.listingTitle,
            conversation.listingTranslations,
            locale,
          )}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p
            className={`truncate text-xs ${
              conversation.unread
                ? "font-bold text-neutral-950"
                : "font-medium text-neutral-500"
            }`}
          >
            {preview}
          </p>
          {conversation.unread ? (
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-rose-500" />
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function MessagesClient({
  userId,
  initialConversationId,
}: MessagesClientProps) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | undefined>(
    initialConversationId,
  );
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  // Seuls les messages arrivés après l'ouverture jouent leur entrée.
  const [openedAt] = useState(() => new Date().toISOString());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => fetchConversations(userId),
  });

  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data],
  );

  // A l'arrivee sans selection, on ouvre le fil le plus recent.
  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  const active = conversations.find((item) => item.id === activeId);

  const messagesQuery = useQuery({
    queryKey: ["messages", activeId],
    enabled: Boolean(activeId),
    queryFn: () => fetchMessages(activeId as string),
  });

  const messages = useMemo(
    () => messagesQuery.data ?? [],
    [messagesQuery.data],
  );

  // Abonnement temps reel au fil ouvert.
  useEffect(() => {
    if (!activeId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const message = toMessage(payload.new as Tables<"messages">);

          queryClient.setQueryData<Message[]>(
            ["messages", activeId],
            (current = []) => mergeConfirmed(current, message),
          );
          queryClient.invalidateQueries({
            queryKey: ["conversations", userId],
          });
        },
      )
      // Suppression d'un message (texte effacé par `delete_message`).
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const message = toMessage(payload.new as Tables<"messages">);
          queryClient.setQueryData<Message[]>(
            ["messages", activeId],
            (current = []) =>
              current.map((item) =>
                item.id === message.id ? { ...item, ...message } : item,
              ),
          );
          queryClient.invalidateQueries({
            queryKey: ["conversations", userId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, queryClient, userId]);

  // Marque le fil comme lu a l'ouverture.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    fetchConversationRole(activeId, userId)
      .then((role) => {
        if (cancelled || !role) return;
        return markConversationRead(activeId, role);
      })
      .then(() => {
        if (!cancelled)
          queryClient.invalidateQueries({
            queryKey: ["conversations", userId],
          });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeId, userId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const byId = useMemo(
    () => new Map(messages.map((item) => [item.id, item])),
    [messages],
  );
  const otherName = active?.otherParty.name ?? t("defaultMember");

  /** Auteur et texte d'un message cité. */
  const quoteOf = (message: Message) => ({
    author: message.senderId === userId ? t("you") : otherName,
    text: message.deletedAt ? t("deleted") : message.body,
  });

  // Le message s'affiche tout de suite (avec une horloge), puis est confirmé.
  const send = useMutation({
    mutationFn: ({
      body,
      replyToId,
    }: {
      body: string;
      replyToId: string | null;
    }) =>
      sendMessage({
        conversationId: activeId as string,
        senderId: userId,
        body,
        replyToId,
      }),
    onMutate: ({ body, replyToId }) => {
      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const provisional: Message = {
        id: tempId,
        clientKey: tempId,
        conversationId: activeId as string,
        senderId: userId,
        body: body.trim(),
        replyToId,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      queryClient.setQueryData<Message[]>(
        ["messages", activeId],
        (current = []) => [...current, provisional],
      );
      return { tempId };
    },
    onSuccess: (message, _input, context) => {
      queryClient.setQueryData<Message[]>(
        ["messages", activeId],
        (current = []) => mergeConfirmed(current, message, context?.tempId),
      );
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData<Message[]>(
        ["messages", activeId],
        (current = []) => current.filter((item) => item.id !== context?.tempId),
      );
    },
  });

  const remove = useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onMutate: (messageId) => {
      const previous = queryClient.getQueryData<Message[]>([
        "messages",
        activeId,
      ]);
      queryClient.setQueryData<Message[]>(
        ["messages", activeId],
        (current = []) =>
          current.map((item) =>
            item.id === messageId
              ? { ...item, body: "", deletedAt: new Date().toISOString() }
              : item,
          ),
      );
      return { previous };
    },
    onError: (_error, _messageId, context) => {
      if (context?.previous)
        queryClient.setQueryData(["messages", activeId], context.previous);
      toast.error(t("deleteFailed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    },
  });

  const startReply = (message: Message) => {
    setReplyTo(message);
    inputRef.current?.focus();
  };

  const confirmDelete = (message: Message) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    if (replyTo?.id === message.id) setReplyTo(null);
    remove.mutate(message.id);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;
    const quoted = replyTo;
    setDraft("");
    setReplyTo(null);
    send.mutate(
      { body, replyToId: quoted?.id ?? null },
      {
        onError: () => {
          setDraft(body);
          setReplyTo(quoted);
        },
      },
    );
  };

  if (conversationsQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <SpinnerMini className="h-6 w-6" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
        <p className="text-lg font-black text-neutral-950">{t("emptyTitle")}</p>
        <p className="mt-2 text-sm font-medium text-neutral-500">
          {t("emptyText")}
        </p>
        <Link
          href="/annonces"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-rose-500 px-5 text-sm font-bold text-white transition hover:bg-rose-600"
        >
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid h-[72vh] overflow-hidden rounded-2xl border border-neutral-200 bg-white md:grid-cols-[320px_1fr]">
      <aside className="hidden overflow-y-auto border-r border-neutral-200 md:block">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeId}
            onSelect={() => {
              setActiveId(conversation.id);
              setReplyTo(null);
            }}
          />
        ))}
      </aside>

      <section className="flex min-h-0 flex-col">
        {active ? (
          <header className="flex items-center gap-3 border-b border-neutral-200 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-neutral-950">
                {active.otherParty.name ?? t("defaultMember")}
              </p>
              <Link
                href={`/listings/${active.listingId}`}
                className="truncate text-xs font-semibold text-neutral-500 hover:text-rose-600"
              >
                {localizedTitle(
                  active.listingTitle,
                  active.listingTranslations,
                  locale,
                )}
              </Link>
            </div>

            <select
              value={activeId}
              onChange={(event) => {
                setActiveId(event.target.value);
                setReplyTo(null);
              }}
              className="ml-auto h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold md:hidden"
            >
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.otherParty.name ?? t("member")} —{" "}
                  {localizedTitle(
                    conversation.listingTitle,
                    conversation.listingTranslations,
                    locale,
                  )}
                </option>
              ))}
            </select>
          </header>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messagesQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <SpinnerMini className="h-5 w-5" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-neutral-500">
              {t("threadEmpty")}
            </p>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === userId;
              const deleted = Boolean(message.deletedAt);
              const interactive = !deleted && !message.pending;
              const quoted =
                message.replyToId && !deleted
                  ? byId.get(message.replyToId)
                  : undefined;
              const quote =
                message.replyToId && !deleted
                  ? quoted
                    ? quoteOf(quoted)
                    : { author: "", text: t("quoteUnavailable") }
                  : null;

              return (
                <div
                  key={message.clientKey ?? message.id}
                  className={`group flex items-center gap-2 ${
                    mine ? "flex-row-reverse" : "flex-row"
                  } ${
                    message.createdAt > openedAt
                      ? `message-in ${mine ? "message-in-mine" : "message-in-theirs"}`
                      : ""
                  }`}
                >
                  <div
                    className={`max-w-[78%] ${mine ? "text-right" : "text-left"}`}
                  >
                    <div
                      className={`inline-block rounded-2xl px-4 py-2.5 text-left text-[15px] leading-6 ${
                        deleted
                          ? "border border-dashed border-neutral-300 text-neutral-400"
                          : mine
                            ? "rounded-br-md bg-rose-500 text-white"
                            : "rounded-bl-md border border-neutral-200 bg-white text-neutral-950"
                      }`}
                    >
                      {quote ? (
                        <div
                          className={`mb-2 rounded-lg border-l-[3px] px-3 py-1.5 ${
                            mine
                              ? "border-white bg-white/20"
                              : "border-rose-500 bg-neutral-100"
                          }`}
                        >
                          {quote.author ? (
                            <p
                              className={`text-xs font-black ${mine ? "text-white" : "text-rose-600"}`}
                            >
                              {quote.author}
                            </p>
                          ) : null}
                          <p
                            className={`line-clamp-2 text-[13px] leading-5 ${
                              mine ? "text-white/85" : "text-neutral-500"
                            }`}
                          >
                            {quote.text}
                          </p>
                        </div>
                      ) : null}
                      {deleted ? (
                        <span className="inline-flex items-center gap-1.5">
                          <FiSlash size={13} />
                          {t("deleted")}
                        </span>
                      ) : (
                        <span className="whitespace-pre-wrap break-words">
                          {message.body}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-neutral-400">
                      {message.pending
                        ? t("sending")
                        : formatMessageTime(message.createdAt, locale)}
                    </p>
                  </div>

                  {interactive ? (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => startReply(message)}
                        aria-label={t("reply")}
                        title={t("reply")}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
                      >
                        <FiCornerUpLeft size={16} />
                      </button>
                      {mine ? (
                        <button
                          type="button"
                          onClick={() => confirmDelete(message)}
                          aria-label={t("delete")}
                          title={t("delete")}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-neutral-200 p-3">
          {replyTo ? (
            <div className="message-in message-in-theirs mb-2 flex items-center gap-3 rounded-xl border-l-[3px] border-rose-500 bg-neutral-100 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-rose-600">
                  {t("replyingTo", { name: quoteOf(replyTo).author })}
                </p>
                <p className="truncate text-[13px] text-neutral-500">
                  {quoteOf(replyTo).text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={t("cancelReply")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200"
              >
                <FiX size={16} />
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit(event);
                }
              }}
              rows={1}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              className="max-h-32 min-h-[44px] flex-1 resize-y rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-900"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label={t("send")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-white transition duration-150 hover:bg-rose-600 active:scale-90 disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              <FiSend size={18} />
            </button>
          </div>
        </form>

        {send.isError ? (
          <p className="px-4 pb-3 text-xs font-bold text-rose-600">
            {t("sendFailed")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
