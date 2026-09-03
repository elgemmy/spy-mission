-- Forward-only room lifecycle hardening. Migrations 0001..0003 are immutable.

alter table public.room_members
  drop constraint if exists room_members_user_id_fkey;

alter table public.room_members
  add constraint room_members_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete restrict;

alter table public.room_members
  add column if not exists status text,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid;

update public.room_members
set status = 'active'
where status is null;

alter table public.room_members
  alter column status set default 'active',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'room_members_status_check'
      and conrelid = 'public.room_members'::regclass
  ) then
    alter table public.room_members
      add constraint room_members_status_check
      check (status in ('active', 'banned'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'room_members_ban_audit_check'
      and conrelid = 'public.room_members'::regclass
  ) then
    alter table public.room_members
      add constraint room_members_ban_audit_check
      check (
        (status = 'active' and banned_at is null and banned_by is null)
        or (
          status = 'banned'
          and banned_at is not null
          and banned_by is not null
        )
      );
  end if;
end;
$$;

create index if not exists room_members_active_user_idx
  on public.room_members (user_id, room_id)
  where status = 'active';

revoke all privileges on public.rooms from anon, authenticated;
revoke all privileges on public.room_members from anon, authenticated;
grant select on public.room_members to authenticated;

drop policy if exists "members read own room memberships"
  on public.room_members;
create policy "members read own active room memberships"
  on public.room_members
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'active'
  );

drop policy if exists "room members receive room changes"
  on realtime.messages;
