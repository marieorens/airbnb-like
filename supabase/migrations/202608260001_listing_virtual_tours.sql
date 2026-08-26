create table if not exists public.listing_virtual_tours (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  provider text not null default 'other',
  tour_url text not null,
  embed_url text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_virtual_tours_provider_check
    check (provider in ('matterport', 'kuula', 'cloudpano', 'other')),
  constraint listing_virtual_tours_status_check
    check (status in ('active', 'hidden')),
  constraint listing_virtual_tours_url_check
    check (tour_url ~* '^https?://' and embed_url ~* '^https?://')
);

create index if not exists listing_virtual_tours_listing_id_idx
  on public.listing_virtual_tours (listing_id);

drop trigger if exists listing_virtual_tours_set_updated_at on public.listing_virtual_tours;
create trigger listing_virtual_tours_set_updated_at
before update on public.listing_virtual_tours
for each row execute function public.set_updated_at();

alter table public.listing_virtual_tours enable row level security;

drop policy if exists "Published listing tours are readable" on public.listing_virtual_tours;
create policy "Published listing tours are readable"
on public.listing_virtual_tours for select
using (
  status = 'active'
  and exists (
    select 1
    from public.listings
    where listings.id = listing_virtual_tours.listing_id
      and listings.status = 'published'
  )
);

drop policy if exists "Hosts manage own listing tours" on public.listing_virtual_tours;
create policy "Hosts manage own listing tours"
on public.listing_virtual_tours for all
using (
  exists (
    select 1
    from public.listings
    where listings.id = listing_virtual_tours.listing_id
      and listings.host_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.listings
    where listings.id = listing_virtual_tours.listing_id
      and listings.host_id = auth.uid()
  )
);

drop policy if exists "Admins manage listing tours" on public.listing_virtual_tours;
create policy "Admins manage listing tours"
on public.listing_virtual_tours for all
using (public.is_admin())
with check (public.is_admin());
