# Room lifecycle contract

Status: locked source of truth for room lifecycle, access, and tests.

This contract supersedes older lifecycle details in planning documents. The
engine contract remains authoritative for game rules, and `docs/handoff/*`
remains authoritative for visual decisions.

## Identity and navigation

- In shared multiplayer, the verified Supabase anonymous Auth user ID is the
  browser identity. Tabs in one browser profile share it; other profiles and
  incognito sessions do not. The app never rotates or signs out this identity.
- Display names are mutable, non-unique labels. A name never authenticates,
  identifies, or reclaims a player. Clearing site data creates a new identity;
  fingerprinting is forbidden.
- `/play/` always opens home/onboarding. A room is active only while the URL is
  `/play/?room=CODE`; no stored active-room ID may restore it.
- Startup removes the legacy `codenames.roomId` key. Create, join, and resume
  canonicalize the URL to `?room=CODE`. Client exit, deletion, ban, revocation,
  and invalid room context clear the URL and all rendered room state.
- Refreshing a room URL resumes by code through authenticated membership. An
  active member resumes without a name or invite. A non-member proceeds to the
  new-member join flow; a banned member is rejected.

## Authoritative data and boundary

- `auth.users` owns browser identity, `rooms` owns the full game aggregate, and
  `room_members` owns room access. There is no separate players table.
- `room_members.status` is `active` or `banned`. Active rows have no ban audit;
  banned rows retain `banned_at` and `banned_by` until room deletion. Normal
  leave deletes the membership row.
- Changes to membership and `rooms.state.players` are one database transaction.
  Ordinary commands cannot add or remove player keys.
- The browser never reads or writes raw `public.rooms` data. It sends commands
  to the authenticated `/api/rooms` boundary, which verifies the access token,
  loads full state with the server secret client, applies deterministic domain
  logic, and returns only `RoomSnapshot` / `viewFor` projections.
- Realtime carries invalidation or deletion metadata only, never room state.
  UI actions and future automation use the same command boundary.

## Resume and access modes

- Joining as an already-active member is idempotent; any supplied name is
  ignored. New membership is allowed only in the lobby and under the room's
  access rules. Duplicate display names are valid.
- `public` means unlisted and joinable by short code. `private` means unlisted
  and requires the full invite token for a new member.
- Active members resume private rooms without a token. Banned identities are
  rejected even with a valid token.
- Private tokens travel in the URL fragment and are stripped after successful
  join. They do not expire. They remain valid until room deletion or explicit
  host regeneration.
- Visibility toggles never rotate or invalidate an existing token. The first
  transition to private may create a token if none exists. Explicit
  regeneration is host-only, expected-version guarded, increments the room
  version, and invalidates the previous token.

## Player and host control

- `assignSelf` is self-only and lobby-only. No command accepts another player
  ID for team or role assignment, including commands issued by the host.
- Team and role changes are locked after game start.
- Host transfer is retained and labeled "Make host" or an equivalent clear
  phrase. Transfer changes privileges immediately; the former host loses every
  host-only capability at the new version.

## Exit, leave, ban, and delete

- **Exit to home** is available in every phase. It is client-only: it clears
  the active URL and rendered state without changing membership.
- **Leave room** is a confirmed, lobby-only, non-host command. It atomically
  removes the actor from game state and deletes their active membership. A host
  must first transfer hosting or delete the room.
- **Ban player** is confirmed and host-only. It atomically removes the target
  from game state and votes and changes the membership to `banned`. The banned
  identity cannot get, resume, join, command, or subscribe to that room.
- **Delete room** is confirmed and host-only. One database transaction locks
  the room, verifies the actor is the current host and active member, verifies
  `expectedVersion`, hard-deletes the room, and cascades all memberships.
  Transfer/delete races are resolved by the room lock and version check.
- Connected clients consume the state-free deletion broadcast and return home
  immediately. Supabase Realtime authorization is evaluated and cached when a
  private channel is joined, so a client authorized before the cascade can
  receive the committed delete broadcast. A bounded poll remains the reliable
  fallback and must also transition clients home when the room or active
  membership no longer exists.

## Lifetime and browser storage

- A room exists until explicit host deletion. There is no expiry, cron,
  presence model, disconnected-host election, or close-to-leave behavior.
- Browser storage may contain the Supabase Auth session, language/theme
  preferences, and a private invite cache only while relevant to a live room.
- Browser storage must not contain an active room ID, a full room/game
  snapshot, or a custom persistent player ID. Local design preview may use an
  in-memory ephemeral actor ID and rooms, but may not persist either.
- Invite cache is cleared on room deletion, ban/revocation, permanent leave,
  and explicit regeneration. Client-only exit does not revoke membership.

## Database and security requirements

- Migrations `0001` through `0003` are immutable. All changes are forward-only
  in `supabase/migrations/0004_room_lifecycle.sql` and must work both after a
  fresh `0001..0004` run and as an upgrade from `0003`.
- Lifecycle RPCs use short transactions, consistent room-row locking, explicit
  optimistic version checks, schema-qualified objects, and a locked empty
  `search_path`. Execute privileges are revoked from `PUBLIC`, `anon`, and
  `authenticated` and granted only to `service_role`.
- Browser roles retain no direct CRUD access to `rooms`; banned rows do not
  authorize membership reads or private Realtime topics. Foreign-key and
  access-path columns are indexed where the existing primary key is not enough.
- Request parsing enforces the actual streamed body size, including absent or
  false `Content-Length`. JSON schemas reject malformed JSON, unknown
  operations, and extra fields.
- Production Supabase/Vercel configuration is never mutated by this work, and
  migration `0004` is run only on a disposable local or staging project.

## Mobile acceptance

At `360x640`, `390x844`, and `430x932`: no horizontal overflow; the five-column
board fits; Arabic card text remains at the handoff's 17px floor; dialogs fit
and scroll; every interactive target is at least 44px; controls do not obscure
content; and standalone-PWA safe areas protect the first and last controls.

## Unavoidable limitation

A room ban applies to the anonymous Supabase identity. A user who clears site
data or uses another browser receives a new identity; preventing that requires
accounts or fingerprinting and is out of scope.
