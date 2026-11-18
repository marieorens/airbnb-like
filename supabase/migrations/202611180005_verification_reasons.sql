-- Motifs de refus d'un dossier de vérification, choisis dans une liste fixe.
--
-- Le back-office coche un ou plusieurs motifs ; ils sont stockés sous forme de
-- codes pour être affichés dans la langue de chaque utilisateur (web, mobile)
-- et dans l'email bilingue envoyé après la décision. `verification_note` reste
-- un complément libre, facultatif.
--
-- Sans effet sur l'existant : à appliquer avant de déployer le back-office.

alter table public.profiles
  add column if not exists verification_reasons text[] not null default '{}'
    check (verification_reasons <@ array[
      'unreadable',        -- document illisible ou flou
      'expired',           -- document expiré
      'name_mismatch',     -- le nom ne correspond pas au profil
      'incomplete',        -- document manquant ou incomplet
      'wrong_document',    -- document non conforme
      'company_mismatch'   -- documents sans rapport avec l'agence déclarée
    ]::text[]);

-- Remplace la version de la migration 202611180003 : `verification_reasons`
-- fait partie de la décision, que seule la modération renseigne.
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
     or new.verification_reasons is distinct from old.verification_reasons
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