create policy "active room members receive room changes"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1
      from public.room_members
      where room_members.user_id = (select auth.uid())
        and room_members.status = 'active'
        and ('room:' || room_members.room_id) = (select realtime.topic())
    )
  );

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.assert_room_membership_state(
  p_room_id text,
  p_state jsonb,
  p_ui jsonb,
  p_host_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_state->'players') is distinct from 'object' then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id::text = p_host_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;

  if exists (
    (
      select player_id
      from jsonb_object_keys(p_state->'players') as players(player_id)
      except
      select user_id::text
      from public.room_members
      where room_id = p_room_id and status = 'active'
    )
    union all
    (
      select user_id::text
      from public.room_members
      where room_id = p_room_id and status = 'active'
      except
      select player_id
      from jsonb_object_keys(p_state->'players') as players(player_id)
    )
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;

  if exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and status = 'banned'
      and (
        (p_state->'players') ? user_id::text
        or coalesce(p_ui->'votes', '{}'::jsonb) ? user_id::text
      )
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;
end;
$$;

revoke execute on function private.assert_room_membership_state(
  text, jsonb, jsonb, text
) from public, anon, authenticated, service_role;

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
security definer
set search_path = ''
as $$
declare
  created public.rooms;
begin
  if p_invite_hash is null then
    raise exception using errcode = 'P0001', message = 'ROOM_INVITE_INVALID';
  end if;

  insert into public.rooms (
    id, code, host_id, visibility, state, ui, version,
    created_at, updated_at, invite_hash
  ) values (
    p_id, p_code, p_host_id::text, p_visibility, p_state, p_ui, p_version,
    p_created_at, p_updated_at, p_invite_hash
  )
  returning * into created;

  insert into public.room_members (
    room_id, user_id, status, banned_at, banned_by
  ) values (
    p_id, p_host_id, 'active', null, null
  );

  perform private.assert_room_membership_state(
    p_id, p_state, p_ui, p_host_id::text
  );
  return created;
end;
$$;

drop function if exists public.server_join_room(
  text, uuid, jsonb, jsonb, integer, timestamptz
);

create function public.server_join_room(
  p_room_id text,
  p_user_id uuid,
  p_state jsonb,
  p_ui jsonb,
  p_expected_version integer,
  p_updated_at timestamptz,
  p_invite_hash text
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room public.rooms;
  member_status text;
  updated public.rooms;
begin
  select * into current_room
  from public.rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;

  select status into member_status
  from public.room_members
  where room_id = p_room_id and user_id = p_user_id;

  if member_status = 'banned' then
    raise exception using errcode = 'P0001', message = 'ROOM_BANNED';
  end if;

  if member_status = 'active' then
    if not ((current_room.state->'players') ? p_user_id::text) then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
    end if;
    return current_room;
  end if;

  if (
    select count(*)
    from public.room_members
    where room_id = p_room_id and status = 'active'
  ) >= 12 then
    raise exception using errcode = 'P0001', message = 'ROOM_FULL';
  end if;

  if current_room.version <> p_expected_version then
    raise exception 'room version conflict' using errcode = '40001';
  end if;

  if current_room.visibility = 'private'
    and (
      p_invite_hash is null
      or current_room.invite_hash is distinct from p_invite_hash
    )
  then
    raise exception using errcode = 'P0001', message = 'ROOM_INVITE_INVALID';
  end if;

  if current_room.state->>'phase' <> 'lobby'
    or not ((p_state->'players') ? p_user_id::text)
  then
    raise exception using errcode = 'P0001', message = 'WRONG_PHASE';
  end if;

  insert into public.room_members (
    room_id, user_id, status, banned_at, banned_by
  ) values (
    p_room_id, p_user_id, 'active', null, null
  );

  update public.rooms
  set state = p_state,
      ui = p_ui,
      version = version + 1,
      updated_at = p_updated_at
  where id = p_room_id
  returning * into updated;

  perform private.assert_room_membership_state(
    p_room_id, updated.state, updated.ui, updated.host_id
  );
  return updated;
end;
$$;

drop function if exists public.server_update_room(
  text, uuid, text, jsonb, jsonb, integer, timestamptz, text, uuid
);

create function public.server_update_room(
  p_room_id text,
  p_actor_id uuid,
  p_host_id uuid,
  p_visibility text,
  p_state jsonb,
  p_ui jsonb,
  p_expected_version integer,
  p_updated_at timestamptz,
  p_new_invite_hash text
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room public.rooms;
  updated public.rooms;
  next_invite_hash text;
begin
  select * into current_room
  from public.rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;
  if current_room.version <> p_expected_version then
    raise exception 'room version conflict' using errcode = '40001';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_actor_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_MEMBER';
  end if;

  if p_host_id::text <> current_room.host_id then
    if current_room.host_id <> p_actor_id::text then
      raise exception using errcode = 'P0001', message = 'NOT_HOST';
    end if;
    if not exists (
      select 1 from public.room_members
      where room_id = p_room_id
        and user_id = p_host_id
        and status = 'active'
    ) then
      raise exception using errcode = 'P0001', message = 'PLAYER_NOT_FOUND';
    end if;
  end if;

  next_invite_hash := current_room.invite_hash;
  if p_visibility = 'private' and next_invite_hash is null then
    if p_new_invite_hash is null then
      raise exception using errcode = 'P0001', message = 'ROOM_INVITE_INVALID';
    end if;
    next_invite_hash := p_new_invite_hash;
  end if;

  if p_host_id::text = current_room.host_id
    and p_visibility = current_room.visibility
    and p_state = current_room.state
    and p_ui = current_room.ui
    and next_invite_hash is not distinct from current_room.invite_hash
  then
    return current_room;
  end if;

  update public.rooms
  set host_id = p_host_id::text,
      visibility = p_visibility,
      state = p_state,
      ui = p_ui,
      version = version + 1,
      updated_at = p_updated_at,
      invite_hash = next_invite_hash
  where id = p_room_id
  returning * into updated;

  perform private.assert_room_membership_state(
    p_room_id, updated.state, updated.ui, updated.host_id
  );
  return updated;
end;
$$;

create or replace function public.server_leave_room(
  p_room_id text,
  p_actor_id uuid,
  p_state jsonb,
  p_ui jsonb,
  p_expected_version integer,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room public.rooms;
begin
  select * into current_room
  from public.rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;
  if current_room.version <> p_expected_version then
    raise exception 'room version conflict' using errcode = '40001';
  end if;
  if current_room.host_id = p_actor_id::text then
    raise exception using errcode = 'P0001', message = 'HOST_LEAVE_FORBIDDEN';
  end if;
  if current_room.state->>'phase' <> 'lobby' then
    raise exception using errcode = 'P0001', message = 'LEAVE_LOBBY_ONLY';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_actor_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_MEMBER';
  end if;
  if (p_state->'players') ? p_actor_id::text
    or coalesce(p_ui->'votes', '{}'::jsonb) ? p_actor_id::text
  then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;

  delete from public.room_members
  where room_id = p_room_id and user_id = p_actor_id;

  update public.rooms
  set state = p_state,
      ui = p_ui,
      version = version + 1,
      updated_at = p_updated_at
  where id = p_room_id;

  perform private.assert_room_membership_state(
    p_room_id, p_state, p_ui, current_room.host_id
  );
end;
$$;

create or replace function public.server_ban_room_member(
  p_room_id text,
  p_actor_id uuid,
  p_target_user_id uuid,
  p_state jsonb,
  p_ui jsonb,
  p_expected_version integer,
  p_updated_at timestamptz
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room public.rooms;
  updated public.rooms;
begin
  select * into current_room
  from public.rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;
  if current_room.version <> p_expected_version then
    raise exception 'room version conflict' using errcode = '40001';
  end if;
  if current_room.host_id <> p_actor_id::text then
    raise exception using errcode = 'P0001', message = 'NOT_HOST';
  end if;
  if p_target_user_id = p_actor_id then
    raise exception using errcode = 'P0001', message = 'HOST_REMOVE_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_actor_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_MEMBER';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_target_user_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'PLAYER_NOT_FOUND';
  end if;
  if (p_state->'players') ? p_target_user_id::text
    or coalesce(p_ui->'votes', '{}'::jsonb) ? p_target_user_id::text
  then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;

  update public.room_members
  set status = 'banned',
      banned_at = p_updated_at,
      banned_by = p_actor_id
  where room_id = p_room_id and user_id = p_target_user_id;

  update public.rooms
  set state = p_state,
      ui = p_ui,
      version = version + 1,
      updated_at = p_updated_at
  where id = p_room_id
  returning * into updated;

  perform private.assert_room_membership_state(
    p_room_id, updated.state, updated.ui, updated.host_id
  );
  return updated;
end;
$$;

drop function if exists public.server_rotate_room_invite(text, integer, text);
drop function if exists public.server_rotate_room_invite(
  text, uuid, integer, text, timestamptz
);

drop function if exists public.server_delete_room(text);

create function public.server_delete_room(
  p_room_id text,
  p_actor_id uuid,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room public.rooms;
begin
  select * into current_room
  from public.rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;
  if current_room.version <> p_expected_version then
    raise exception 'room version conflict' using errcode = '40001';
  end if;
  if current_room.host_id <> p_actor_id::text then
    raise exception using errcode = 'P0001', message = 'NOT_HOST';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_actor_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_MEMBER';
  end if;

  delete from public.rooms where id = p_room_id;
end;
$$;

revoke insert, update, delete on public.rooms from service_role;
revoke insert, update, delete on public.room_members from service_role;
grant select on public.rooms, public.room_members to service_role;

revoke execute on function public.server_create_room(
  text, text, uuid, text, jsonb, jsonb, integer, timestamptz, timestamptz, text
) from public, anon, authenticated;
revoke execute on function public.server_join_room(
  text, uuid, jsonb, jsonb, integer, timestamptz, text
) from public, anon, authenticated;
revoke execute on function public.server_update_room(
  text, uuid, uuid, text, jsonb, jsonb, integer, timestamptz, text
) from public, anon, authenticated;
revoke execute on function public.server_leave_room(
  text, uuid, jsonb, jsonb, integer, timestamptz
) from public, anon, authenticated;
revoke execute on function public.server_ban_room_member(
  text, uuid, uuid, jsonb, jsonb, integer, timestamptz
) from public, anon, authenticated;
revoke execute on function public.server_delete_room(text, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.server_create_room(
  text, text, uuid, text, jsonb, jsonb, integer, timestamptz, timestamptz, text
) to service_role;
grant execute on function public.server_join_room(
  text, uuid, jsonb, jsonb, integer, timestamptz, text
) to service_role;
grant execute on function public.server_update_room(
  text, uuid, uuid, text, jsonb, jsonb, integer, timestamptz, text
) to service_role;
grant execute on function public.server_leave_room(
  text, uuid, jsonb, jsonb, integer, timestamptz
) to service_role;
grant execute on function public.server_ban_room_member(
  text, uuid, uuid, jsonb, jsonb, integer, timestamptz
) to service_role;
grant execute on function public.server_delete_room(text, uuid, integer)
  to service_role;

comment on column public.room_members.status is
  'Active membership authorizes room access. Banned membership blocks this identity until room deletion.';
comment on column public.room_members.banned_at is
  'Timestamp of the host ban; null for active memberships.';
comment on column public.room_members.banned_by is
  'Anonymous Auth identity that issued the ban. Retained as audit data even if that Auth user is later deleted.';
