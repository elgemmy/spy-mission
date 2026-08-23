# Agent instructions

Read before changing this codebase.

## Sources of truth

### Design (canonical — Warm Sand handoff)

1. [`docs/handoff/component-specs.md`](docs/handoff/component-specs.md)
2. [`docs/handoff/Card.html`](docs/handoff/Card.html)
3. [`docs/handoff/card.css`](docs/handoff/card.css)
4. [`docs/handoff/tokens.css`](docs/handoff/tokens.css) → live copy: [`src/styles/tokens.css`](src/styles/tokens.css)
5. [`docs/handoff/CODEX_HANDOFF.md`](docs/handoff/CODEX_HANDOFF.md) — execution protocol for Codex

**Do not** use values from `docs/planning/codenames-hub-design-system.md` for UI unless reconciled with handoff. That doc is historical planning only.

### Engine & architecture

- **Engine:** `docs/planning/codenames-engine-contract.md`
- **Architecture:** `docs/planning/codenames-hub-architecture-brief.md`
- **Phasing:** `docs/planning/codenames-hub-roadmap.md`

### Precedence when docs conflict

1. `docs/handoff/*` for all visual/UI decisions
2. `codenames-engine-contract.md` for game rules and state
3. Architecture brief
4. Roadmap
5. Planning design system (historical)
6. Implementation convenience

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

## Room sync

- With Supabase environment variables present, room access goes through the
  authenticated `/api/rooms` server boundary. Never restore direct browser
  CRUD on `public.rooms` or return raw `GameState` to clients.
- Without Supabase environment variables, local design preview uses the
  browser-persisted local provider and is not cross-device multiplayer.

## Tests

- Engine: `npm run test` — `src/engine/codenames/*.contract.test.ts`
- UI foundation: `src/ui/card/Card.test.tsx`, `src/styles/tokens.test.ts`
