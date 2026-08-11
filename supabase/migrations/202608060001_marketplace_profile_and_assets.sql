alter table public.profiles
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists country_of_residence text,
  add column if not exists city_of_residence text,
  add column if not exists country_of_origin text,
  add column if not exists account_purpose text[] not null default '{}',
  add column if not exists preferred_contact text not null default 'email',
  add column if not exists bio text,
  add column if not exists profile_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_preferred_contact_check;

alter table public.profiles
  add constraint profiles_preferred_contact_check
  check (preferred_contact in ('email', 'phone', 'whatsapp'));

alter table public.listings
  add column if not exists asset_type text not null default 'short_stay',
  add column if not exists transaction_type text not null default 'booking',
  add column if not exists currency text not null default 'USD',
  add column if not exists sale_price integer,
  add column if not exists monthly_rent integer,
  add column if not exists area_sqm numeric,
  add column if not exists land_title_status text,
  add column if not exists property_condition text,
  add column if not exists available_from date,
  add column if not exists address_details text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_whatsapp text,
  add column if not exists contact_email text;

alter table public.listings
  drop constraint if exists listings_asset_type_check,
  drop constraint if exists listings_transaction_type_check,
  drop constraint if exists listings_sale_price_check,
  drop constraint if exists listings_monthly_rent_check;

alter table public.listings
  add constraint listings_asset_type_check
  check (asset_type in ('short_stay', 'house_rent', 'house_sale', 'land_sale', 'commercial_rent', 'commercial_sale', 'other')),
  add constraint listings_transaction_type_check
  check (transaction_type in ('booking', 'rent', 'sale', 'lead')),
  add constraint listings_sale_price_check
  check (sale_price is null or sale_price > 0),
  add constraint listings_monthly_rent_check
  check (monthly_rent is null or monthly_rent > 0);

create table if not exists public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_asset_transaction_status_idx
  on public.listings (asset_type, transaction_type, status, created_at desc);

create index if not exists listing_inquiries_seller_created_at_idx
  on public.listing_inquiries (seller_id, created_at desc);

drop trigger if exists listing_inquiries_set_updated_at on public.listing_inquiries;
create trigger listing_inquiries_set_updated_at
before update on public.listing_inquiries
for each row execute function public.set_updated_at();

create or replace function public.profile_is_complete(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = profile_id
      and nullif(trim(coalesce(full_name, '')), '') is not null
      and nullif(trim(coalesce(email, '')), '') is not null
      and nullif(trim(coalesce(phone, '')), '') is not null
      and nullif(trim(coalesce(country_of_residence, '')), '') is not null
      and nullif(trim(coalesce(city_of_residence, '')), '') is not null
      and nullif(trim(coalesce(country_of_origin, '')), '') is not null
      and coalesce(array_length(account_purpose, 1), 0) > 0
      and profile_completed_at is not null
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    whatsapp,
    country_of_residence,
    city_of_residence,
    country_of_origin,
    account_purpose,
    preferred_contact
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'country_of_residence',
    new.raw_user_meta_data->>'city_of_residence',
    new.raw_user_meta_data->>'country_of_origin',
    coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data->'account_purpose')),
      '{}'
    ),
    coalesce(new.raw_user_meta_data->>'preferred_contact', 'email')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    phone = coalesce(public.profiles.phone, excluded.phone),
    whatsapp = coalesce(public.profiles.whatsapp, excluded.whatsapp),
    country_of_residence = coalesce(public.profiles.country_of_residence, excluded.country_of_residence),
    city_of_residence = coalesce(public.profiles.city_of_residence, excluded.city_of_residence),
    country_of_origin = coalesce(public.profiles.country_of_origin, excluded.country_of_origin),
    account_purpose = case
      when coalesce(array_length(public.profiles.account_purpose, 1), 0) > 0 then public.profiles.account_purpose
      else excluded.account_purpose
    end,
    preferred_contact = coalesce(public.profiles.preferred_contact, excluded.preferred_contact);

  return new;
end;
$$;

drop policy if exists "Hosts create own listings" on public.listings;
create policy "Complete profiles create own listings"
on public.listings for insert
with check (host_id = auth.uid() and public.profile_is_complete(auth.uid()));

alter table public.listing_inquiries enable row level security;

create policy "Published listing inquiries can be created"
on public.listing_inquiries for insert
with check (
  exists (
    select 1
    from public.listings
    where listings.id = listing_inquiries.listing_id
      and listings.status = 'published'
  )
);

create policy "Inquiry owners and admins can read"
on public.listing_inquiries for select
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or public.is_admin()
);

create policy "Sellers and admins update inquiries"
on public.listing_inquiries for update
using (seller_id = auth.uid() or public.is_admin())
with check (seller_id = auth.uid() or public.is_admin());
