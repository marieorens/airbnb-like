-- Traduction automatique des annonces (français / anglais).
--
-- Le texte saisi par l'annonceur reste dans `title` et `description`, sans changement.
-- `translations` contient les deux versions produites par la traduction automatique :
--
--   { "fr": { "title": "...", "description": "..." },
--     "en": { "title": "...", "description": "..." } }
--
-- Vide (`{}`) tant que l'annonce n'a pas été traduite : les clients affichent alors
-- le texte d'origine. Écrite côté serveur par le web (publication, route
-- /api/translate-listing, script de rattrapage) ; la politique « Hosts update own
-- listings » existante suffit, aucune nouvelle policy.

alter table public.listings
  add column if not exists translations jsonb not null default '{}'::jsonb;
