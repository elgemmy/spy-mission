# Agent instructions

Read before changing this codebase.

## Sources of truth

Public product name: **Spy Mission**. Internal paths may still say `codenames`.

### Design (canonical — Warm Sand handoff)

1. [`docs/handoff/component-specs.md`](docs/handoff/component-specs.md)
2. [`docs/handoff/Card.html`](docs/handoff/Card.html)
3. [`docs/handoff/card.css`](docs/handoff/card.css)
4. [`docs/handoff/tokens.css`](docs/handoff/tokens.css) — values reference; live copy is [`src/styles/tokens.css`](src/styles/tokens.css) and may be a superset
5. [`docs/handoff/landing/landing-spec.md`](docs/handoff/landing/landing-spec.md) — landing page

Use only Warm Sand `--cn-*` tokens. Do not invent palette or type from memory.

### Engine & architecture

- **Room lifecycle:** [`docs/room-lifecycle-contract.md`](docs/room-lifecycle-contract.md)
- **Engine:** [`docs/planning/codenames-engine-contract.md`](docs/planning/codenames-engine-contract.md)
- **Routing:** [`docs/planning/adr-001-landing-and-play-route.md`](docs/planning/adr-001-landing-and-play-route.md)
- **Current multiplayer path:** browser → authenticated `/api/rooms` → server domain/engine → service-role Supabase → role-filtered `RoomSnapshot` → state-free Realtime invalidation + polling
- **Historical only:** [`docs/planning/codenames-hub-architecture-brief.md`](docs/planning/codenames-hub-architecture-brief.md) is superseded (it still describes client last-write-wins and Netlify)

### Precedence when docs conflict

1. `docs/handoff/*` for visual/UI decisions (live tokens in `src/styles/tokens.css` if they have diverged)
2. `codenames-engine-contract.md` for game rules and state
3. `room-lifecycle-contract.md` for rooms, auth, and access
4. `adr-001-landing-and-play-route.md` for `/` vs `/play/`
5. Implementation convenience

## Hard rules

### Secrets

- Never commit real API keys or Supabase credentials.
- Never hardcode secrets in source. Use `src/config/env.ts` and `.env.local`.
- Keep `.env.example` as placeholders only (`__REPLACE_ME__`).

### Engine (`src/engine`)

- Pure and deterministic: no `Date`, no `Math.random`, no I/O, no React, no Supabase.
- Randomness only in `startGame` deal via `seed`.
- State must be JSON-serializable.
- Illegal actions throw `IllegalMove` with exact contract codes.
- UI dispatches actions and renders `PlayerView`; it does not mutate rules directly.

### Styling

- Use `--cn-*` tokens via Tailwind semantics (`bg-surface`, `text-red-ink`, `font-ar`, `shadow-tile`) or component CSS that references tokens.
- **No raw hex/rgb in components.** No Tailwind arbitrary values (`w-[37px]`, `max-w-[480px]`).
- Use **`max-w-shell`** or **`.cn-shell`** for the 480px column — never hardcode 480px in utilities.
- CSS **logical properties only** — no `left` / `right`.
- Mobile-first (~390px). Minimum **44px** touch targets.
- **Never convey identity by color alone** — always pair faction colors with glyphs (`src/ui/card/glyphs.tsx`).
- Global primary CTA uses **`primary` / `primary-on` (ink on surface)** — not team colors.

### Word tile vs chrome

- **`WordCard`** (`src/ui/card/Card.tsx`) = interactive board tile (flip, glyphs). Mirror `docs/handoff/Card.html`.
- Do not reuse `WordCard` for panels, lobby cards, or info boxes.

### Design decisions

If a value or pattern is not in handoff docs or tokens, **stop and ask** — do not invent.

## Swapping design system

Replace `src/styles/tokens.css` (handoff canonical). Update `src/styles/globals.css` `@theme` only if new token names are added. Keep `docs/handoff/` in sync when the design team ships updates.

## Routing & surfaces

Decision record: [`docs/planning/adr-001-landing-and-play-route.md`](docs/planning/adr-001-landing-and-play-route.md).

- The site has two surfaces: the marketing landing at `/` (`index.html` →
  `src/landing/main.tsx`) and the game at `/play/` (`play/index.html` →
  `src/main.tsx`).
- The landing lives in `src/landing/` and **must not** import from
  `src/engine`, `src/room`, or `src/lib/supabase`.
- **All `/play/` URLs come from `src/config/routes.ts`** (`playUrl`,
  `absolutePlayUrl`, `readPlayParams`, `playHostLabel`). No literal `/play/`
  strings in components.
- Only the game is a PWA: manifest `id`/`start_url`/`scope` are `/play/`, and
  the service worker is registered only from `src/main.tsx`.

## Room sync

- With Supabase environment variables present, room access goes through the
  authenticated `/api/rooms` server boundary. Never restore direct browser
  CRUD on `public.rooms` or return raw `GameState` to clients.
- Without Supabase environment variables, local design preview uses the
  in-memory local provider and is neither persistent nor cross-device multiplayer.

## Tests

- Engine: `npm run test` — `src/engine/codenames/*.contract.test.ts`
- UI foundation: `src/ui/card/Card.test.tsx`, `src/styles/tokens.test.ts`
