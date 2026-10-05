create table public.conflict_upgrade_function_snapshot as
select oid, pg_get_functiondef(oid) as definition, proowner, proacl, proconfig
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('server_update_room', 'server_join_room', 'server_leave_room',
    'server_delete_room', 'server_ban_room_member');
