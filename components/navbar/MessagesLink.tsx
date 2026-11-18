"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FiMessageCircle } from "react-icons/fi";

import { fetchConversations } from "@/lib/messaging";
import { Link } from "@/i18n/navigation";

/**
 * Acces direct a la messagerie depuis la barre de navigation.
 *
 * La messagerie est le seul canal de contact du produit : la laisser dans le
 * menu deroulant signifiait qu'un annonceur ne voyait rien tant qu'il ne
 * l'ouvrait pas.
 */
const MessagesLink = ({ userId }: { userId?: string }) => {
  const t = useTranslations("nav");
  const { data } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => fetchConversations(userId as string),
    enabled: Boolean(userId),
    // Un fil ouvert ailleurs doit finir par se voir ici.
    refetchInterval: 60 * 1000,
  });

  if (!userId) return null;

  const unread = data?.filter((conversation) => conversation.unread).length ?? 0;

  return (
    <Link
      href="/messages"
      aria-label={unread > 0 ? t("messagesUnread", { count: unread }) : t("menu.messages")}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950"
    >
      <FiMessageCircle size={18} />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
};

export default MessagesLink;
