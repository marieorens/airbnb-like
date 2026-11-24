"use client";

import countries from "@/data/countries.json";
import { createClient } from "@/lib/supabase/browser";

/**
 * Villes d'un pays pour le filtre de recherche (décision validée : API +
 * villes des annonces). Même logique que le mobile (`src/lib/cities.ts`).
 *
 * - les villes où des biens sont publiés, en tête, avec leur nombre ;
 * - puis toutes les villes du pays, données par l'API gratuite CountriesNow.
 *
 * L'API nomme parfois les pays autrement que nous (« Ivory Coast » contre
 * « Cote d'Ivoire ») : on passe par le code ISO pour retrouver son nom.
 */

const API = "https://countriesnow.space/api/v0.1/countries";

export type CityOption = {
  name: string;
  /** Nombre de biens publiés dans cette ville ; 0 si elle vient seulement de l'API. */
  listingCount: number;
};

/** Clé de comparaison : sans accents, casse ni espaces superflus. */
export const cityKey = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Nom du pays chez CountriesNow, à partir de notre libellé (`listings.country`). */
async function apiCountryName(countryLabel: string): Promise<string | null> {
  const iso2 = (countries as { value: string; label: string }[]).find(
    (country) => country.label === countryLabel
  )?.value;
  if (!iso2) return null;
  const response = await fetch(`${API}/iso`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: { name: string; Iso2: string }[] };
  return payload.data?.find((item) => item.Iso2 === iso2)?.name ?? null;
}

/** Toutes les villes du pays selon l'API ; liste vide si elle ne répond pas. */
export async function fetchApiCities(countryLabel: string): Promise<string[]> {
  try {
    const name = await apiCountryName(countryLabel);
    if (!name) return [];
    const response = await fetch(`${API}/cities/q?country=${encodeURIComponent(name)}`);
    if (!response.ok) return [];
    const payload = (await response.json()) as { error?: boolean; data?: string[] };
    return payload.error ? [] : (payload.data ?? []);
  } catch {
    return [];
  }
}

/** Villes où des biens sont publiés, avec leur nombre (orthographe la plus fréquente). */
export async function fetchListingCities(countryLabel: string): Promise<CityOption[]> {
  const { data, error } = await createClient()
    .from("listings")
    .select("city")
    .eq("status", "published")
    .eq("country", countryLabel)
    .not("city", "is", null)
    .limit(2000);
  if (error) throw error;

  const groups = new Map<string, { spellings: Map<string, number>; count: number }>();
  (data ?? []).forEach((row) => {
    const city = row.city?.trim();
    if (!city) return;
    const key = cityKey(city);
    const group = groups.get(key) ?? { spellings: new Map<string, number>(), count: 0 };
    group.count += 1;
    group.spellings.set(city, (group.spellings.get(city) ?? 0) + 1);
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      name: Array.from(group.spellings.entries()).sort((a, b) => b[1] - a[1])[0][0],
      listingCount: group.count,
    }))
    .sort((a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name));
}

/** Fusion : villes avec des biens d'abord, puis le reste de l'API, sans doublon. */
export function mergeCities(withListings: CityOption[], fromApi: string[]): CityOption[] {
  const seen = new Set(withListings.map((city) => cityKey(city.name)));
  const rest: CityOption[] = [];
  fromApi.forEach((name) => {
    const key = cityKey(name);
    if (!name.trim() || seen.has(key)) return;
    seen.add(key);
    rest.push({ name: name.trim(), listingCount: 0 });
  });
  rest.sort((a, b) => a.name.localeCompare(b.name));
  return [...withListings, ...rest];
}
