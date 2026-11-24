-- Devise préférée du membre (décision validée : profil + appareil).
--
-- Choisie dans les paramètres du web et du mobile. Les prix sont alors affichés
-- convertis dans cette devise (« ≈ »), le prix d'origine restant visible sur le
-- détail et au paiement : on paie toujours dans la devise de l'annonce.
--
-- null = pas de préférence : chaque prix reste dans la devise de son annonce.
-- Un visiteur non connecté garde son choix sur son appareil (cookie sur le web,
-- AsyncStorage sur le mobile) ; une fois connecté, le profil fait foi.
--
-- Modifiable par le membre lui-même via la policy d'update existante sur
-- `profiles` : aucune policy à ajouter.

alter table public.profiles
  add column if not exists preferred_currency text;

alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
alter table public.profiles add constraint profiles_preferred_currency_check
  check (preferred_currency is null or preferred_currency in ('USD', 'EUR', 'XOF'));
