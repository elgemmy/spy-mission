# Spy Mission

Spy Mission is an independent word-association game project. Two teams, one
Signal, twenty-five words. Each player joins from their own phone.

**Play:** [https://spymission.dev](https://spymission.dev)

By [Ahmed Gamal - elgemmy](https://github.com/elgemmy).

<img width="1185" height="774" alt="image" src="https://github.com/user-attachments/assets/9b96e4a2-2f43-4002-961d-2b30f88ee2e0" />

## What it is

A mobile-first family game:

- Create a room and share a short code (or a private invite link)
- One Mission Lead on each team gives one-word Signals
- Field Agents reveal tiles and avoid the Trap
- The board is bilingual: every concept carries English and Arabic labels
- Rooms persist across refresh; leaving the URL leaves the table

## AI Partner Mission

AI Partner Mission is Spy Mission's WebMCP-powered cooperative mode.

The human creates a private mission as Mission Lead and invites an AI Field
Agent. The agent joins through WebMCP, chooses its own call sign, inspects only
its authorized public mission state, and submits ordered guesses in response to
the human's Signal.

The browser exposes a small phase-aware WebMCP surface:

- `choose_name` — available while joining as the invited Field Agent
- `inspect_mission` — reads the Field Agent-safe board and current Signal
- `submit_guesses` — locks ordered guesses during the Field Agent's turn

## Normal play mode

Shared multiplayer on `/play/`:

1. Open the landing page or go straight to `/play/`.
2. Create a room or join with a code.
3. Pick a display name, team, and role.
4. The host starts the round. Mission Leads see the key; Field Agents do not.

Invite links use `/play/?room=CODE`. Private rooms add `#invite=TOKEN` in the
URL fragment so the token is not sent with the page request.

Without Supabase environment variables, `/play/` runs an in-memory local
preview. That preview is useful for UI work and is **not** cross-device
multiplayer.

## Language and identity

- The landing and game interface are available in English and Arabic.
- English is the default interface language. Selecting Arabic persists for
  later visits.
- Interface language and board language are independent.
- Every board concept has English and Arabic labels. New rooms show English
  board words by default; the room can select Arabic without changing the
  interface language.
- PWA, install, and page metadata use **Spy Mission**.
- Public game terms are **Mission Lead**, **Field Agent**, **Signal**, and
  **Trap**.
- Footer attribution is **Ahmed Gamal — elgemmy**.

## Architecture

```
Browser
  → authenticated POST /api/rooms
  → server-side room domain + game engine
  → service-role Supabase RPC / storage
  → role-filtered RoomSnapshot
  → state-free Realtime invalidation + polling fallback
```

The engine in `src/engine` is pure and deterministic. The UI dispatches
actions and renders a `PlayerView`. It does not apply game rules itself.

Two site surfaces share one origin:

| URL      | Entry                                 | Purpose           |
| -------- | ------------------------------------- | ----------------- |
| `/`      | `index.html` → `src/landing/main.tsx` | Marketing landing |
| `/play/` | `play/index.html` → `src/main.tsx`    | The game          |

Only the game is a PWA. Details: [`docs/planning/adr-001-landing-and-play-route.md`](docs/planning/adr-001-landing-and-play-route.md).

## Secure multiplayer

When Supabase variables are configured:

- Each guest signs in with Supabase anonymous Auth
- The browser talks only to `/api/rooms`
- The server is the only component that reads complete room state
- Field Agents never receive unrevealed card kinds
- Realtime sends a private `room_changed` signal, not the room row
- Clients refetch their own authorized snapshot (and poll if Realtime drops)

The browser does not write `public.rooms` and does not last-write-wins a shared
row. See [`docs/room-lifecycle-contract.md`](docs/room-lifecycle-contract.md).

## Local development

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/> for the landing page and
<http://localhost:5173/play/> for the game.

`npm run dev` serves the Vite frontend only. End-to-end multiplayer against
`/api/rooms` needs `vercel dev` (or an equivalent that serves the Vercel
Function).

### Environment variables

```bash
cp .env.example .env.local
```

Local design preview does not require Supabase. Shared multiplayer requires:

| Variable                 | Where         | Purpose                                                                                                     |
| ------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Browser build | Project URL                                                                                                 |
| `VITE_SUPABASE_ANON_KEY` | Browser build | Anonymous Auth                                                                                              |
| `SUPABASE_URL`           | Server only   | Project URL for `/api/rooms`                                                                                |
| `SUPABASE_SECRET_KEY`    | Server only   | Service-role key. A legacy `SUPABASE_SERVICE_ROLE_KEY` also works. Never prefix either secret with `VITE_`. |

Also enable Anonymous Sign-Ins in Supabase **Authentication → Providers**.

### Local Supabase and migrations

Docker is required. PostgreSQL’s `psql` client is required for the upgrade
check inside the script.

```bash
npm run test:supabase
```

That command starts a **disposable** project-local Supabase stack, applies
migrations `0001` through `0004`, runs the real API / Realtime / permission
suite, then verifies a populated `0003` → `0004` upgrade. It stops and removes
that local data when it finishes.

- Local data is disposable.
- **Never** point this suite at production Supabase.
- This repository does not apply migrations to production automatically.
- Apply new migrations to local or staging first.

Current migration files:

1. `supabase/migrations/0001_rooms.sql`
2. `supabase/migrations/0002_lock_down_rooms.sql`
3. `supabase/migrations/0003_secure_multiplayer.sql`
4. `supabase/migrations/0004_room_lifecycle.sql`

`0001`–`0003` are immutable. Further schema changes are forward-only.

`public.rooms` has RLS enabled with no browser policies on purpose. Do not add
client policies to silence the Security Advisor; direct table access must stay
denied.

### Scripts

| Command                           | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `npm run dev`                     | Vite dev server                                      |
| `npm run build`                   | Typecheck + production build                         |
| `npm run typecheck`               | TypeScript                                           |
| `npm run lint`                    | ESLint                                               |
| `npm run test`                    | Vitest (excludes the live Supabase integration file) |
| `npm run test:supabase`           | Disposable local Supabase integration suite          |
| `npm run format` / `format:write` | Prettier                                             |
| `npm run preview`                 | Preview the production build                         |

## Tests

- Engine contract: `docs/planning/engine-contract.md`
- UI foundation: `src/ui/card/Card.test.tsx`, `src/styles/tokens.test.ts`
- Room API (mocked): `src/server/rooms/service.test.ts`
- Room API (live local stack): `npm run test:supabase`

CI runs typecheck, lint, unit tests, production build, and
`npm run test:supabase`.

## Deployment

The site deploys on **Vercel** (`vercel.json`):

- `/play/:path*` serves the game shell
- `/play` redirects to `/play/`
- Legacy `/?room=CODE` redirects to `/play/?room=CODE`
- `/sw.js` and `/manifest.webmanifest` are served `no-cache`

Production setup, in short: apply migrations on the target Supabase project,
enable anonymous sign-ins, keep Realtime on private channels, set the four
environment variables above (preview and production should use separate
Supabase projects), and keep the service-role key server-only.

## Documentation map

| Doc                                                                                                  | Role                             |
| ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| [`docs/README.md`](docs/README.md)                                                                   | Index of remaining docs          |
| [`docs/room-lifecycle-contract.md`](docs/room-lifecycle-contract.md)                                 | Room access, invites, ban/delete |
| [`docs/planning/engine-contract.md`](docs/planning/engine-contract.md)                               | Game rules and engine types      |
| [`docs/planning/adr-001-landing-and-play-route.md`](docs/planning/adr-001-landing-and-play-route.md) | `/` vs `/play/` and PWA scope    |
| [`docs/BROWNFIELD_BASELINE.md`](docs/BROWNFIELD_BASELINE.md)                                         | Pre-competition baseline         |
| [`src/content/words/README.md`](src/content/words/README.md)                                         | Word pack                        |

## License

[MIT](LICENSE) for first-party application code and design — Copyright (c)
2026 Ahmed Gamal (elgemmy).

The bilingual word pack and word-list entries reproduced from it in
documentation are **not** asserted under that grant. See
[`ASSET_PROVENANCE.md`](ASSET_PROVENANCE.md).

- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
- [`SECURITY.md`](SECURITY.md)
