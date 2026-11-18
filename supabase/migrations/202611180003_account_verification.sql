-- Comptes et vérification d'identité (1/2) : schéma, sans effet sur l'existant.
--
-- Parcours validé par le produit :
--   1. à l'inscription, l'utilisateur choisit « particulier » ou « agence » ;
--   2. il confirme son email par un code à 6 chiffres (Supabase Auth, aucun SQL) ;
--   3. il complète son profil, puis envoie ses documents ;
--   4. un administrateur valide ou refuse le dossier dans le back-office.
--
-- Documents :
--   - particulier : pièce d'identité, recto (+ verso pour une carte d'identité) ;
--   - agence : RCCM, IFU, pièce d'identité du gérant (recto, + verso).
--
-- Cette migration ne bloque encore rien : les comptes existants passent en
-- « non vérifié » et continuent de publier. Le verrou « publier exige un compte
-- validé » viendra dans une seconde migration, appliquée avec les écrans web et
-- mobile, pour que l'utilisateur comprenne pourquoi il est bloqué.
--
-- Les fichiers d'identité vont dans un bucket PRIVÉ et seront supprimés 90 jours
-- après la décision (purge faite par le back-office, via l'API Storage).

-- 1. Profil -------------------------------------------------------------------

alter table public.profiles
  add column if not exists account_type text not null default 'individual'
    check (account_type in ('individual', 'agency')),
  add column if not exists company_name text,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'approved', 'rejected')),
  -- Motif de refus, affiché à l'utilisateur.
  add column if not exists verification_note text,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_reviewed_by uuid references public.profiles(id) on delete set null;

create index if not exists profiles_verification_pending_idx
  on public.profiles (verification_submitted_at)
  where verification_status = 'pending';

-- Le type de compte n'est modifiable que tant que le dossier n'est pas envoyé
-- ou après un refus. Le statut, lui, n'est jamais modifiable par l'utilisateur :
-- seul `submit_verification()` le passe à « en attente », et seul un
-- administrateur (ou le back-office, clé service role) décide ensuite.
create or replace function public.can_edit_verification(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = profile_id
      and verification_status in ('unverified', 'rejected')
  );
$$;

-- Remplace la version de la migration 202611180002 : même règle pour `role`,
-- étendue aux colonnes de vérification.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Modification du rôle refusée.' using errcode = '42501';
  end if;

  -- Seul passage autorisé, et seulement depuis submit_verification().
  if new.verification_status is distinct from old.verification_status
     and not (
       coalesce(current_setting('app.verification_submit', true), '') = 'on'
       and old.verification_status in ('unverified', 'rejected')
       and new.verification_status = 'pending'
     ) then
    raise exception 'Seule la modération change le statut de vérification.' using errcode = '42501';
  end if;

  if new.verification_note is distinct from old.verification_note
     or new.verification_reviewed_at is distinct from old.verification_reviewed_at
     or new.verification_reviewed_by is distinct from old.verification_reviewed_by then
    raise exception 'Seule la modération renseigne la décision.' using errcode = '42501';
  end if;

  if new.verification_submitted_at is distinct from old.verification_submitted_at
     and coalesce(current_setting('app.verification_submit', true), '') <> 'on' then
    raise exception 'Date d''envoi du dossier non modifiable.' using errcode = '42501';
  end if;

  if (new.account_type is distinct from old.account_type
      or new.company_name is distinct from old.company_name)
     and old.verification_status not in ('unverified', 'rejected') then
    raise exception 'Le type de compte ne change plus une fois le dossier envoyé.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 2. Inscription : le type de compte vient des métadonnées --------------------
-- Reprend handle_new_user() de la migration 202608060001, avec account_type et
-- company_name en plus.

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
    preferred_contact,
    account_type,
    company_name
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
    coalesce(new.raw_user_meta_data->>'preferred_contact', 'email'),
    case
      when new.raw_user_meta_data->>'account_type' = 'agency' then 'agency'
      else 'individual'
    end,
    nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '')
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

-- 3. Documents ----------------------------------------------------------------

