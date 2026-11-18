-- Adresse précise des annonces.
--
-- `region` contient le continent (issu de la liste des pays), pas une région administrative.
-- On ajoute la ville et le quartier / la commune, saisis par l'annonceur à la publication.
-- La rue et le point de repère restent dans `address_details`.
--
-- Les deux colonnes sont facultatives : les annonces existantes et les clients qui ne les
-- envoient pas encore (mobile, ancienne version du web) continuent de fonctionner.
--
-- Une annonce avec `city` renseignée a aussi des coordonnées placées à la main sur la carte.
-- Sans `city`, latitude / longitude ne sont que le centre du pays : ne pas s'en servir pour
-- une recherche par distance.

alter table public.listings
  add column if not exists city text,
  add column if not exists district text;

create index if not exists listings_country_city_idx
  on public.listings (country, lower(city))
  where status = 'published';
