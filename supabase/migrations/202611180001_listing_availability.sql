-- Recherche par dates dans le catalogue.
--
-- Les politiques RLS de `bookings` ne laissent lire à chacun que ses propres
-- réservations (c'est voulu). Le catalogue ne pouvait donc jamais savoir qu'une
-- annonce était prise sur une période, et le filtre par dates ne retirait rien.
--
-- Cette fonction répond seulement « quelles annonces publiées sont occupées
-- entre ces deux dates ? », sans exposer les réservations elles-mêmes (ni
-- voyageur, ni montant, ni dates exactes). Elle reprend la règle de conflit de
-- `createCheckout` (services/checkout.ts) :
--   - les réservations annulées ou remboursées ne bloquent pas ;
--   - une réservation `pending_payment` de plus d'une heure est un paiement
--     abandonné et ne bloque plus ;
--   - les deux journées bornes comptent (début ≤ fin demandée et fin ≥ début demandé).

create or replace function public.unavailable_listing_ids(start_date date, end_date date)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct b.listing_id
  from public.bookings b
  join public.listings l on l.id = b.listing_id and l.status = 'published'
  where start_date <= end_date
    -- Garde-fou : une recherche porte au plus sur un an.
    and end_date - start_date <= 366
    and b.status not in ('cancelled_by_guest', 'cancelled_by_host', 'refunded')
    and not (b.status = 'pending_payment' and b.created_at < now() - interval '1 hour')
    and b.check_in <= end_date
    and b.check_out >= start_date;
$$;

revoke all on function public.unavailable_listing_ids(date, date) from public;
grant execute on function public.unavailable_listing_ids(date, date) to anon, authenticated;

create index if not exists bookings_listing_dates_idx
  on public.bookings (listing_id, check_in, check_out);
