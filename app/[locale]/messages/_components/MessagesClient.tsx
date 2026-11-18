"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiSend } from "react-icons/fi";
import { useLocale, useTranslations } from "next-intl";

import { localizedTitle } from "@/utils/listingText";

import Image from "@/components/Image";
import SpinnerMini from "@/components/Loader";
import { createClient } from "@/lib/supabase/browser";
import {
  fetchConversationRole,
  fetchConversations,
  fetchMessages,
  formatMessageTime,
  markConversationRead,
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
  const preview = conversation.lastMessagePreview
    ? conversation.lastMessageFromMe
      ? t("fromMe", { text: conversation.lastMessagePreview })
      : conversation.lastMessagePreview
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
            alt={localizedTitle(conversation.listingTitle, conversation.listingTranslations, locale)}
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
          {localizedTitle(conversation.listingTitle, conversation.listingTranslations, locale)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p
            className={`truncate text-xs ${
              conversation.unread ? "font-bold text-neutral-950" : "font-medium text-neutral-500"
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

export default function MessagesClient({ userId, initialConversationId }: MessagesClientProps) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | undefined>(initialConversationId);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => fetchConversations(userId),
  });

  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data]
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

  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

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

          queryClient.setQueryData<Message[]>(["messages", activeId], (current = []) =>
            current.some((item) => item.id === message.id) ? current : [...current, message]
          );
          queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
        }
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
        if (!cancelled) queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeId, userId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: (body: string) =>
      sendMessage({ conversationId: activeId as string, senderId: userId, body }),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(["messages", activeId], (current = []) =>
        current.some((item) => item.id === message.id) ? current : [...current, message]
      );
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || send.isLoading) return;
    setDraft("");
    send.mutate(body, { onError: () => setDraft(body) });
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
            onSelect={() => setActiveId(conversation.id)}
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
                {localizedTitle(active.listingTitle, active.listingTranslations, locale)}
              </Link>
            </div>

            <select
              value={activeId}
              onChange={(event) => setActiveId(event.target.value)}
              className="ml-auto h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold md:hidden"
            >
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.otherParty.name ?? t("member")} — {localizedTitle(conversation.listingTitle, conversation.listingTranslations, locale)}
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
              return (
                <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div className="max-w-[78%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-[15px] leading-6 ${
                        mine
                          ? "rounded-tr-md bg-rose-500 text-white"
                          : "rounded-tl-md border border-neutral-200 bg-white text-neutral-950"
                      }`}
                    >
                      {message.body}
                    </div>
                    <p
                      className={`mt-1 text-[11px] font-medium text-neutral-400 ${
                        mine ? "text-right" : "text-left"
                      }`}
                    >
                      {formatMessageTime(message.createdAt, locale)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-neutral-200 p-3">
          <textarea
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
            disabled={!draft.trim() || send.isLoading}
            aria-label={t("send")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600 disabled:opacity-40"
          >
            {send.isLoading ? <SpinnerMini className="h-4 w-4" /> : <FiSend size={18} />}
          </button>
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
