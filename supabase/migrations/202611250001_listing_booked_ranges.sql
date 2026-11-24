-- Périodes occupées d'un séjour, pour griser les dates au calendrier.
--
-- Les réservations d'autrui restent illisibles (RLS sur `bookings`) : cette
-- fonction ne renvoie que des plages de dates, sans voyageur, prix ni statut.
-- Même règle de conflit que le paiement et `unavailable_listing_ids` :
--   - réservations annulées ou remboursées ignorées ;
--   - `pending_payment` de plus d'une heure ignorées (paiement abandonné) ;
--   - les deux journées bornes comptent (check_in et check_out inclus).
-- Seules les périodes qui ne sont pas encore terminées sont renvoyées.

create or replace function public.listing_booked_ranges(p_listing_id uuid)
returns table (check_in date, check_out date)
language sql
stable
security definer
set search_path = public
as $$
  select b.check_in, b.check_out
  from public.bookings b
  join public.listings l on l.id = b.listing_id and l.status = 'published'
  where b.listing_id = p_listing_id
    and b.status not in ('cancelled_by_guest', 'cancelled_by_host', 'refunded')
    and not (b.status = 'pending_payment' and b.created_at < now() - interval '1 hour')
    and b.check_out >= current_date
  order by b.check_in;
$$;

revoke all on function public.listing_booked_ranges(uuid) from public;
grant execute on function public.listing_booked_ranges(uuid) to anon, authenticated;
