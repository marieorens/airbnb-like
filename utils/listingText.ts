/**
 * Choix du titre et de la description à afficher selon la langue.
 *
 * Sans dépendance au SDK de traduction : importable depuis un composant client.
 * La traduction elle-même vit dans `lib/listing-translation.ts` (serveur).
 */

export type ListingTranslations = {
  fr: { title: string; description: string };
  en: { title: string; description: string };
};

const isText = (value: unknown): value is { title: string; description: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { title?: unknown }).title === "string" &&
  typeof (value as { description?: unknown }).description === "string";

/** Lit la colonne jsonb `listings.translations` ; `null` si vide ou malformée. */
export const parseTranslations = (value: unknown): ListingTranslations | null => {
  if (typeof value !== "object" || value === null) return null;
  const { fr, en } = value as { fr?: unknown; en?: unknown };
  return isText(fr) && isText(en) ? { fr, en } : null;
};

/**
 * Texte dans la langue demandée, avec repli sur l'original.
 * `translated` est vrai quand le texte affiché diffère de celui saisi.
 */
export const pickListingText = (
  listing: { title: string; description: string; translations: ListingTranslations | null },
  locale: string
) => {
  const version =
    locale === "en" || locale === "fr" ? listing.translations?.[locale] : undefined;

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
): string => (locale === "en" || locale === "fr" ? translations?.[locale].title : undefined) ?? title;
