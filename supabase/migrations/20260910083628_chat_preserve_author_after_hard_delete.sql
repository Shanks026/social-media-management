-- Keep a chat log readable after its author is permanently deleted.
--
-- Three things conspired to destroy history when a member was hard-deleted:
--
-- 1. chat_messages.author_user_id had a NO ACTION FK to auth.users, so the
--    delete would fail outright unless the rows were moved first. The
--    workaround in hard_delete_team_member reassigned every message to the
--    OWNER, which does not just lose attribution — it actively misattributes,
--    making the owner appear to have written things they never wrote.
-- 2. Nothing stored the author's name, so even nulling the id left no way to
--    render who spoke.
-- 3. chat_channel_members.user_id cascades on auth deletion, so the DM's
--    other member row vanished and the conversation became unresolvable.
--
-- author_name is snapshotted at insert. That is deliberate rather than a join:
-- the name has to survive the auth.users row being gone, and a chat log should
-- show what someone was called when they spoke.
alter table public.chat_messages add column if not exists author_name text;

-- Last chance to capture names for everyone who still exists. Anyone already
-- hard-deleted is unrecoverable — their messages were rewritten to the owner
-- and nothing recorded the original author.
update public.chat_messages m
set author_name = coalesce(u.raw_user_meta_data->>'full_name', u.email)
from auth.users u
where u.id = m.author_user_id and m.author_name is null;

create or replace function public.tg_chat_message_author_name()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- SECURITY DEFINER because auth.users is not readable by the sender.
  if new.author_name is null and new.author_user_id is not null then
    select coalesce(u.raw_user_meta_data->>'full_name', u.email)
      into new.author_name
    from auth.users u
    where u.id = new.author_user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.tg_chat_message_author_name() from public;
revoke all on function public.tg_chat_message_author_name() from anon;
revoke all on function public.tg_chat_message_author_name() from authenticated;

drop trigger if exists tg_chat_message_author_name on public.chat_messages;
create trigger tg_chat_message_author_name
before insert on public.chat_messages
for each row execute function public.tg_chat_message_author_name();

-- SET NULL rather than NO ACTION, so deleting the author leaves the message
-- standing with its name instead of blocking the delete or forcing a rewrite.
alter table public.chat_messages alter column author_user_id drop not null;
alter table public.chat_messages drop constraint chat_messages_author_user_id_fkey;
alter table public.chat_messages
  add constraint chat_messages_author_user_id_fkey
  foreign key (author_user_id) references auth.users(id) on delete set null;;
