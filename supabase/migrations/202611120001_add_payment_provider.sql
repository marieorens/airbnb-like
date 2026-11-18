-- Migration pour supporter plusieurs passerelles de paiement (Stripe, Kkiapay, etc.)
alter table public.payments
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_transaction_id text;

create index if not exists payments_provider_idx on public.payments (provider);

-- Une transaction externe ne peut etre enregistree qu'une seule fois.
-- Les lignes Stripe ont `provider_transaction_id = null` : PostgreSQL autorise
-- plusieurs NULL dans un index unique, elles ne sont donc pas concernees.
drop index if exists public.payments_provider_transaction_id_idx;
create unique index if not exists payments_provider_transaction_id_key
  on public.payments (provider, provider_transaction_id);
