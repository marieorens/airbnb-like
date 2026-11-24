"use client";

import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";

/**
 * Première consultation d'une annonce dans une langue supplémentaire : on
 * demande sa traduction, puis on recharge la fiche pour l'afficher. En
 * attendant, la fiche montre la version anglaise.
 */
const TranslationRequest = ({ listingId, locale }: { listingId: string; locale: string }) => {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/translate-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, locale }),
    })
      .then((response) => response.json())
      .then((payload: { translated?: boolean }) => {
        if (!cancelled && payload.translated) router.refresh();
      })
      // Sans traduction, la version anglaise reste affichée : rien d'autre à faire.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [listingId, locale, router]);

  return null;
};

export default TranslationRequest;
