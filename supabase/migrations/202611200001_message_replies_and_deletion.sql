-- Messagerie : répondre à un message précis, et supprimer ses propres messages.
--
-- Décisions validées :
--   - `reply_to_id` cite un message du même fil (glisser vers la droite sur
--     mobile, bouton « Répondre » sur le web) ;
--   - la suppression ne concerne que ses propres messages. Le texte est effacé
--     en base et une trace « Message supprimé » reste dans le fil, pour que les
--     réponses qui le citaient restent compréhensibles.
--
-- Les clients n'ont toujours aucun droit d'update ni de delete sur `messages` :
-- la suppression passe uniquement par la fonction `delete_message`.

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists deleted_at timestamptz;

create index if not exists messages_reply_to_idx
  on public.messages (reply_to_id)
  where reply_to_id is not null;

-- Un message supprimé n'a plus de texte.
alter table public.messages drop constraint if exists messages_body_length;
alter table public.messages add constraint messages_body_length check (
  (deleted_at is null and char_length(btrim(body)) between 1 and 4000)
  or (deleted_at is not null and body = '')
);

-- Envoi : la citation doit appartenir au même fil, et un message naît non supprimé.
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
  and deleted_at is null
  and (
    reply_to_id is null
    or exists (
      select 1
      from public.messages quoted
      where quoted.id = messages.reply_to_id
        and quoted.conversation_id = messages.conversation_id
    )
  )
);

-- Suppression de l'un de ses messages : texte effacé, trace conservée.
create or replace function public.delete_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages
  set body = '', deleted_at = now()
  where id = delete_message.message_id
    and sender_id = auth.uid()
    and deleted_at is null;

  if not found then
    raise exception 'message_not_deletable' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;
