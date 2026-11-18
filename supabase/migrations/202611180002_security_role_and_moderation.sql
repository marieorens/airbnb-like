-- Correctifs de sécurité : rôle des profils et modération des annonces.
--
-- Les politiques « Users update own profile » et « Hosts update own listings »
-- autorisent la mise à jour de toutes les colonnes de la ligne. Avec la clé
-- publique, un utilisateur connecté pouvait donc :
--   1. se donner le rôle `admin`, puis profiter des politiques réservées aux
--      administrateurs (paiements, réservations, profils, annonces) ;
--   2. publier lui-même son annonce (`status = 'published'`), à la création ou
--      ensuite, sans passer par la modération.
--
-- Les deux déclencheurs ci-dessous ferment ces accès. Restent autorisés :
--   - les administrateurs (`is_admin()`) ;
--   - les appels sans utilisateur final : clé service role (back-office,
--     webhooks), éditeur SQL et migrations, pour lesquels `auth.uid()` est nul.
--     Un visiteur anonyme ne peut de toute façon rien modifier (RLS).

-- 1. Rôle du profil -----------------------------------------------------------

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

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_columns on public.profiles;
create trigger profiles_protect_privileged_columns
before update on public.profiles
for each row execute function public.protect_profile_privileged_columns();

-- 2. Statut de modération des annonces ----------------------------------------
--
-- Le web et le mobile créent toujours les annonces en `pending_review`, et seul
-- le back-office change ensuite le statut. Un hôte peut toujours modifier le
-- reste de son annonce (texte, prix, traductions…).

create or replace function public.protect_listing_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status not in ('draft', 'pending_review') then
    raise exception 'Une nouvelle annonce doit passer par la modération.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception 'Seule la modération change le statut d''une annonce.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_protect_moderation on public.listings;
create trigger listings_protect_moderation
before insert or update on public.listings
for each row execute function public.protect_listing_moderation();
