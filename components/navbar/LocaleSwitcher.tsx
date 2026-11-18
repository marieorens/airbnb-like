"use client";

import React, { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Bascule FR ⇄ EN en restant sur la même page, filtres compris.
const LocaleSwitcher = () => {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const nextLocale: Locale =
    routing.locales.find((item) => item !== locale) ?? routing.defaultLocale;

  const switchLocale = () => {
    const search = window.location.search;
    startTransition(() => {
      router.replace(`${pathname}${search}`, { locale: nextLocale });
    });
  };

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      aria-label={t("switchLanguage")}
      title={t("switchLanguage")}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-black uppercase text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:h-11 sm:w-11"
    >
      {nextLocale}
    </button>
  );
};

export default LocaleSwitcher;
