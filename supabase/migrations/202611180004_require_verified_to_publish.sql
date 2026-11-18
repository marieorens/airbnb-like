-- Comptes et vérification d'identité (2/2) : publier exige un compte validé.
--
-- À appliquer APRÈS la mise en ligne des écrans de vérification (web, mobile)
-- et de la page « Vérifications » du back-office. Sinon, toute publication
-- échoue sans que l'utilisateur sache pourquoi, et aucun dossier ne peut être
-- validé.
--
-- Décision produit : les annonces déjà publiées restent en ligne ; un compte non
-- validé ne peut plus en créer de nouvelles. Réserver un séjour ne demande
-- toujours qu'un profil complet.

create or replace function public.profile_is_verified(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = profile_id
      and verification_status = 'approved'
  );
$$;

drop policy if exists "Complete profiles create own listings" on public.listings;
drop policy if exists "Verified profiles create own listings" on public.listings;
create policy "Verified profiles create own listings"
on public.listings for insert
with check (
  host_id = auth.uid()
  and public.profile_is_complete(auth.uid())
  and public.profile_is_verified(auth.uid())
);
