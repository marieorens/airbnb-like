"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/CurrencyProvider";
import { useRouter } from "@/i18n/navigation";
import { CURRENCIES } from "@/lib/currency";
import { setPreferredCurrency } from "@/services/currency-preference";

/**
 * Devise d'affichage des prix, à côté du bouton de langue. Enregistrée dans le
 * profil si l'on est connecté, sinon dans un cookie du navigateur.
 */
const CurrencySwitcher = () => {
  const t = useTranslations("nav");
  const router = useRouter();
  const { preferred } = useCurrency();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="relative shrink-0" title={t("currency")}>
      <span className="sr-only">{t("currency")}</span>
      <select
        value={preferred ?? ""}
        disabled={isPending}
        onChange={(event) => {
          const value = event.target.value || null;
          startTransition(async () => {
            await setPreferredCurrency(value);
            router.refresh();
          });
        }}
        className="h-10 cursor-pointer appearance-none rounded-full bg-neutral-100 px-3 text-xs font-black uppercase text-neutral-950 outline-none transition hover:bg-neutral-200 disabled:opacity-60 sm:h-11"
      >
        <option value="">{t("currencyListing")}</option>
        {CURRENCIES.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
    </label>
  );
};

export default CurrencySwitcher;
