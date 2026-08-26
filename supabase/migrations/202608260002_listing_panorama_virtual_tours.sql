alter table if exists public.listing_virtual_tours
  drop constraint if exists listing_virtual_tours_provider_check;

alter table if exists public.listing_virtual_tours
  add column if not exists source_type text not null default 'external',
  add column if not exists preview_image_url text,
  add column if not exists room_label text,
  add column if not exists position integer not null default 0;

create index if not exists listing_virtual_tours_listing_position_idx
  on public.listing_virtual_tours (listing_id, position);

alter table if exists public.listing_virtual_tours
  add constraint listing_virtual_tours_provider_check
  check (provider in ('matterport', 'kuula', 'cloudpano', 'panorama', 'other'));

alter table if exists public.listing_virtual_tours
  drop constraint if exists listing_virtual_tours_source_type_check;

alter table if exists public.listing_virtual_tours
  add constraint listing_virtual_tours_source_type_check
  check (source_type in ('external', 'panorama'));

insert into storage.buckets (id, name, public)
values ('listing-virtual-tours', 'listing-virtual-tours', true)
on conflict (id) do nothing;

drop policy if exists "Public virtual tour files are readable" on storage.objects;
create policy "Public virtual tour files are readable"
on storage.objects for select
using (bucket_id = 'listing-virtual-tours');

drop policy if exists "Users upload own virtual tour files" on storage.objects;
create policy "Users upload own virtual tour files"
on storage.objects for insert
with check (
  bucket_id = 'listing-virtual-tours'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users update own virtual tour files" on storage.objects;
create policy "Users update own virtual tour files"
on storage.objects for update
using (
  bucket_id = 'listing-virtual-tours'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'listing-virtual-tours'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users delete own virtual tour files" on storage.objects;
create policy "Users delete own virtual tour files"
on storage.objects for delete
using (
  bucket_id = 'listing-virtual-tours'
  and auth.uid()::text = (storage.foldername(name))[1]
);
