-- Suivi de l'email de décision sur un dossier de vérification.
--
-- Avant : si l'email ne partait pas (configuration, Gmail…), seul
-- l'administrateur le voyait, une fois, puis plus rien ne s'en souvenait.
-- Désormais le back-office enregistre le résultat de chaque tentative, affiche
-- les membres jamais prévenus et permet de renvoyer l'email.
--
--   verification_email_sent_at : date du dernier envoi réussi pour la décision
--                                en cours (remise à zéro à chaque décision) ;
--   verification_email_error   : code du dernier échec, null si l'envoi a réussi.
--
-- Écrites uniquement par le back-office (clé service role) : le déclencheur
-- `protect_profile_privileged_columns` les interdit aux utilisateurs.

alter table public.profiles
  add column if not exists verification_email_sent_at timestamptz,
  add column if not exists verification_email_error text;

-- Les décisions déjà prises avant cette migration : on ne sait pas si l'email
-- est parti. On les laisse sans date ni erreur (« inconnu » dans le back-office).

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
     or new.verification_reviewed_by is distinct from old.verification_reviewed_by
     or new.verification_email_sent_at is distinct from old.verification_email_sent_at
     or new.verification_email_error is distinct from old.verification_email_error then
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
