-- Application conflicts must not masquerade as serialization_failure (40001).
-- Patch the installed definitions so this also works on the pre-Partner release.
-- CREATE OR REPLACE preserves signatures, owners, ACLs, and all other behavior.
do $migration$
declare
  rpc record;
  definition text;
  conflict_raise constant text :=
    'raise exception ''room version conflict'' using errcode = ''40001'';';
  replacement_raise constant text :=
    'raise sqlstate ''PT409'' using message = ''ROOM_VERSION_CONFLICT'';';
begin
  for rpc in
    select name from unnest(array[
      'server_update_room', 'server_join_room', 'server_leave_room',
      'server_delete_room', 'server_ban_room_member'
    ]) as functions(name)
  loop
    if (select count(*) from pg_proc
        where pronamespace = 'public'::regnamespace and proname = rpc.name) <> 1 then
      raise exception 'Expected exactly one public.% definition', rpc.name;
    end if;

    select pg_get_functiondef(oid) into definition from pg_proc
    where pronamespace = 'public'::regnamespace and proname = rpc.name;

    -- Fail closed on unexpected definitions rather than silently missing a RPC.
    if position(conflict_raise in definition) = 0
      or (length(definition) - length(replace(definition, conflict_raise, '')))
        / length(conflict_raise) <> 1 then
      raise exception 'Expected one legacy version conflict in public.%', rpc.name;
    end if;

    definition := replace(definition, conflict_raise, replacement_raise);
    if position('40001' in definition) > 0 then
      raise exception 'Unpatched serialization code in public.%', rpc.name;
    end if;
    execute definition;
  end loop;
end;
$migration$;
