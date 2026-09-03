insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  created_at,
  updated_at,
  is_anonymous
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    now(),
    now(),
    true
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    now(),
    now(),
    true
  );

insert into public.rooms (
  id,
  code,
  host_id,
  visibility,
  state,
  ui,
  version,
  invite_hash
) values (
  'room-populated-upgrade',
  'UP003',
  '10000000-0000-4000-8000-000000000001',
  'public',
  '{
    "roomId": "room-populated-upgrade",
    "lang": "ar",
    "phase": "lobby",
    "players": {
      "10000000-0000-4000-8000-000000000001": {
        "name": "Host",
        "team": "red",
        "role": "operative"
      },
      "10000000-0000-4000-8000-000000000002": {
        "name": "Member",
        "team": "blue",
        "role": "operative"
      }
    },
    "board": [],
    "turn": "red",
    "startingTeam": "red",
    "clue": null,
    "guessesMadeThisTurn": 0,
    "winner": null
  }'::jsonb,
  '{"votes": {}, "clueLog": [], "banners": []}'::jsonb,
  3,
  null
);

insert into public.room_members (room_id, user_id) values
  ('room-populated-upgrade', '10000000-0000-4000-8000-000000000001'),
  ('room-populated-upgrade', '10000000-0000-4000-8000-000000000002');
