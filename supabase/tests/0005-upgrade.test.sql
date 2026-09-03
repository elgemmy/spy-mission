do $$
declare
  upgraded_mode text;
  mode_constraint integer;
  private_constraint integer;
begin
  select mode into upgraded_mode
  from public.rooms
  where id = 'room-populated-upgrade';
  if upgraded_mode <> 'classic' then
    raise exception 'UPGRADE_CLASSIC_MODE_INVALID';
  end if;

  select count(*) into mode_constraint
  from pg_constraint
  where conname = 'rooms_mode_check'
    and conrelid = 'public.rooms'::regclass;
  if mode_constraint <> 1 then
    raise exception 'UPGRADE_MODE_CONSTRAINT_MISSING';
  end if;

  select count(*) into private_constraint
  from pg_constraint
  where conname = 'partner_rooms_private_check'
    and conrelid = 'public.rooms'::regclass;
  if private_constraint <> 1 then
    raise exception 'UPGRADE_PARTNER_PRIVATE_CONSTRAINT_MISSING';
  end if;
end;
$$;

begin;
set constraints all immediate;
do $$
begin
  begin
    update public.rooms
    set mode = 'partner'
    where id = 'room-populated-upgrade';
    raise exception 'UPGRADE_PUBLIC_PARTNER_SHOULD_FAIL';
  exception
    when check_violation then
      if sqlstate <> '23514' then
        raise;
      end if;
  end;
end;
$$;
rollback;

select 'populated 0004 to 0005 upgrade passed' as result;
