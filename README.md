# Codenames Hub

Mobile-first Arabic-first Codenames web app. Design system: **Warm Sand** (`docs/handoff`).

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4 (`@theme` maps `--cn-*` tokens)
- Supabase (client placeholder; Phase 4)
- Pure game engine in `src/engine`

## Quick start

```bash
npm install
npm run dev
```

## Environment variables

```bash
cp .env.example .env.local
```

Local design preview does not require Supabase. Shared multiplayer requires:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the browser build.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as server-only Vercel Function
  variables. A legacy `SUPABASE_SERVICE_ROLE_KEY` also works. Never prefix
  either secret with `VITE_`.
- Anonymous Sign-Ins enabled under Supabase **Authentication → Providers**.
- Every file in `supabase/migrations/` applied, including
  `0003_secure_multiplayer.sql`.

When configured, the browser authenticates each guest with Supabase Auth and
calls `/api/rooms`. The Vercel Function is the only component allowed to read
complete room state. It validates each action with the game engine and returns
a role-filtered snapshot, so operatives never receive unrevealed card kinds.
Supabase Realtime broadcasts only a private `room_changed` signal to registered
room members; clients then fetch their own authorized view.

The local provider is used only when Supabase variables are absent. It is useful
for UI development but is not shared between devices.

### Production setup

1. Apply the migrations to each Supabase project.
2. Enable Anonymous Sign-Ins in Supabase Auth.
3. In Realtime Settings, disable public channel access so only private channels
   are accepted.
4. Add the four variables above to the matching Vercel environment. Keep
   preview deployments on a separate Supabase project from production.
5. Configure a Vercel Firewall rate limit for `POST /api/rooms`, especially the
   create and join traffic, and place the Function near the Supabase region.
6. Deploy, then create a room on one device and join it from another using the
   room link or code. Refresh both devices and confirm they remain in sync.

Use `vercel dev` for local end-to-end multiplayer testing because plain
`npm run dev` serves the Vite frontend but not the `/api/rooms` function.

`public.rooms` intentionally has RLS enabled with no browser policies. Do not
resolve the Security Advisor's “RLS Enabled No Policy” information item by
adding client policies; direct room-table access must remain denied.

## Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `npm run dev`       | Dev server                   |
| `npm run build`     | Typecheck + production build |
| `npm run typecheck` | TypeScript                   |
| `npm run lint`      | ESLint                       |
| `npm run test`      | Vitest                       |

## Design system (handoff-canonical)

**Canonical source:** [`docs/handoff/`](docs/handoff/)

| File                              | Role                                                  |
| --------------------------------- | ----------------------------------------------------- |
| `docs/handoff/tokens.css`         | Token reference (mirrored in `src/styles/tokens.css`) |
| `docs/handoff/card.css`           | Word tile styles (mirrored in `src/ui/card/Card.css`) |
| `docs/handoff/Card.html`          | Reference markup for `WordCard`                       |
| `docs/handoff/component-specs.md` | TopBar, Board, ClueBar, Lobby specs                   |
| `docs/handoff/CODEX_HANDOFF.md`   | Codex execution guardrails                            |

### Handoff precedence

For any UI work, follow **`docs/handoff/*` first**. Do not mix legacy planning tokens (`docs/planning/codenames-hub-design-system.md`) with Warm Sand values.

### Replacing tokens

1. Edit **`src/styles/tokens.css`** (`--cn-*` variables).
2. Extend **`src/styles/globals.css`** `@theme` if new semantic utilities are needed.
3. Use Tailwind classes: `bg-bg`, `text-ink`, `bg-red-tint`, `font-ar`, `rounded-card`, `max-w-shell`.
4. Layout shell: **`.cn-shell`** on the app root column.

### Reference component

`src/ui/card/WordCard` implements the handoff flip tile. The dev app shows a **design foundation preview** (legend + tap-to-flip demo row).

## Module boundaries

| Path                 | Responsibility                |
| -------------------- | ----------------------------- |
| `src/engine/`        | Pure rules                    |
| `src/room/`          | `RoomProvider`                |
| `src/ui/card/`       | Word tile (`WordCard`)        |
| `src/ui/components/` | Shared chrome controls        |
| `src/app/`           | App shell                     |
| `src/styles/`        | Tokens + Tailwind bridge      |
| `docs/handoff/`      | Canonical design specs        |
| `docs/planning/`     | Engine, architecture, roadmap |

## Doc precedence

1. `docs/handoff/*` — visual/UI
2. `docs/planning/codenames-engine-contract.md` — game rules
3. Architecture brief → roadmap → convenience
