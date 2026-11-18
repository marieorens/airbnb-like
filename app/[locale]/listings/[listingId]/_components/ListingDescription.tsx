"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface ListingDescriptionProps {
  description: string;
  /** Texte saisi par l'annonceur, quand `description` est une traduction. */
  original?: string;
}

/**
 * Description de l'annonce. Quand elle est traduite automatiquement, on le
 * signale et on permet de lire le texte d'origine.
 */
const ListingDescription: React.FC<ListingDescriptionProps> = ({ description, original }) => {
  const t = useTranslations("listing");
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-line text-[16px] font-light text-neutral-500">
        {showOriginal && original ? original : description}
      </p>
      {original ? (
        <p className="text-xs font-semibold text-neutral-400">
          {t("autoTranslated")} ·{" "}
          <button
            type="button"
            onClick={() => setShowOriginal((value) => !value)}
            className="font-bold text-rose-600 underline-offset-2 hover:underline"
          >
            {showOriginal ? t("showTranslation") : t("showOriginal")}
          </button>
        </p>
      ) : null}
    </div>
  );
};

export default ListingDescription;
