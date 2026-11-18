-- Confidentialité des profils.
--
-- La politique « Profiles are readable » (using true) rendait chaque profil
-- entièrement lisible par n'importe qui, visiteur anonyme compris : email,
-- téléphone, WhatsApp, résidence, présentation, statut de vérification…
--
-- Désormais :
--   - `profiles` n'est lisible que par son propriétaire et les administrateurs ;
--   - la vue `public_profiles` expose le strict nécessaire à l'affichage d'un
--     autre membre (hôte d'une annonce, interlocuteur d'une conversation) ;
--   - les annonces ne recopient plus le téléphone, l'email ni le WhatsApp de
--     l'hôte, lisibles par tous via `listings`. Aucun écran ne les affichait
--     depuis l'arrivée de la messagerie ; le profil garde ces informations.
--
-- À appliquer APRÈS le déploiement des versions web et mobile qui lisent
-- `public_profiles` : les anciennes versions afficheraient « un membre » à la
-- place du nom de l'hôte.

-- 1. Vue publique -------------------------------------------------------------
-- Une vue s'exécute avec les droits de son propriétaire : elle contourne la RLS
-- de `profiles`, c'est voulu, et ne laisse passer que les colonnes listées.

create or replace view public.public_profiles as
select
  id,
  full_name,
  avatar_url,
  account_type,
  company_name,
  verification_status = 'approved' as is_verified
from public.profiles;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

-- 2. Profils privés -----------------------------------------------------------

drop policy if exists "Profiles are readable" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

-- 3. Coordonnées recopiées dans les annonces -----------------------------------

update public.listings
set contact_phone = null,
    contact_email = null,
    contact_whatsapp = null
where contact_phone is not null
   or contact_email is not null
   or contact_whatsapp is not null;
