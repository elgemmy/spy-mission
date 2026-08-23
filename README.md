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

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Local design preview does not require Supabase.

The app currently keeps rooms in memory even when these variables are present.
The Supabase provider remains disabled until a backend authorization boundary
can return player-specific views without exposing hidden game state. Apply all
files in `supabase/migrations/` to revoke legacy anonymous room access.

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
