-- Room state contains unrevealed card identities. The public frontend anon key
-- must not be able to read or mutate these rows directly.
drop policy if exists "rooms anon select" on public.rooms;
drop policy if exists "rooms anon insert" on public.rooms;
drop policy if exists "rooms anon update" on public.rooms;
drop policy if exists "rooms anon delete" on public.rooms;

revoke all privileges on public.rooms from anon;

comment on table public.rooms is
  'Codenames room envelope. Direct anonymous access is disabled because state contains secret card identities.';
