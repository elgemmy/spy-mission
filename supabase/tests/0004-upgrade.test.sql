do $$
declare
  active_members integer;
  fk_delete_action "char";
  rotate_functions integer;
begin
  select count(*) into active_members
  from public.room_members
  where room_id = 'room-populated-upgrade' and status = 'active';
  if active_members <> 2 then
    raise exception 'UPGRADE_ACTIVE_MEMBERS_INVALID';
  end if;

  select confdeltype into fk_delete_action
  from pg_constraint
  where conname = 'room_members_user_id_fkey'
    and conrelid = 'public.room_members'::regclass;
  if fk_delete_action <> 'r' then
    raise exception 'UPGRADE_AUTH_DELETE_NOT_RESTRICTED';
  end if;

  select count(*) into rotate_functions
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'server_rotate_room_invite';
  if rotate_functions <> 0 then
    raise exception 'UPGRADE_INVITE_ROTATION_STILL_EXPOSED';
  end if;

  begin
    delete from auth.users
    where id = '10000000-0000-4000-8000-000000000002';
    raise exception 'UPGRADE_AUTH_DELETE_SHOULD_FAIL';
  exception
    when foreign_key_violation then
      if sqlstate <> '23503' then
        raise;
      end if;
  end;
end;
$$;

select public.server_update_room(
  'room-populated-upgrade',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'private',
  state,
  ui,
  version,
  now(),
  repeat('a', 64)
)
from public.rooms
where id = 'room-populated-upgrade';

select public.server_update_room(
  'room-populated-upgrade',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'public',
  state,
  ui,
  version,
  now(),
  null
)
from public.rooms
where id = 'room-populated-upgrade';

select public.server_update_room(
  'room-populated-upgrade',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'private',
  state,
  ui,
  version,
  now(),
  repeat('b', 64)
)
from public.rooms
where id = 'room-populated-upgrade';

do $$
declare
  upgraded public.rooms;
begin
  select * into upgraded
  from public.rooms
  where id = 'room-populated-upgrade';

  if upgraded.invite_hash <> repeat('a', 64) then
    raise exception 'UPGRADE_INVITE_NOT_STABLE';
  end if;
  if upgraded.visibility <> 'private' or upgraded.version <> 6 then
    raise exception 'UPGRADE_ROOM_STATE_INVALID';
  end if;
  if not ((upgraded.state->'players') ? upgraded.host_id) then
    raise exception 'UPGRADE_HOST_STATE_INVALID';
  end if;
end;
$$;

select public.server_leave_room(
  'room-populated-upgrade',
  '10000000-0000-4000-8000-000000000002',
  jsonb_set(
    state,
    '{players}',
    (state->'players') - '10000000-0000-4000-8000-000000000002'
  ),
  ui,
  version,
  now()
)
from public.rooms
where id = 'room-populated-upgrade';
delete from auth.users
where id = '10000000-0000-4000-8000-000000000002';

select public.server_delete_room(
  'room-populated-upgrade',
  '10000000-0000-4000-8000-000000000001',
  version
)
from public.rooms
where id = 'room-populated-upgrade';
delete from auth.users
where id = '10000000-0000-4000-8000-000000000001';

select 'populated 0003 to 0004 upgrade passed' as result;
