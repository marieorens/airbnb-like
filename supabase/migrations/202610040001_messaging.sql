-- Messagerie interne : un fil par couple (annonce, demandeur).
--
-- Objectif produit : que le vendeur ou l'hôte n'ait plus à basculer sur
-- WhatsApp. Le fil est ancré sur une annonce, ce qui donne le contexte et rend
-- les règles RLS simples : les participants sont le demandeur et le
-- propriétaire de l'annonce.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  -- Dénormalisé pour trier les fils sans agréger les messages.
  last_message_at timestamptz not null default now(),
  -- Suffit à calculer les non-lus, sans statut par message.
  guest_last_read_at timestamptz,
  host_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_distinct_participants check (guest_id <> host_id),
  constraint conversations_unique_thread unique (listing_id, guest_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 4000)
);

create index if not exists conversations_guest_last_message_idx
  on public.conversations (guest_id, last_message_at desc);

create index if not exists conversations_host_last_message_idx
  on public.conversations (host_id, last_message_at desc);

create index if not exists conversations_listing_idx
  on public.conversations (listing_id);

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

-- Remonte le fil dès qu'un message arrive.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation();

-- Vrai lorsque l'utilisateur courant participe au fil.
create or replace function public.is_conversation_participant(conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = is_conversation_participant.conversation_id
      and (c.guest_id = auth.uid() or c.host_id = auth.uid())
  );
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Participants read own conversations" on public.conversations;
create policy "Participants read own conversations"
on public.conversations for select
using (guest_id = auth.uid() or host_id = auth.uid());

-- Seul le demandeur ouvre un fil, et uniquement sur une annonce publiée.
-- `host_id` est vérifié contre l'annonce : impossible de le forger.
drop policy if exists "Guests open conversations on published listings" on public.conversations;
create policy "Guests open conversations on published listings"
on public.conversations for insert
with check (
  guest_id = auth.uid()
  and guest_id <> host_id
  and exists (
    select 1
    from public.listings l
    where l.id = conversations.listing_id
      and l.status = 'published'
      and l.host_id = conversations.host_id
  )
);

-- Sert uniquement à poser son propre horodatage de lecture.
drop policy if exists "Participants update own conversations" on public.conversations;
create policy "Participants update own conversations"
on public.conversations for update
using (guest_id = auth.uid() or host_id = auth.uid())
with check (guest_id = auth.uid() or host_id = auth.uid());

drop policy if exists "Participants read conversation messages" on public.messages;
create policy "Participants read conversation messages"
on public.messages for select
using (public.is_conversation_participant(conversation_id));

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
);

-- Aucune politique d'update ni de delete : un message envoyé reste au fil.
-- La modération passera par le backoffice, qui utilise la clé service role et
-- n'est donc pas soumis à RLS.

-- Diffusion temps réel. L'ajout est idempotent : `alter publication` échoue si
-- la table y figure déjà.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end
$$;
