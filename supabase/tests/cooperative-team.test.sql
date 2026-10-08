-- Run against a disposable database after all migrations. All fixtures roll back.
begin;
do $$
declare
  host_id uuid := '20000000-0000-4000-8000-000000000001';
  member_id uuid;
  current_room public.rooms;
  ai_room public.rooms;
  next_state jsonb;
  member jsonb;
  initial_state jsonb;
  failure text;
begin
  for i in 1..18 loop
    insert into auth.users (id) values (('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid);
  end loop;
  initial_state := jsonb_build_object(
    'mode', 'partner', 'partnerType', 'human', 'phase', 'waiting_for_agent',
    'missionLead', jsonb_build_object('id', host_id::text, 'name', 'Host'),
    'fieldAgent', null,
    'team', jsonb_build_array(jsonb_build_object('id', host_id::text, 'name', 'Host', 'role', 'mission_lead'))
  );
  select * into current_room from public.server_create_room(
    'room-coop-sql-test', 'COOPSQL', host_id, 'private', initial_state, '{}'::jsonb,
    1, now(), now(), 'test-invite-hash', 'partner'
  );
  -- Go beyond both the old two-player limit and the classic twelve-player limit.
  for i in 2..15 loop
    member_id := ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    member := jsonb_build_object('id', member_id::text, 'name', 'Player ' || i,
      'role', case when i % 2 = 0 then 'mission_lead' else 'field_agent' end);
    next_state := current_room.state || jsonb_build_object('team', (current_room.state->'team') || jsonb_build_array(member));
    if i = 3 then
      next_state := next_state || jsonb_build_object('fieldAgent', member - 'role');
    end if;
    select * into current_room from public.server_join_room(current_room.id, member_id,
      next_state, current_room.ui, current_room.version, now(), 'test-invite-hash', true);
    if i = 3 then
      -- Subsequent players can join a running mission without altering the turn.
      update public.rooms set state = state || '{"phase":"waiting_for_signal"}'::jsonb
        where id = current_room.id returning * into current_room;
    end if;
  end loop;
  if jsonb_array_length(current_room.state->'team') <> 15 or
    (select count(*) from public.room_members where room_id = current_room.id and status = 'active') <> 15 then
    raise exception 'COOP_TEAM_LIMIT_OR_MEMBERSHIP_FAILURE';
  end if;
  member_id := '20000000-0000-4000-8000-000000000016';
  member := jsonb_build_object('id', member_id::text, 'name', 'Later', 'role', 'field_agent');
  next_state := current_room.state || jsonb_build_object('team', (current_room.state->'team') || jsonb_build_array(member));
  begin
    perform public.server_join_room(current_room.id, member_id, next_state, current_room.ui, current_room.version, now(), 'wrong-invite', true);
    raise exception 'INVALID_INVITE_ACCEPTED';
  exception when sqlstate 'P0001' then
    get stacked diagnostics failure = message_text;
    if failure <> 'ROOM_INVITE_INVALID' then raise; end if;
  end;
  begin
    perform public.server_join_room(current_room.id, member_id, next_state, current_room.ui, current_room.version - 1, now(), 'test-invite-hash', true);
    raise exception 'STALE_JOIN_ACCEPTED';
  exception when serialization_failure then null;
  end;
  begin
    perform public.server_join_room(current_room.id, member_id,
      jsonb_set(next_state, '{team,0,role}', '"field_agent"'), current_room.ui, current_room.version, now(), 'test-invite-hash', true);
    raise exception 'ROLE_REWRITE_ACCEPTED';
  exception when sqlstate 'P0001' then
    get stacked diagnostics failure = message_text;
    if failure <> 'ROOM_MEMBERSHIP_INVALID' then raise; end if;
  end;
  begin
    perform public.server_join_room(current_room.id, member_id,
      next_state || '{"phase":"won"}'::jsonb, current_room.ui, current_room.version, now(), 'test-invite-hash', true);
    raise exception 'TURN_REWRITE_ACCEPTED';
  exception when sqlstate 'P0001' then
    get stacked diagnostics failure = message_text;
    if failure <> 'ROOM_MEMBERSHIP_INVALID' then raise; end if;
  end;
  insert into public.room_members(room_id, user_id, status, banned_at, banned_by)
    values(current_room.id, member_id, 'banned', now(), host_id);
  begin
    perform public.server_join_room(current_room.id, member_id, next_state, current_room.ui, current_room.version, now(), 'test-invite-hash', true);
    raise exception 'BANNED_PLAYER_ACCEPTED';
  exception when sqlstate 'P0001' then
    get stacked diagnostics failure = message_text;
    if failure <> 'ROOM_BANNED' then raise; end if;
  end;

  -- Existing AI rooms must still stop at exactly one invited Field Agent.
  select * into ai_room from public.server_create_room('room-ai-sql-test', 'AISQL', host_id,
    'private', initial_state - 'team' - 'partnerType', '{}'::jsonb, 1, now(), now(), 'ai-invite', 'partner');
  member_id := '20000000-0000-4000-8000-000000000002';
  next_state := ai_room.state || jsonb_build_object('fieldAgent', jsonb_build_object('id', member_id::text, 'name', 'AI'), 'phase', 'waiting_for_signal');
  select * into ai_room from public.server_join_room(ai_room.id, member_id, next_state, ai_room.ui, ai_room.version, now(), 'ai-invite', true);
  begin
    perform public.server_join_room(ai_room.id, '20000000-0000-4000-8000-000000000003', ai_room.state,
      ai_room.ui, ai_room.version, now(), 'ai-invite', true);
    raise exception 'AI_EXTRA_PLAYER_ACCEPTED';
  exception when sqlstate 'P0001' then
    get stacked diagnostics failure = message_text;
    if failure <> 'FIELD_AGENT_SEAT_TAKEN' then raise; end if;
  end;

  -- Simulate an existing human Duo row without a roster, then add a third player.
  update public.rooms set state = state || '{"partnerType":"human"}'::jsonb
    where id = ai_room.id returning * into ai_room;
  perform private.assert_room_membership_state(ai_room.id, ai_room.state, ai_room.ui, ai_room.host_id);
  member_id := '20000000-0000-4000-8000-000000000003';
  next_state := ai_room.state || jsonb_build_object('team', jsonb_build_array(
    ai_room.state->'missionLead' || '{"role":"mission_lead"}'::jsonb,
    ai_room.state->'fieldAgent' || '{"role":"field_agent"}'::jsonb,
    jsonb_build_object('id', member_id::text, 'name', 'Extra lead', 'role', 'mission_lead')
  ));
  select * into ai_room from public.server_join_room(ai_room.id, member_id, next_state, ai_room.ui, ai_room.version, now(), 'ai-invite', true);
  if jsonb_array_length(ai_room.state->'team') <> 3 then raise exception 'LEGACY_DUO_UPGRADE_FAILED'; end if;

  if has_function_privilege('authenticated', 'public.server_join_room(text,uuid,jsonb,jsonb,integer,timestamptz,text,boolean)', 'execute')
    or has_function_privilege('anon', 'public.server_join_room(text,uuid,jsonb,jsonb,integer,timestamptz,text,boolean)', 'execute')
    or has_function_privilege('service_role', 'private.assert_room_membership_state(text,jsonb,jsonb,text)', 'execute') then
    raise exception 'MEMBERSHIP_FUNCTION_EXPOSED';
  end if;
end;
$$;
rollback;
select 'cooperative team membership passed' as result;
