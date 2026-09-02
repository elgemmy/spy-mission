# ADR-001 — Marketing landing at `/`, game at `/play/`, PWA scoped to the game

**Status:** accepted · **Date:** 2026-08-23 · **Branch:** `feat/landing-page-and-play-route`

## Context

Until now the game shell lived at the site root. The product now ships a public
landing page (design source: Claude Design project `Awesome Codenames` →
`Spymaster Mission Landing.html`, mirrored under `docs/handoff/landing/`).
The integration retains the existing Codenames Hub product identity; the
reference artifact's proposed name is not adopted here. Requirements:

1. The base domain is reserved for the landing page.
2. The game moves to a route on the same origin: **`/play/`**.
3. Only the game is installable as a PWA. An "Install" affordance on the landing
   page must install the **game**, never the landing page.
4. Production quality: typed, tested, token-driven styling, RTL-first, a11y.

## Decision

### 1. One Vite project, two HTML entries (MPA)

```
index.html          → landing   (src/landing/main.tsx)
play/index.html     → game      (src/main.tsx → src/app/App.tsx)
```

Rationale: the landing must not pull in the engine, room/session layer, Supabase
client or the service-worker runtime; the game must not pay for marketing assets.
Vite's MPA mode gives each entry its own `<head>` (SEO/OG meta, theme-color),
its own bundle, and shared vendor chunks (React) for free. A client-side router
would have coupled the two surfaces and complicated PWA scoping.

### 2. PWA scoping

| Setting                        | Value                             |
| ------------------------------ | --------------------------------- |
| manifest `id` / `start_url`    | `/play/`                          |
| manifest `scope`               | `/play/`                          |
| SW registration scope          | `/play/` (`VitePWA({ scope })`)   |
| SW file                        | `/sw.js` (root; scope narrowed)   |
| `injectRegister`               | `null` — the game registers via `virtual:pwa-register` |
| `navigateFallback`             | `/play/index.html`, allow-list `^/play(/|$)` |
| `globIgnores`                  | landing entry (`index.html`, `assets/landing-*`) |

`vite-plugin-pwa` injects `<link rel="manifest">` into **both** pages. That is
intentional: a browser install initiated from the landing page (Chromium
`beforeinstallprompt`, iOS "Add to Home Screen") resolves the manifest's
`start_url`/`scope`, so the installed app is the game. The landing page itself
never registers a service worker, so it is never cached/offline and never the
installed root.

### 3. Deep links into the game (`src/config/routes.ts`)

| URL                     | Behaviour                                          |
| ----------------------- | -------------------------------------------------- |
| `/play/`                | game onboarding (create / join)                    |
| `/play/?create=1`       | jump straight to the "choose your name" create step |
| `/play/?room=CODE`      | invite link (existing behaviour, path now `/play/`) |
| `/play/?install=1`      | open the install sheet (fallback when the landing  |
|                         | page cannot prompt directly, e.g. iOS/Firefox)     |

All URLs are produced by `playUrl()` in `src/config/routes.ts`; no literal
`/play/` strings in components.

### 4. Install affordance

`src/lib/pwa/installPrompt.ts` captures `beforeinstallprompt` at module load
(before React mounts) and exposes `useInstallPrompt()` →
`{ canPrompt, prompt, isStandalone, platform }`. Landing "Install" button:
`canPrompt ? prompt() : navigate(playUrl({ install: true }))`. The game shows a
platform-aware `InstallSheet` (iOS: Share → Add to Home Screen; Chromium:
native prompt) and a small install button on its onboarding screen when
`!isStandalone`.

### 5. Hosting

`vercel.json` rewrites `/play` and `/play/*` (non-asset) to `/play/index.html`
and serves `sw.js` / `manifest.webmanifest` with `Cache-Control: no-cache` so
updates propagate. Any static host can replicate these two rules.

### 6. Styling rules for the landing

The landing follows the repo's token discipline (`AGENTS.md`): `--cn-*` tokens
only, no raw hex in components, logical properties, ≥44px targets, glyph +
colour for identity. Landing-only values from the design source are added as
tokens (`--cn-shadow-float`, `--cn-shadow-phone`, `--cn-phone-frame`,
`--cn-max-w-landing`) in `src/styles/tokens.css` and mirrored to
`docs/handoff/tokens.css`. The landing's primary CTA is **red** (team colour)
because the design source specifies it for marketing surfaces; the in-game
"ink on surface" CTA rule is unchanged.

## Consequences

- `npm run build` emits `dist/index.html` (landing) and `dist/play/index.html`.
- Existing invite links to `/?room=CODE` stop working; `vercel.json` adds a
  redirect `/?room=:code` → `/play/?room=:code` for the transition.
- The PWA `id` changes from `/` to `/play/`; browsers treat it as a new app.
  Existing installs (pointing at `/`) will open the landing; users reinstall
  from the game. Acceptable pre-launch.
