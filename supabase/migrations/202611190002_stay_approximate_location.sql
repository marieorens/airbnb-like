-- Séjours : emplacement approximatif avant la réservation.
--
-- Décision produit : pour un séjour (`transaction_type = 'booking'`), les
-- visiteurs ne voient qu'une zone d'environ 500 m. Le point exact et l'adresse
-- détaillée (rue, repère) ne sont visibles que par l'hôte, les administrateurs et
-- les voyageurs dont la réservation est confirmée. Ventes, locations et
-- parcelles gardent leur adresse exacte : on doit pouvoir aller voir le bien.
--
-- `listings` est lisible par tous : masquer l'adresse à l'écran ne suffit pas.
-- Le point exact quitte donc la table publique pour `listing_private_locations`,
-- protégée par RLS. Dans `listings`, un déclencheur le remplace par un point
-- décalé de 150 à 450 m (direction et distance fixes, propres à chaque annonce),
-- et efface `address_details`. Le web et le mobile n'ont rien à changer pour
-- publier ; le cercle de 500 m affiché autour du point public contient toujours
-- le vrai emplacement.

-- 1. Table privée -------------------------------------------------------------

create table if not exists public.listing_private_locations (
  listing_id uuid primary key
    -- Différée : la ligne est écrite pendant l'insertion de l'annonce, avant que
    -- celle-ci n'existe pour la contrainte.
    references public.listings(id) on delete cascade deferrable initially deferred,
  latitude double precision,
  longitude double precision,
  address_details text,
  updated_at timestamptz not null default now()
);

alter table public.listing_private_locations enable row level security;

-- Lecture seule pour les clients : seul le déclencheur écrit.
drop policy if exists "Hosts, admins and confirmed guests read exact location" on public.listing_private_locations;
create policy "Hosts, admins and confirmed guests read exact location"
on public.listing_private_locations for select
using (
  public.is_admin()
  or exists (
    select 1 from public.listings l
    where l.id = listing_private_locations.listing_id
      and l.host_id = auth.uid()
  )
  or exists (
    select 1 from public.bookings b
    where b.listing_id = listing_private_locations.listing_id
      and b.guest_id = auth.uid()
      and b.status in ('confirmed', 'completed')
  )
);

-- 2. Point approximatif -------------------------------------------------------

-- Décalage déterministe : la même annonce donne toujours le même point, sinon
-- plusieurs lectures permettraient de trianguler le vrai emplacement.
create or replace function public.approximate_point(
  listing_id uuid,
  lat double precision,
  lng double precision,
  out approx_lat double precision,
  out approx_lng double precision
)
language sql
immutable
as $$
  with seed as (
    select abs(hashtextextended(listing_id::text, 0)) as h
  ),
  offset_m as (
    select
      radians((h % 360)::double precision) as angle,
      150 + ((h / 360) % 300)::double precision as distance
    from seed
  )
  select
    lat + (distance / 111320.0) * cos(angle),
    lng + (distance / (111320.0 * greatest(cos(radians(lat)), 0.01))) * sin(angle)
  from offset_m;
$$;

-- 3. Annonces existantes ------------------------------------------------------
-- Avant la création du déclencheur, qui prendrait sinon le point décalé pour
-- le point exact.

insert into public.listing_private_locations (listing_id, latitude, longitude, address_details)
select id, latitude, longitude, address_details
from public.listings
where transaction_type = 'booking'
on conflict (listing_id) do nothing;

-- Dans un SET, chaque expression lit les valeurs d'origine de la ligne.
update public.listings
set latitude = (public.approximate_point(id, latitude, longitude)).approx_lat,
    longitude = (public.approximate_point(id, latitude, longitude)).approx_lng,
    address_details = null
where transaction_type = 'booking'
  and latitude is not null
  and longitude is not null;

update public.listings
set address_details = null
where transaction_type = 'booking'
  and address_details is not null;

-- 4. Déclencheur --------------------------------------------------------------

create or replace function public.protect_stay_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exact_lat double precision;
  exact_lng double precision;
  exact_address text;
  approx record;
begin
  if new.transaction_type <> 'booking' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.latitude is not distinct from old.latitude
     and new.longitude is not distinct from old.longitude
     and new.address_details is not distinct from old.address_details then
    -- Rien ne touche à l'emplacement (ex. : enregistrement des traductions).
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Les valeurs inchangées sont les valeurs publiques (décalées) : on reprend
    -- les valeurs exactes déjà connues.
    select latitude, longitude, address_details
      into exact_lat, exact_lng, exact_address
    from public.listing_private_locations
    where listing_id = new.id;

    if new.latitude is distinct from old.latitude
       or new.longitude is distinct from old.longitude then
      exact_lat := new.latitude;
      exact_lng := new.longitude;
    end if;
    if new.address_details is distinct from old.address_details then
      exact_address := new.address_details;
    end if;
  else
    exact_lat := new.latitude;
    exact_lng := new.longitude;
    exact_address := new.address_details;
  end if;

  insert into public.listing_private_locations (listing_id, latitude, longitude, address_details, updated_at)
  values (new.id, exact_lat, exact_lng, exact_address, now())
  on conflict (listing_id) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    address_details = excluded.address_details,
    updated_at = now();

  if exact_lat is not null and exact_lng is not null then
    select * into approx from public.approximate_point(new.id, exact_lat, exact_lng);
    new.latitude := approx.approx_lat;
    new.longitude := approx.approx_lng;
  end if;
  new.address_details := null;

  return new;
end;
$$;

drop trigger if exists listings_protect_stay_location on public.listings;
create trigger listings_protect_stay_location
before insert or update on public.listings
for each row execute function public.protect_stay_location();
