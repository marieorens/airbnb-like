"use client";

import React, { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, routing, type Locale } from "@/i18n/routing";

// Changement de langue en restant sur la même page, filtres compris.
const LocaleSwitcher = () => {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (nextLocale: Locale) => {
    const search = window.location.search;
    startTransition(() => {
      router.replace(`${pathname}${search}`, { locale: nextLocale });
    });
  };

  return (
    <label className="relative shrink-0" title={t("switchLanguage")}>
      <span className="sr-only">{t("switchLanguage")}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => switchLocale(event.target.value as Locale)}
        className="h-10 cursor-pointer appearance-none rounded-full bg-neutral-100 px-3 text-xs font-black uppercase text-neutral-950 outline-none transition hover:bg-neutral-200 disabled:opacity-60 sm:h-11"
      >
        {routing.locales.map((item) => (
          <option key={item} value={item}>
            {item.toUpperCase()} · {LOCALE_NAMES[item]}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LocaleSwitcher;
