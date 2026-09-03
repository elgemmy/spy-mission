-- Forward-only AI Partner Mission support. Migrations 0001..0004 are immutable.

alter table public.rooms
  add column if not exists mode text not null default 'classic';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rooms_mode_check'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms
      add constraint rooms_mode_check check (mode in ('classic', 'partner'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_rooms_private_check'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms
      add constraint partner_rooms_private_check
      check (mode <> 'partner' or visibility = 'private');
  end if;
end;
$$;

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
declare
  room_mode text;
  lead_id text;
  agent_id text;
begin
  select mode into room_mode
  from public.rooms
  where id = p_room_id;

  if room_mode is null then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
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

  if room_mode = 'classic' then
    if p_state->>'mode' = 'partner' then
      raise exception using errcode = 'P0001', message = 'ROOM_MODE_INVALID';
    end if;
    if jsonb_typeof(p_state->'players') is distinct from 'object' then
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
    return;
  end if;

  if p_state->>'mode' <> 'partner' then
    raise exception using errcode = 'P0001', message = 'ROOM_MODE_INVALID';
  end if;
  if jsonb_typeof(p_state->'missionLead') is distinct from 'object'
    or p_state->'missionLead'->>'id' is null
    or p_state->'missionLead'->>'id' <> p_host_id
  then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;

  lead_id := p_state->'missionLead'->>'id';
  if jsonb_typeof(p_state->'fieldAgent') = 'object' then
    agent_id := p_state->'fieldAgent'->>'id';
    if agent_id is null or agent_id = lead_id then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
    end if;
  elsif jsonb_typeof(p_state->'fieldAgent') is distinct from 'null' then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;

  if exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and status = 'active'
      and user_id::text <> lead_id
      and (agent_id is null or user_id::text <> agent_id)
  ) or (agent_id is not null and not exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id::text = agent_id
      and status = 'active'
  )) or exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and status = 'banned'
      and user_id::text in (lead_id, agent_id)
  ) then
    raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
  end if;
end;
$$;

revoke execute on function private.assert_room_membership_state(
  text, jsonb, jsonb, text
) from public, anon, authenticated, service_role;

drop function if exists public.server_create_room(
  text, text, uuid, text, jsonb, jsonb, integer, timestamptz, timestamptz, text
);

create function public.server_create_room(
  p_id text,
  p_code text,
  p_host_id uuid,
  p_visibility text,
  p_state jsonb,
  p_ui jsonb,
  p_version integer,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_invite_hash text,
  p_mode text
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
  if p_mode not in ('classic', 'partner') then
    raise exception using errcode = 'P0001', message = 'ROOM_MODE_INVALID';
  end if;
  if p_mode = 'partner' and p_visibility <> 'private' then
    raise exception using errcode = 'P0001', message = 'ROOM_INVITE_INVALID';
  end if;

  insert into public.rooms (
    id, code, host_id, visibility, state, ui, version,
    created_at, updated_at, invite_hash, mode
  ) values (
    p_id, p_code, p_host_id::text, p_visibility, p_state, p_ui, p_version,
    p_created_at, p_updated_at, p_invite_hash, p_mode
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
  text, uuid, jsonb, jsonb, integer, timestamptz, text
);

create function public.server_join_room(
  p_room_id text,
  p_user_id uuid,
  p_state jsonb,
  p_ui jsonb,
  p_expected_version integer,
  p_updated_at timestamptz,
  p_invite_hash text,
  p_partner_claim boolean
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

  if (current_room.mode = 'partner') is distinct from p_partner_claim then
    raise exception using errcode = 'P0001', message = 'ROOM_MODE_MISMATCH';
  end if;

  if member_status = 'active' then
    if p_partner_claim then
      raise exception using errcode = 'P0001', message = 'WRONG_PHASE';
    end if;
    perform private.assert_room_membership_state(
      p_room_id, current_room.state, current_room.ui, current_room.host_id
    );
    return current_room;
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

  if current_room.mode = 'classic' then
    if (
      select count(*)
      from public.room_members
      where room_id = p_room_id and status = 'active'
    ) >= 12 then
      raise exception using errcode = 'P0001', message = 'ROOM_FULL';
    end if;
    if current_room.state->>'phase' <> 'lobby'
      or not ((p_state->'players') ? p_user_id::text)
    then
      raise exception using errcode = 'P0001', message = 'WRONG_PHASE';
    end if;
  else
    if current_room.state->>'phase' <> 'waiting_for_agent'
      or jsonb_typeof(current_room.state->'fieldAgent') is distinct from 'null'
      or p_state->'fieldAgent'->>'id' <> p_user_id::text
      or p_state->'missionLead' is distinct from current_room.state->'missionLead'
    then
      raise exception using errcode = 'P0001', message = 'FIELD_AGENT_SEAT_TAKEN';
    end if;
    if (
      select count(*)
      from public.room_members
      where room_id = p_room_id and status = 'active'
    ) >= 2 then
      raise exception using errcode = 'P0001', message = 'FIELD_AGENT_SEAT_TAKEN';
    end if;
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

revoke execute on function public.server_create_room(
  text, text, uuid, text, jsonb, jsonb, integer, timestamptz, timestamptz, text,
  text
) from public, anon, authenticated;
revoke execute on function public.server_join_room(
  text, uuid, jsonb, jsonb, integer, timestamptz, text, boolean
) from public, anon, authenticated;

grant execute on function public.server_create_room(
  text, text, uuid, text, jsonb, jsonb, integer, timestamptz, timestamptz, text,
  text
) to service_role;
grant execute on function public.server_join_room(
  text, uuid, jsonb, jsonb, integer, timestamptz, text, boolean
) to service_role;

comment on column public.rooms.mode is
  'Discriminates classic multiplayer from the isolated AI Partner Mission aggregate.';
