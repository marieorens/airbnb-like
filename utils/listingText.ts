/**
 * Choix du titre et de la description à afficher selon la langue.
 *
 * Sans dépendance au SDK de traduction : importable depuis un composant client.
 * La traduction elle-même vit dans `lib/listing-translation.ts` (serveur).
 *
 * Français et anglais sont traduits à la publication ; les autres langues le
 * sont au premier affichage de la fiche (décision validée : option B), puis
 * gardées dans `listings.translations`.
 */

type ListingText = { title: string; description: string };

/** Langues traduites à la demande, en plus du français et de l'anglais. */
export const ON_DEMAND_LOCALES = ["es", "pt", "de", "it"] as const;
export type OnDemandLocale = (typeof ON_DEMAND_LOCALES)[number];

export const isOnDemandLocale = (value: unknown): value is OnDemandLocale =>
  typeof value === "string" && (ON_DEMAND_LOCALES as readonly string[]).includes(value);

export type ListingTranslations = {
  fr: ListingText;
  en: ListingText;
} & Partial<Record<OnDemandLocale, ListingText>>;

const isText = (value: unknown): value is ListingText =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { title?: unknown }).title === "string" &&
  typeof (value as { description?: unknown }).description === "string";

/** Lit la colonne jsonb `listings.translations` ; `null` si vide ou malformée. */
export const parseTranslations = (value: unknown): ListingTranslations | null => {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!isText(raw.fr) || !isText(raw.en)) return null;

  const result: ListingTranslations = { fr: raw.fr, en: raw.en };
  ON_DEMAND_LOCALES.forEach((locale) => {
    const version = raw[locale];
    if (isText(version)) result[locale] = version;
  });
  return result;
};

/** Version dans la langue demandée ; sinon l'anglais (hors français) en attendant. */
const versionFor = (translations: ListingTranslations | null, locale: string) => {
  if (!translations) return undefined;
  if (locale === "fr" || locale === "en") return translations[locale];
  return (isOnDemandLocale(locale) ? translations[locale] : undefined) ?? translations.en;
};

/** Vrai si la fiche doit demander la traduction dans cette langue. */
export const needsTranslation = (translations: ListingTranslations | null, locale: string) =>
  Boolean(translations) && isOnDemandLocale(locale) && !translations?.[locale];

/**
 * Texte dans la langue demandée, avec repli sur l'original.
 * `translated` est vrai quand le texte affiché diffère de celui saisi.
 */
export const pickListingText = (
  listing: { title: string; description: string; translations: ListingTranslations | null },
  locale: string
) => {
  const version = versionFor(listing.translations, locale);

  if (!version) {
    return { title: listing.title, description: listing.description, translated: false };
  }

  return {
    title: version.title,
    description: version.description,
    translated:
      version.title !== listing.title || version.description !== listing.description,
  };
};

/** Titre seul, pour les écrans qui ne montrent pas la description. */
export const localizedTitle = (
  title: string,
  translations: ListingTranslations | null,
  locale: string
): string => versionFor(translations, locale)?.title ?? title;
