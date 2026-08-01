create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  role text not null default 'guest' check (role in ('guest', 'host', 'admin')),
  is_host boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  type text,
  country text,
  region text,
  latitude double precision,
  longitude double precision,
  price_per_night integer not null check (price_per_night > 0),
  guest_count integer not null default 1 check (guest_count > 0),
  room_count integer not null default 1 check (room_count > 0),
  bathroom_count integer not null default 1 check (bathroom_count > 0),
  amenities text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  public_url text,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  night_count integer not null check (night_count > 0),
  price_per_night integer not null check (price_per_night > 0),
  total_price integer not null check (total_price > 0),
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'confirmed', 'cancelled_by_guest', 'cancelled_by_host', 'completed', 'refunded')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out >= check_in)
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount integer not null check (amount > 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index reviews_booking_reviewer_unique
  on public.reviews (booking_id, reviewer_id)
  where booking_id is not null;

create index listings_status_created_at_idx on public.listings (status, created_at desc);
create index listings_host_id_idx on public.listings (host_id);
create index listing_photos_listing_position_idx on public.listing_photos (listing_id, position);
create index bookings_guest_id_created_at_idx on public.bookings (guest_id, created_at desc);
create index bookings_host_id_created_at_idx on public.bookings (host_id, created_at desc);
create index bookings_listing_dates_idx on public.bookings (listing_id, check_in, check_out);
create index wishlists_user_id_idx on public.wishlists (user_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.bookings enable row level security;
alter table public.wishlists enable row level security;
alter table public.reviews enable row level security;
alter table public.payments enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "Profiles are readable"
on public.profiles for select
using (true);

create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Admins manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Published listings are public"
on public.listings for select
using (status = 'published' or host_id = auth.uid() or public.is_admin());

create policy "Hosts create own listings"
on public.listings for insert
with check (host_id = auth.uid());

create policy "Hosts update own listings"
on public.listings for update
using (host_id = auth.uid() or public.is_admin())
with check (host_id = auth.uid() or public.is_admin());

create policy "Hosts delete own listings"
on public.listings for delete
using (host_id = auth.uid() or public.is_admin());

create policy "Visible listing photos are readable"
on public.listing_photos for select
using (
  exists (
    select 1 from public.listings
    where listings.id = listing_photos.listing_id
      and (listings.status = 'published' or listings.host_id = auth.uid() or public.is_admin())
  )
);

create policy "Hosts manage own listing photos"
on public.listing_photos for all
using (
  exists (
    select 1 from public.listings
    where listings.id = listing_photos.listing_id
      and (listings.host_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.listings
    where listings.id = listing_photos.listing_id
      and (listings.host_id = auth.uid() or public.is_admin())
  )
);

create policy "Users and hosts read bookings"
on public.bookings for select
using (guest_id = auth.uid() or host_id = auth.uid() or public.is_admin());

create policy "Guests create own bookings"
on public.bookings for insert
with check (guest_id = auth.uid());

create policy "Guests hosts admins update bookings"
on public.bookings for update
using (guest_id = auth.uid() or host_id = auth.uid() or public.is_admin())
with check (guest_id = auth.uid() or host_id = auth.uid() or public.is_admin());

create policy "Users manage own wishlist"
on public.wishlists for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "Published listing reviews are public"
on public.reviews for select
using (
  public.is_admin()
  or exists (
    select 1 from public.listings
    where listings.id = reviews.listing_id
      and listings.status = 'published'
  )
);

create policy "Guests review completed bookings"
on public.reviews for insert
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from public.bookings
    where bookings.id = reviews.booking_id
      and bookings.guest_id = auth.uid()
      and bookings.status = 'completed'
  )
);

create policy "Admins moderate reviews"
on public.reviews for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users hosts admins read payments"
on public.payments for select
using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.bookings
    where bookings.id = payments.booking_id
      and bookings.host_id = auth.uid()
  )
);

create policy "Admins read audit logs"
on public.admin_audit_logs for select
using (public.is_admin());

insert into storage.buckets (id, name, public)
values
  ('listing-photos', 'listing-photos', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public listing photo files are readable"
on storage.objects for select
using (bucket_id = 'listing-photos');

create policy "Users upload listing photos to own folder"
on storage.objects for insert
with check (
  bucket_id = 'listing-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users update own listing photo files"
on storage.objects for update
using (
  bucket_id = 'listing-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'listing-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users delete own listing photo files"
on storage.objects for delete
using (
  bucket_id = 'listing-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Avatar files are readable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users manage own avatar files"
on storage.objects for all
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
