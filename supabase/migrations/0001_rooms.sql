create table if not exists public.rooms (
  id text primary key,
  code text not null unique,
  host_id text not null,
  visibility text not null check (visibility in ('public', 'private')),
  state jsonb not null,
  ui jsonb not null default '{"votes": {}, "clueLog": [], "banners": []}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

alter table public.rooms
  alter column ui set default '{"votes": {}, "clueLog": [], "banners": []}'::jsonb;

update public.rooms
set ui = jsonb_set(
  coalesce(ui, '{}'::jsonb),
  '{banners}',
  coalesce(ui->'banners', '[]'::jsonb),
  true
)
where not (coalesce(ui, '{}'::jsonb) ? 'banners');

alter table public.rooms enable row level security;

drop policy if exists "rooms anon select" on public.rooms;
drop policy if exists "rooms anon insert" on public.rooms;
drop policy if exists "rooms anon update" on public.rooms;
drop policy if exists "rooms anon delete" on public.rooms;

create policy "rooms anon select"
  on public.rooms for select
  to anon
  using (true);

create policy "rooms anon insert"
  on public.rooms for insert
  to anon
  with check (true);

create policy "rooms anon update"
  on public.rooms for update
  to anon
  using (true)
  with check (true);

create policy "rooms anon delete"
  on public.rooms for delete
  to anon
  using (true);

grant select, insert, update, delete on public.rooms to anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

comment on table public.rooms is
  'Codenames room envelope. Current anon policies are for MVP playtesting only; move hidden-state reads behind RPC/RLS-safe views before serious public play.';
