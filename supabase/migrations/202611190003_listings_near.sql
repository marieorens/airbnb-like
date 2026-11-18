-- Recherche « Autour de moi » : annonces publiées les plus proches d'un point.
--
-- Seules les annonces dont le repère a été placé à la main sont prises en
-- compte (`city` renseignée) : les plus anciennes n'ont que le centre du pays,
-- ce qui fausserait les distances (voir la migration 202611170001).
--
-- Pour un séjour, la position publique est déjà le point approximatif
-- (migration 202611190002) : la distance renvoyée ne trahit pas l'adresse.
--
-- Formule de haversine, sans PostGIS : largement assez précise à cette échelle.

create or replace function public.listings_near(
  lat double precision,
  lng double precision,
  radius_km double precision default 100,
  max_results integer default 48
)
returns table (listing_id uuid, distance_km double precision)
language sql
stable
set search_path = public
as $$
  select id, distance
  from (
    select
      l.id,
      2 * 6371 * asin(sqrt(
        power(sin(radians(l.latitude - lat) / 2), 2)
        + cos(radians(lat)) * cos(radians(l.latitude))
          * power(sin(radians(l.longitude - lng) / 2), 2)
      )) as distance
    from public.listings l
    where l.status = 'published'
      and l.city is not null
      and l.latitude is not null
      and l.longitude is not null
      -- Préfiltre grossier sur un carré englobant, avant le calcul exact.
      and l.latitude between lat - radius_km / 111.0 and lat + radius_km / 111.0
  ) nearby
  where distance <= least(radius_km, 500)
  order by distance
  limit least(greatest(max_results, 1), 100);
$$;

grant execute on function public.listings_near(double precision, double precision, double precision, integer)
  to anon, authenticated;
