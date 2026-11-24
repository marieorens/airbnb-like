import { defineRouting } from "next-intl/routing";

// Le français reste à la racine (`/annonces`) : les liens existants, les URL de retour Stripe
// et le lien de confirmation email du mobile continuent de fonctionner. Les autres langues
// vivent sous leur préfixe : `/en`, `/es`, `/pt`, `/de`, `/it`.
export const routing = defineRouting({
  locales: ["fr", "en", "es", "pt", "de", "it"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

/** Nom de chaque langue dans sa propre langue, pour le sélecteur. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  it: "Italiano",
};

/** Balise BCP 47 pour `Intl` (dates, heures). */
export const intlLocale = (locale: string): string =>
  ({ fr: "fr-FR", en: "en-GB", es: "es-ES", pt: "pt-PT", de: "de-DE", it: "it-IT" })[locale] ??
  "fr-FR";

export const isLocale = (value: unknown): value is Locale =>
  routing.locales.some((locale) => locale === value);

/** Préfixe un chemin interne (`/trips`) selon la langue : `/trips` en français, `/en/trips` en anglais. */
export const localizePath = (path: string, locale: string) =>
  locale === routing.defaultLocale || !isLocale(locale)
    ? path
    : `/${locale}${path === "/" ? "" : path}`;

/** Sépare la langue du reste du chemin : `/en/trips` → { locale: "en", pathname: "/trips" }. */
export const splitLocale = (pathname: string) => {
  const [, first, ...rest] = pathname.split("/");
  if (isLocale(first) && first !== routing.defaultLocale) {
    return { locale: first as Locale, pathname: `/${rest.join("/")}` };
  }
  return { locale: routing.defaultLocale as Locale, pathname };
};

/**
 * Langue d'une requête sans préfixe (routes `/auth/*`) : le cookie posé par next-intl,
 * sinon la langue du navigateur, sinon le français.
 */
export const getRequestLocale = (request: {
  cookies: { get: (name: string) => { value: string } | undefined };
  headers: Headers;
}): Locale => {
  const fromCookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const browser = request.headers.get("accept-language")?.slice(0, 2).toLowerCase();
  return isLocale(browser) ? browser : routing.defaultLocale;
};
