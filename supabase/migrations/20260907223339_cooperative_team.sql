-- Expand human cooperative teams while preserving classic and AI membership rules.

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

  -- Human rooms have a role-bearing roster; legacy two-player rows still work.
  if p_state->>'partnerType' = 'human' and p_state ? 'team' then
    if jsonb_typeof(p_state->'team') is distinct from 'array' then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_state->'team') as members(player)
      where jsonb_typeof(player) is distinct from 'object'
        or jsonb_typeof(player->'id') is distinct from 'string'
        or jsonb_typeof(player->'name') is distinct from 'string'
        or length(btrim(player->>'name')) not between 1 and 32
        or coalesce(player->>'role', '') not in ('mission_lead', 'field_agent')
    ) or (
      select count(*) <> count(distinct player->>'id')
      from jsonb_array_elements(p_state->'team') as members(player)
    ) or not exists (
      select 1 from jsonb_array_elements(p_state->'team') as members(player)
      where player->>'id' = p_host_id and player->>'role' = 'mission_lead'
        and player - 'role' = p_state->'missionLead'
    ) then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
    end if;
    if exists (
      (select player->>'id' from jsonb_array_elements(p_state->'team') as members(player)
       except select user_id::text from public.room_members where room_id = p_room_id and status = 'active')
      union all
      (select user_id::text from public.room_members where room_id = p_room_id and status = 'active'
       except select player->>'id' from jsonb_array_elements(p_state->'team') as members(player))
    ) or p_state->'fieldAgent' is distinct from coalesce((
      select player - 'role' from jsonb_array_elements(p_state->'team') with ordinality as members(player, position)
      where player->>'role' = 'field_agent' order by position limit 1
    ), 'null'::jsonb) then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
    end if;
    return;
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

create or replace function public.server_join_room(
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
  current_team jsonb;
  joined_player jsonb;
  expected_agent jsonb;
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
  elsif current_room.state->>'partnerType' = 'human' then
    if current_room.state->>'phase' not in ('waiting_for_agent', 'waiting_for_signal', 'field_agent_turn', 'locked') then
      raise exception using errcode = 'P0001', message = 'WRONG_PHASE';
    end if;
    current_team := coalesce(current_room.state->'team',
      jsonb_build_array(current_room.state->'missionLead' || jsonb_build_object('role', 'mission_lead')) ||
      case when jsonb_typeof(current_room.state->'fieldAgent') = 'object'
        then jsonb_build_array(current_room.state->'fieldAgent' || jsonb_build_object('role', 'field_agent'))
        else '[]'::jsonb end);
    if jsonb_typeof(p_state->'team') is distinct from 'array' then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
    end if;
    joined_player := p_state->'team'->-1;
    if joined_player->>'id' is distinct from p_user_id::text
      or coalesce(joined_player->>'role', '') not in ('mission_lead', 'field_agent')
      or p_state->'team' is distinct from current_team || jsonb_build_array(joined_player)
      or (p_state - 'team' - 'fieldAgent') is distinct from (current_room.state - 'team' - 'fieldAgent')
    then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
    end if;
    expected_agent := case
      when jsonb_typeof(current_room.state->'fieldAgent') = 'object' then current_room.state->'fieldAgent'
      when joined_player->>'role' = 'field_agent' then joined_player - 'role'
      else 'null'::jsonb end;
    if p_state->'fieldAgent' is distinct from expected_agent then
      raise exception using errcode = 'P0001', message = 'ROOM_MEMBERSHIP_INVALID';
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

revoke execute on function private.assert_room_membership_state(text, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.server_join_room(text, uuid, jsonb, jsonb, integer, timestamptz, text, boolean)
  from public, anon, authenticated;
grant execute on function public.server_join_room(text, uuid, jsonb, jsonb, integer, timestamptz, text, boolean)
  to service_role;
