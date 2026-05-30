create table if not exists public.rooms (
  id text primary key,
  code text not null unique,
  host_id text not null,
  visibility text not null check (visibility in ('public', 'private')),
  state jsonb not null,
  ui jsonb not null default '{"votes": {}, "clueLog": []}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

alter table public.rooms enable row level security;

comment on table public.rooms is
  'Codenames room envelope. Do not add broad anon select policies before moving hidden-state reads behind RPC/RLS-safe views.';
