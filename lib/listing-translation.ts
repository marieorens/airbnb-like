/**
 * Traduction automatique du titre et de la description d'une annonce (FR <-> EN),
 * via l'offre gratuite de DeepL (« DeepL API Free » : 500 000 caractères par mois,
 * aucune facturation — au-delà, DeepL refuse simplement jusqu'au mois suivant).
 *
 * Appelée côté serveur uniquement, à la publication (web et mobile) et par le
 * script de rattrapage `scripts/translate-listings.ts`. Le texte d'origine reste
 * dans `title` / `description` ; les deux versions vont dans
 * `listings.translations` sous la forme `{ fr: {...}, en: {...} }`.
 *
 * Volontairement sans import Next.js ni alias `@/` : le script de rattrapage
 * l'exécute hors de Next.
 */

export type ListingTranslations = {
  fr: { title: string; description: string };
  en: { title: string; description: string };
};

/** Code DeepL des langues traduites à la demande (portugais d'Europe et d'Afrique). */
const DEEPL_TARGETS = { es: "ES", pt: "PT-PT", de: "DE", it: "IT" } as const;
export type OnDemandLocale = keyof typeof DEEPL_TARGETS;

type DeepLResponse = {
  translations?: { detected_source_language: string; text: string }[];
};

const apiKey = () => process.env.DEEPL_API_KEY?.trim() || "";

export const isTranslationConfigured = () => Boolean(apiKey());

/** Les clés de l'offre gratuite finissent par `:fx` et ont leur propre adresse. */
const endpoint = () =>
  apiKey().endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

/** Traduit `[titre, description]` vers une langue ; renvoie aussi la langue détectée. */
async function translate(texts: [string, string], targetLang: string) {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: texts,
      target_lang: targetLang,
      preserve_formatting: true,
    }),
  });

  if (!response.ok) {
    // 456 : quota mensuel gratuit atteint. 403 : clé invalide.
    throw new Error(`DeepL ${response.status} ${await response.text().catch(() => "")}`);
  }

  const payload = (await response.json()) as DeepLResponse;
  const [title, description] = payload.translations ?? [];
  if (!title || !description) throw new Error("DeepL : réponse incomplète");

  return {
    source: title.detected_source_language.toUpperCase(),
    title: title.text,
    description: description.text,
  };
}

/**
 * Renvoie les deux versions, ou `null` si la traduction est indisponible
 * (clé absente, quota atteint, erreur réseau). Ne lève pas d'erreur : une
 * annonce doit pouvoir être publiée même si la traduction échoue.
 */
export async function translateListingText(input: {
  title: string;
  description: string;
}): Promise<ListingTranslations | null> {
  if (!isTranslationConfigured()) return null;

  const original = { title: input.title, description: input.description };

  try {
    // Un premier appel vers l'anglais révèle la langue d'origine. La plupart
    // des annonces sont en français : un seul appel suffit alors.
    const english = await translate([input.title, input.description], "EN-US");

    if (english.source === "FR") {
      return { fr: original, en: { title: english.title, description: english.description } };
    }

    const french = await translate([input.title, input.description], "FR");
    const en =
      english.source === "EN"
        ? original
        : { title: english.title, description: english.description };

    return { fr: { title: french.title, description: french.description }, en };
  } catch (error) {
    console.error("[listing-translation]", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Traduction d'une annonce dans une langue supplémentaire, à la première
 * consultation de sa fiche dans cette langue. `null` si indisponible.
 */
export async function translateListingTo(
  input: { title: string; description: string },
  locale: OnDemandLocale
): Promise<{ title: string; description: string } | null> {
  if (!isTranslationConfigured()) return null;
  try {
    const result = await translate([input.title, input.description], DEEPL_TARGETS[locale]);
    return { title: result.title, description: result.description };
  } catch (error) {
    console.error("[listing-translation]", locale, error instanceof Error ? error.message : error);
    return null;
  }
}
