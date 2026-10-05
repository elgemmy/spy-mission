set constraints all immediate;
do $$
declare
  rpc record;
  definition text;
  conflict_message text;
  before_room jsonb;
  before_members jsonb;
begin
  if exists (
    select 1 from public.conflict_upgrade_function_snapshot old
    left join pg_proc current on current.oid = old.oid
    where current.oid is null or pg_get_functiondef(current.oid) <> replace(old.definition,
      'raise exception ''room version conflict'' using errcode = ''40001'';',
      'raise sqlstate ''PT409'' using message = ''ROOM_VERSION_CONFLICT'';')
      or current.proowner <> old.proowner
      or current.proacl is distinct from old.proacl
      or current.proconfig is distinct from old.proconfig
  ) then
    raise exception 'UPGRADE_CHANGED_MORE_THAN_CONFLICT_RAISE';
  end if;

  select to_jsonb(r) into before_room from public.rooms r
  where id = 'room-populated-upgrade';
  select jsonb_agg(to_jsonb(m) order by user_id) into before_members
  from public.room_members m where room_id = 'room-populated-upgrade';

  for rpc in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('server_update_room', 'server_join_room',
        'server_leave_room', 'server_delete_room', 'server_ban_room_member')
  loop
    definition := pg_get_functiondef(rpc.oid);
    if definition like '%40001%' or definition not like '%PT409%' then
      raise exception 'INVALID_CONFLICT_CODE: %', rpc.proname;
    end if;
    if has_function_privilege('anon', rpc.oid, 'EXECUTE')
      or has_function_privilege('authenticated', rpc.oid, 'EXECUTE')
      or not has_function_privilege('service_role', rpc.oid, 'EXECUTE') then
      raise exception 'INVALID_RPC_GRANTS: %', rpc.proname;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
      and proname in ('server_update_room', 'server_join_room',
        'server_leave_room', 'server_delete_room', 'server_ban_room_member')) <> 5 then
    raise exception 'EXPECTED_FIVE_ROOM_RPCS';
  end if;

  begin
    perform public.server_update_room('room-populated-upgrade',
      (before_room->>'host_id')::uuid, (before_room->>'host_id')::uuid,
      before_room->>'visibility', before_room->'state', before_room->'ui',
      (before_room->>'version')::integer - 1, now(), null);
    raise exception 'STALE_UPDATE_SHOULD_FAIL';
  exception when sqlstate 'PT409' then
    get stacked diagnostics conflict_message = message_text;
    if conflict_message <> 'ROOM_VERSION_CONFLICT' then raise; end if;
  end;
  if before_room is distinct from (select to_jsonb(r) from public.rooms r
      where id = 'room-populated-upgrade')
    or before_members is distinct from (select jsonb_agg(to_jsonb(m) order by user_id)
      from public.room_members m where room_id = 'room-populated-upgrade') then
    raise exception 'STALE_UPDATE_CHANGED_DATA';
  end if;
end;
$$;
drop table public.conflict_upgrade_function_snapshot;
select 'populated upgrade to PT409 conflict RPCs passed' as result;
