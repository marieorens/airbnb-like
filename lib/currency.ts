/**
 * Devises du produit et conversion des prix vers la devise préférée.
 * Même logique que le mobile (`airbnb-clone-mobile/src/lib/currency.ts`).
 *
 * On paie toujours dans la devise de l'annonce : la conversion ne sert qu'à
 * l'affichage (« ≈ ») et aux filtres de prix.
 */
import { formatPrice } from "@/utils/helper";

export const CURRENCIES = ["USD", "EUR", "XOF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (value: unknown): value is Currency =>
  typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);

/** Cookie de la devise choisie par un visiteur (connecté, le profil fait foi). */
export const CURRENCY_COOKIE = "vacationhub-currency";

/** Parité fixe du franc CFA avec l'euro. */
const XOF_PER_EUR = 655.957;

/** Unités de chaque devise pour 1 euro. */
export type Rates = Record<Currency, number>;

/**
 * Taux du jour de la Banque centrale européenne (API Frankfurter : gratuite,
 * sans clé), mis en cache 12 heures par Next.js. Le XOF suit l'euro à parité
 * fixe. `null` si l'API ne répond pas : les prix restent alors d'origine.
 */
export async function fetchRates(): Promise<Rates | null> {
  try {
    const response = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD", {
      next: { revalidate: 12 * 60 * 60 },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { rates?: { USD?: number } };
    const usd = payload.rates?.USD;
    if (!usd || usd <= 0) return null;
    return { EUR: 1, USD: usd, XOF: XOF_PER_EUR };
  } catch {
    return null;
  }
}

/** Montant converti, ou `null` si la conversion est impossible (taux absents). */
export function convertAmount(
  amount: number,
  from: string,
  to: Currency,
  rates: Rates | null | undefined
): number | null {
  if (from === to) return amount;
  if (!rates || !isCurrency(from)) return null;
  return (amount / rates[from]) * rates[to];
}

export const currencySymbol = (currency: string): string =>
  currency === "EUR" ? "EUR" : currency === "XOF" ? "XOF" : "$";

/** « 1,250 $ », « 65,600 XOF » : montant puis devise, arrondi à l'unité. */
export const formatMoney = (amount: number, currency: string): string =>
  `${formatPrice(Math.round(amount))} ${currencySymbol(currency)}`;

/**
 * Prix à afficher selon la devise préférée.
 * - pas de préférence, même devise, ou taux indisponibles : le prix d'origine ;
 * - sinon : le prix converti, marqué approximatif, et le prix d'origine à part.
 */
export function displayPrice(
  amount: number,
  currency: string,
  preferred: Currency | null,
  rates: Rates | null | undefined
): { main: string; approximate: boolean; original: string } {
  const original = formatMoney(amount, currency);
  if (!preferred || preferred === currency) return { main: original, approximate: false, original };

  const converted = convertAmount(amount, currency, preferred, rates);
  if (converted === null) return { main: original, approximate: false, original };
  return { main: `≈ ${formatMoney(converted, preferred)}`, approximate: true, original };
}

/**
 * Filtre PostgREST des bornes de prix exprimées dans `currency`, appliqué à
 * toutes les devises : chaque annonce est comparée dans sa propre devise.
 * `null` si les taux manquent (l'appelant se rabat sur la seule devise choisie).
 */
export function priceRangeFilter(
  currency: Currency,
  minPrice: number | undefined,
  maxPrice: number | undefined,
  rates: Rates | null | undefined
): string | null {
  if (!rates) return null;
  return CURRENCIES.map((target) => {
    const parts = [`currency.eq.${target}`];
    if (minPrice && minPrice > 0) {
      parts.push(
        `price_per_night.gte.${Math.floor(convertAmount(minPrice, currency, target, rates) ?? 0)}`
      );
    }
    if (maxPrice && maxPrice > 0) {
      parts.push(
        `price_per_night.lte.${Math.ceil(convertAmount(maxPrice, currency, target, rates) ?? 0)}`
      );
    }
    return `and(${parts.join(",")})`;
  }).join(",");
}
