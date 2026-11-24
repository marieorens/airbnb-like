import { getTranslations } from "next-intl/server";

import { currencies } from "@/utils/constants";
import { Link } from "@/i18n/navigation";
import { getPreferredCurrency } from "@/services/currency-preference";

import CityField from "./CityField";

type SearchParams = { [key: string]: string | undefined };

interface AdvancedFiltersProps {
  searchParams?: SearchParams;
}

// Filtres gérés par les puces au-dessus : on les conserve tels quels à l'envoi du formulaire.
const preservedKeys = [
  "transactionType",
  "assetType",
  "category",
  "country",
  "region",
  "startDate",
  "endDate",
] as const;

const countOptions = [1, 2, 3, 4, 5];

const fieldLabel =
  "mb-2 block text-xs font-black uppercase tracking-wide text-neutral-400";
const fieldControl =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-950 outline-none transition focus:border-neutral-950";

const CountSelect = ({
  name,
  label,
  value,
  anyLabel,
}: {
  name: string;
  label: string;
  value?: string;
  anyLabel: string;
}) => (
  <label className="block">
    <span className={fieldLabel}>{label}</span>
    <select name={name} defaultValue={value ?? ""} className={fieldControl}>
      <option value="">{anyLabel}</option>
      {countOptions.map((count) => (
        <option key={count} value={count}>
          {count}+
        </option>
      ))}
    </select>
  </label>
);

const AdvancedFilters = async ({ searchParams = {} }: AdvancedFiltersProps) => {
  const t = await getTranslations("catalogue.advanced");
  // Devise proposée pour les bornes de prix : la devise préférée du membre.
  const preferredCurrency = await getPreferredCurrency();
  const { transactionType, assetType, currency, minPrice, maxPrice } =
    searchParams;

  // Une parcelle n'a ni pièces ni salles de bain ; la capacité d'accueil ne concerne que les séjours.
  const isLand = assetType === "land_sale";
  const showGuests = !isLand && (!transactionType || transactionType === "booking");
  const priceWithoutCurrency = Boolean((minPrice || maxPrice) && !currency);

  const resetHref = (() => {
    const params = new URLSearchParams();
    preservedKeys.forEach((key) => {
      const value = searchParams[key];
      if (value) params.set(key, value);
    });
    const query = params.toString();
    return query ? `/annonces?${query}` : "/annonces";
  })();

  return (
    <form
      action="/annonces"
      method="get"
      className="mt-5 border-t border-neutral-100 pt-6"
    >
      {preservedKeys.map((key) =>
        searchParams[key] ? (
          <input key={key} type="hidden" name={key} value={searchParams[key]} />
        ) : null
      )}

      <p className="mb-3 text-xs font-black uppercase tracking-wide text-neutral-400">
        {t("title")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {searchParams.country ? (
          <CityField
            country={searchParams.country}
            value={searchParams.city}
            labelClassName={fieldLabel}
            controlClassName={fieldControl}
          />
        ) : null}
        <label className="block">
          <span className={fieldLabel}>{t("currency")}</span>
          <select
            name="currency"
            defaultValue={currency ?? preferredCurrency ?? ""}
            className={fieldControl}
          >
            <option value="">{t("allCurrencies")}</option>
            {currencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>{t("minPrice")}</span>
          <input
            type="number"
            name="minPrice"
            min={0}
            inputMode="numeric"
            placeholder="0"
            defaultValue={minPrice ?? ""}
            className={fieldControl}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>{t("maxPrice")}</span>
          <input
            type="number"
            name="maxPrice"
            min={0}
            inputMode="numeric"
            placeholder={t("noLimit")}
            defaultValue={maxPrice ?? ""}
            className={fieldControl}
          />
        </label>

        {!isLand ? (
          <>
            <CountSelect
              name="roomCount"
              label={t("rooms")}
              value={searchParams.roomCount}
              anyLabel={t("any")}
            />
            <CountSelect
              name="bathroomCount"
              label={t("bathrooms")}
              value={searchParams.bathroomCount}
              anyLabel={t("any")}
            />
          </>
        ) : null}
        {showGuests ? (
          <CountSelect
            name="guestCount"
            label={t("guests")}
            value={searchParams.guestCount}
            anyLabel={t("any")}
          />
        ) : null}
      </div>

      {priceWithoutCurrency ? (
        <p className="mt-3 text-sm font-semibold text-[#BE123C]">
          {t("currencyRequired")}
        </p>
      ) : (
        <p className="mt-3 text-xs font-medium text-neutral-500">
          {t("currencyHint")}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-full bg-[#E11D48] px-6 text-sm font-black text-white transition hover:bg-[#BE123C]"
        >
          {t("apply")}
        </button>
        <Link
          href={resetHref}
          className="text-sm font-black text-neutral-500 underline-offset-4 transition hover:text-neutral-950 hover:underline"
        >
          {t("reset")}
        </Link>
      </div>
    </form>
  );
};

export default AdvancedFilters;
