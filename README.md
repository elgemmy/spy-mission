# Codenames Hub

Mobile-first Arabic-first Codenames web app. Design system: **Warm Sand** (`docs/handoff`).

## Stack

- React + Vite + TypeScript, multi-page build (landing at `/`, game at `/play/`)
- Tailwind CSS v4 (`@theme` maps `--cn-*` tokens)
- `vite-plugin-pwa` — installable PWA scoped to `/play/`
- Supabase (client placeholder; Phase 4)
- Pure game engine in `src/engine`

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/> for the landing page and
<http://localhost:5173/play/> for the game.

## Routes & PWA

Two HTML entries, one origin — see
[`docs/planning/adr-001-landing-and-play-route.md`](docs/planning/adr-001-landing-and-play-route.md).

| URL      | Entry HTML        | Entry module           | Purpose                      |
| -------- | ----------------- | ---------------------- | ---------------------------- |
| `/`      | `index.html`      | `src/landing/main.tsx` | Marketing landing            |
| `/play/` | `play/index.html` | `src/main.tsx`         | The game (`src/app/App.tsx`) |

### Deep-link params

Every `/play/` URL is produced by `src/config/routes.ts` (`playUrl`,
`absolutePlayUrl`, `readPlayParams`). Never hardcode `/play/` in a component.

| Param     | Values                           | Behaviour                                        |
| --------- | -------------------------------- | ------------------------------------------------ |
| `room`    | room code (trimmed, upper-cased) | Invite link — jumps to "enter your name" to join |
| `create`  | `1` / `true` / bare              | Jumps straight to the create-room name step      |
| `install` | `1` / `true` / bare              | Opens the install sheet                          |

Example: `/play/?room=ABC12&create=1&install=1` (params are emitted in that
stable order). When both `room` and `create` are present, `room` wins and
`create` is ignored — the invite flow takes precedence.

### PWA

Only the game is installable. `manifest.webmanifest` uses `id`, `start_url`
and `scope` of `/play/`; the service worker ships at `/sw.js` but is registered
by `src/main.tsx` (`virtual:pwa-register`) with `scope: "/play/"`. The landing
page never registers a service worker, so it is never cached or installed —
but it does carry `<link rel="manifest">`, so a browser install started from
the landing page installs the **game**. Workbox precache excludes the root
`index.html` and `assets/landing-*`; `navigateFallback` is `/play/index.html`,
allow-listed to `^/play(/|$)`.

**Install flow.** `src/lib/pwa/installPrompt.ts` captures `beforeinstallprompt`
at module load and exposes `useInstallPrompt()` (`canPrompt`, `prompt`,
`isStandalone`, `platform`). The game's onboarding screen shows a "تثبيت
التطبيق" button when not already installed; the landing page's own Install
CTA either triggers the native prompt directly or, when the browser can't
(iOS, Firefox), navigates to `playUrl({ install: true })` — `/play/?install=1`
— which opens `InstallSheet` (`src/ui/components/InstallSheet.tsx`) on arrival
and then strips the `install` param via `history.replaceState` so a refresh
doesn't reopen it. `InstallSheet` shows the native prompt button when
available, or platform-specific instructions (iOS Share sheet, Android
browser menu, desktop address-bar icon) otherwise.

**Update flow.** `vite.config.ts` sets `registerType: "prompt"` — a waiting
service worker never force-reloads the page mid-game. `src/main.tsx` wires
`registerSW`'s `onNeedRefresh`/`onOfflineReady` callbacks into the small store
in `src/lib/pwa/serviceWorker.ts` (`useServiceWorkerStatus`, `applyUpdate`,
`dismissRefresh`); when an update is waiting, `App` renders `UpdateToast`
(`src/ui/components/UpdateToast.tsx`), a non-modal `role="status"` toast with
"تحديث" (applies the update) and "لاحقًا" (dismiss) actions. The service
worker only ever controls `/play/` — it never controls `/`.

### Hosting (`vercel.json`)

- Rewrites `/play/:path*` → `/play/index.html` (Vercel serves real
  static files such as `/assets/*` before rewrites, so they are unaffected).
- Redirects a hand-typed `/play` → `/play/` (permanent), so it lands inside
  the PWA scope.
- Redirects legacy invite links `/?room=CODE` → `/play/?room=CODE` (temporary).
- Serves `/sw.js` and `/manifest.webmanifest` with `Cache-Control: no-cache`.

Any static host can replicate these rules.

### Build output

`npm run build` emits:

```
dist/index.html            landing
dist/play/index.html       game
dist/assets/landing-*.js   landing entry
dist/assets/play-*.js      game entry
dist/manifest.webmanifest  scope /play/
dist/sw.js                 service worker
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

| Path                   | Responsibility                |
| ---------------------- | ----------------------------- |
| `src/engine/`          | Pure rules                    |
| `src/landing/`         | Marketing landing (`/`)       |
| `src/config/routes.ts` | Canonical `/play/` URLs       |
| `src/lib/pwa/`         | Install prompt primitives     |
| `src/room/`            | `RoomProvider`                |
| `src/ui/card/`         | Word tile (`WordCard`)        |
| `src/ui/components/`   | Shared chrome controls        |
| `src/app/`             | App shell                     |
| `src/styles/`          | Tokens + Tailwind bridge      |
| `docs/handoff/`        | Canonical design specs        |
| `docs/planning/`       | Engine, architecture, roadmap |

## Doc precedence

1. `docs/handoff/*` — visual/UI
2. `docs/planning/codenames-engine-contract.md` — game rules
3. Architecture brief → roadmap → convenience