create table if not exists public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'id_front', 'id_back',                       -- particulier
    'rccm', 'ifu', 'manager_id_front', 'manager_id_back'  -- agence
  )),
  -- Chemin dans le bucket privé `verification-documents`, préfixé par l'UID.
  storage_path text not null,
  created_at timestamptz not null default now(),
  -- Un document par type : en renvoyer un remplace le précédent.
  constraint verification_documents_one_per_kind unique (user_id, kind),
  constraint verification_documents_own_folder
    check (split_part(storage_path, '/', 1) = user_id::text)
);

alter table public.verification_documents enable row level security;

drop policy if exists "Users read own verification documents" on public.verification_documents;
create policy "Users read own verification documents"
on public.verification_documents for select
using (user_id = auth.uid() or public.is_admin());

-- Ajout, remplacement et retrait seulement tant que le dossier est modifiable.
drop policy if exists "Users add own verification documents" on public.verification_documents;
create policy "Users add own verification documents"
on public.verification_documents for insert
with check (user_id = auth.uid() and public.can_edit_verification(auth.uid()));

drop policy if exists "Users replace own verification documents" on public.verification_documents;
create policy "Users replace own verification documents"
on public.verification_documents for update
using (user_id = auth.uid() and public.can_edit_verification(auth.uid()))
with check (user_id = auth.uid() and public.can_edit_verification(auth.uid()));

drop policy if exists "Users remove own verification documents" on public.verification_documents;
create policy "Users remove own verification documents"
on public.verification_documents for delete
using (user_id = auth.uid() and public.can_edit_verification(auth.uid()));

drop policy if exists "Admins manage verification documents" on public.verification_documents;
create policy "Admins manage verification documents"
on public.verification_documents for all
using (public.is_admin())
with check (public.is_admin());

-- 4. Envoi du dossier ---------------------------------------------------------

-- Passe le profil « en attente » si le dossier est complet. Renvoie un code
-- d'erreur stable (traduit par les clients) plutôt qu'un message.
create or replace function public.submit_verification()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.profiles%rowtype;
  kinds text[];
begin
  if auth.uid() is null then
    return 'sign_in';
  end if;

  select * into profile from public.profiles where id = auth.uid();

  if profile.verification_status not in ('unverified', 'rejected') then
    return 'already_submitted';
  end if;
  if not public.profile_is_complete(auth.uid()) then
    return 'profile_incomplete';
  end if;
  if profile.account_type = 'agency' and nullif(trim(coalesce(profile.company_name, '')), '') is null then
    return 'company_name_missing';
  end if;

  select array_agg(kind) into kinds
  from public.verification_documents
  where user_id = auth.uid();
  kinds := coalesce(kinds, '{}');

  if profile.account_type = 'agency' then
    if not (kinds @> array['rccm', 'ifu', 'manager_id_front']) then
      return 'documents_missing';
    end if;
  elsif not (kinds @> array['id_front']) then
    return 'documents_missing';
  end if;

  -- Lève le verrou du déclencheur pour ce seul passage, le temps de la transaction.
  perform set_config('app.verification_submit', 'on', true);
  update public.profiles
  set verification_status = 'pending',
      verification_submitted_at = now()
  where id = auth.uid();
  perform set_config('app.verification_submit', 'off', true);

  return 'ok';
end;
$$;

revoke all on function public.submit_verification() from public;
grant execute on function public.submit_verification() to authenticated;

-- 5. Stockage privé -----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  10485760,  -- 10 Mo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own verification files" on storage.objects;
create policy "Users read own verification files"
on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

drop policy if exists "Users upload own verification files" on storage.objects;
create policy "Users upload own verification files"
on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
  and public.can_edit_verification(auth.uid())
);

drop policy if exists "Users update own verification files" on storage.objects;
create policy "Users update own verification files"
on storage.objects for update
using (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
  and public.can_edit_verification(auth.uid())
)
with check (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users delete own verification files" on storage.objects;
create policy "Users delete own verification files"
on storage.objects for delete
using (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
  and public.can_edit_verification(auth.uid())
);
