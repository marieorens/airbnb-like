"use client";

import { useQuery } from "@tanstack/react-query";

import { cityKey, fetchApiCities, fetchListingCities, mergeCities } from "@/lib/cities";

type CitySelectLabels = {
  allCities: string;
  citiesWithListings: string;
  otherCities: string;
  citiesLoading: string;
  cityCount: (count: number) => string;
};

interface CitySelectProps {
  /** Pays choisi (`listings.country`) : la liste dépend de lui. */
  country: string;
  value?: string;
  /** Nom du champ, pour un envoi par formulaire GET (filtres du catalogue). */
  name?: string;
  onChange?: (city: string | undefined) => void;
  labels: CitySelectLabels;
  className?: string;
}

/**
 * Ville du pays de recherche : villes avec des biens d'abord (avec leur
 * nombre), puis toutes celles de l'API. Si l'API ne répond pas, il reste
 * au moins les villes des annonces.
 */
const CitySelect = ({ country, value, name, onChange, labels, className }: CitySelectProps) => {
  const listingCities = useQuery({
    queryKey: ["cities", "listings", country],
    queryFn: () => fetchListingCities(country),
  });
  const apiCities = useQuery({
    queryKey: ["cities", "api", country],
    queryFn: () => fetchApiCities(country),
    // La liste des villes d'un pays ne change pas d'un jour à l'autre.
    staleTime: 7 * 24 * 60 * 60 * 1000,
    cacheTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const cities = mergeCities(listingCities.data ?? [], apiCities.data ?? []);
  const withListings = cities.filter((city) => city.listingCount > 0);
  const others = cities.filter((city) => city.listingCount === 0);
  const loading = listingCities.isLoading || apiCities.isLoading;

  // La ville en cours (venue de l'URL) reste sélectionnable même hors liste.
  const current = value?.trim();
  const currentListed = current
    ? cities.some((city) => cityKey(city.name) === cityKey(current))
    : true;
  const selected = current
    ? (cities.find((city) => cityKey(city.name) === cityKey(current))?.name ?? current)
    : "";

  return (
    <select
      name={name}
      value={selected}
      onChange={(event) => onChange?.(event.target.value || undefined)}
      className={className}
    >
      <option value="">{loading && !cities.length ? labels.citiesLoading : labels.allCities}</option>
      {!currentListed && current ? <option value={current}>{current}</option> : null}
      {withListings.length ? (
        <optgroup label={labels.citiesWithListings}>
          {withListings.map((city) => (
            <option key={cityKey(city.name)} value={city.name}>
              {city.name} · {labels.cityCount(city.listingCount)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {others.length ? (
        <optgroup label={labels.otherCities}>
          {others.map((city) => (
            <option key={cityKey(city.name)} value={city.name}>
              {city.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
};

export default CitySelect;
