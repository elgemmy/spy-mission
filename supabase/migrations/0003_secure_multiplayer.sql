-- Full room state remains server-only. Authenticated players receive a
-- role-filtered projection from the Vercel room API and use this membership
-- table only to authorize private Realtime change notifications.

alter table public.rooms
  add column if not exists invite_hash text;

alter table public.rooms enable row level security;
revoke all privileges on public.rooms from anon, authenticated;
grant select, insert, update, delete on public.rooms to service_role;

create table if not exists public.room_members (
  room_id text not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_members_user_id_idx
  on public.room_members (user_id);

alter table public.room_members enable row level security;
revoke all privileges on public.room_members from public, anon, authenticated;
grant select on public.room_members to authenticated;
grant select, insert, update, delete on public.room_members to service_role;

drop policy if exists "members read own room memberships"
  on public.room_members;
create policy "members read own room memberships"
  on public.room_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- These transaction helpers are callable only by the server credential. They
-- are SECURITY INVOKER functions, so they do not introduce an RLS-bypass path.
create or replace function public.server_create_room(
  p_id text,
  p_code text,
  p_host_id uuid,
  p_visibility text,
  p_state jsonb,
  p_ui jsonb,
  p_version integer,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_invite_hash text
)
returns public.rooms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created public.rooms;
begin
  insert into public.rooms (
    id, code, host_id, visibility, state, ui, version,
    created_at, updated_at, invite_hash
  ) values (
    p_id, p_code, p_host_id::text, p_visibility, p_state, p_ui, p_version,
    p_created_at, p_updated_at, p_invite_hash
  )
  returning * into created;

  insert into public.room_members (room_id, user_id)
  values (p_id, p_host_id);

  return created;
end;
$$;

create or replace function public.server_join_room(
  p_room_id text,
  p_user_id uuid,
  p_state jsonb,
  p_ui jsonb,
  p_expected_version integer,
  p_updated_at timestamptz
)
returns public.rooms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated public.rooms;
begin
  update public.rooms
  set state = p_state,
      ui = p_ui,
      version = version + 1,
      updated_at = p_updated_at
  where id = p_room_id
    and version = p_expected_version
  returning * into updated;

  if updated.id is null then
    raise exception 'room version conflict' using errcode = '40001';
  end if;

  insert into public.room_members (room_id, user_id)
  values (p_room_id, p_user_id)
  on conflict (room_id, user_id) do nothing;

  return updated;
end;
$$;

create or replace function public.server_update_room(
  p_room_id text,
  p_host_id uuid,
  p_visibility text,
  p_state jsonb,
  p_ui jsonb,
  p_expected_version integer,
  p_updated_at timestamptz,
  p_invite_hash text,
  p_removed_user_id uuid
)
returns public.rooms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated public.rooms;
begin
  update public.rooms
  set host_id = p_host_id::text,
      visibility = p_visibility,
      state = p_state,
      ui = p_ui,
      version = version + 1,
      updated_at = p_updated_at,
      invite_hash = p_invite_hash
  where id = p_room_id
    and version = p_expected_version
  returning * into updated;

  if updated.id is null then
    raise exception 'room version conflict' using errcode = '40001';
  end if;

  if p_removed_user_id is not null then
    delete from public.room_members
    where room_id = p_room_id
      and user_id = p_removed_user_id;
  end if;

  return updated;
end;
$$;

create or replace function public.server_rotate_room_invite(
  p_room_id text,
  p_expected_version integer,
  p_invite_hash text
)
returns public.rooms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated public.rooms;
begin
  update public.rooms
  set invite_hash = p_invite_hash
  where id = p_room_id
    and version = p_expected_version
  returning * into updated;

  if updated.id is null then
    raise exception 'room version conflict' using errcode = '40001';
  end if;

  return updated;
end;
$$;

create or replace function public.server_delete_room(p_room_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.rooms where id = p_room_id;
$$;

revoke execute on function public.server_create_room(
  text, text, uuid, text, jsonb, jsonb, integer, timestamptz, timestamptz, text
) from public, anon, authenticated;
revoke execute on function public.server_join_room(
  text, uuid, jsonb, jsonb, integer, timestamptz
) from public, anon, authenticated;
revoke execute on function public.server_update_room(
  text, uuid, text, jsonb, jsonb, integer, timestamptz, text, uuid
) from public, anon, authenticated;
revoke execute on function public.server_rotate_room_invite(text, integer, text)
  from public, anon, authenticated;
revoke execute on function public.server_delete_room(text)
  from public, anon, authenticated;

grant execute on function public.server_create_room(
  text, text, uuid, text, jsonb, jsonb, integer, timestamptz, timestamptz, text
) to service_role;
grant execute on function public.server_join_room(
  text, uuid, jsonb, jsonb, integer, timestamptz
) to service_role;
grant execute on function public.server_update_room(
  text, uuid, text, jsonb, jsonb, integer, timestamptz, text, uuid
) to service_role;
grant execute on function public.server_rotate_room_invite(text, integer, text)
  to service_role;
grant execute on function public.server_delete_room(text)
  to service_role;

-- Only authenticated room members can receive the private change signal. The
-- payload contains a version number, never room state or card identities.
drop policy if exists "room members receive room changes"
  on realtime.messages;
create policy "room members receive room changes"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1
      from public.room_members
      where room_members.user_id = (select auth.uid())
        and ('room:' || room_members.room_id) = (select realtime.topic())
    )
  );

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.notify_room_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_id text;
  changed_version integer;
begin
  if tg_op = 'DELETE' then
    changed_id := old.id;
    changed_version := old.version;
  else
    changed_id := new.id;
    changed_version := new.version;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'version', changed_version,
      'deleted', tg_op = 'DELETE'
    ),
    'room_changed',
    'room:' || changed_id,
    true
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_room_changed()
  from public, anon, authenticated, service_role;

drop trigger if exists rooms_notify_change on public.rooms;
create trigger rooms_notify_change
after insert or update or delete on public.rooms
for each row execute function private.notify_room_changed();

-- Raw Postgres Changes are no longer used. Keeping rooms out of the
-- publication prevents accidental full-row streaming if policies change.
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime drop table public.rooms;
  end if;
end;
$$;

comment on table public.rooms is
  'Server-only Codenames state. Browser clients receive role-filtered snapshots from /api/rooms.';
comment on table public.room_members is
  'Room membership used by the server and private Realtime authorization.';
