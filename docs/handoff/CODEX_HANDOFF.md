# Codex handoff — Warm Sand design foundation

Use this document when implementing UI without human design review. **Do not invent** visuals, spacing, colors, or component anatomy.

## Canonical file order

1. [`component-specs.md`](component-specs.md) — component behavior and sizing
2. [`Card.html`](Card.html) — word tile markup reference
3. [`card.css`](card.css) — word tile CSS reference (sync with `src/ui/card/Card.css`)
4. [`tokens.css`](tokens.css) — tokens (sync with `src/styles/tokens.css`)
5. [`tailwind.config.js`](tailwind.config.js) — **reference only**; live app uses Tailwind v4 `@theme` in `src/styles/globals.css`

Repo guardrails: [`AGENTS.md`](../../AGENTS.md)

## Allowed patterns

- `--cn-*` CSS variables and mapped Tailwind utilities (`bg-surface`, `text-red-on`, `font-ar`, `shadow-tile`, `rounded-bar`, `max-w-shell`)
- `.cn-shell` for the centered 480px column
- Logical properties: `margin-inline`, `padding-inline`, `inset-inline-start`
- `WordCard` structure from `Card.html` (`data-role`, `data-view`, `.is-revealed`)
- Faction glyphs from `src/ui/card/glyphs.tsx` — never color-only state
- Rubik (UI/Latin), Cairo (Arabic board words 17px/600), DM Mono (codes/counts)
- Primary CTA: `bg-primary text-primary-on shadow-cta` (ink, not team color)

## Forbidden patterns

- Raw hex/rgb in TSX/CSS outside `tokens.css`
- Tailwind arbitrary values: `w-[…]`, `max-w-[480px]`, `bg-[#…]`
- Physical `left` / `right` (use logical equivalents)
- Team colors on global CTAs (Start, Send, primary buttons)
- New glyphs or faction marks without design approval
- Reusing `WordCard` for non-tile UI (panels, lobby sections)
- Copying values from `docs/planning/codenames-hub-design-system.md` (superseded by handoff)

## Implementation order (after foundation pass)

| Step | Component | Spec section | Depends on |
| --- | --- | --- | --- |
| 1 | `WordCard` | Card.html, card.css | Done — `src/ui/card/` |
| 2 | `Board` | component-specs Board | WordCard |
| 3 | `TopBar` | component-specs TopBar | tokens, glyphs |
| 4 | `ClueBar` | component-specs ClueBar | tokens |
| 5 | `Lobby` | component-specs Lobby | tokens, Button |

Do not skip ahead without the reference component for that surface.

## PR checklist (per component)

- [ ] Read the matching section in `component-specs.md` end-to-end
- [ ] All colors/spacing/radii from tokens (grep for `#` in changed files — should only hit `tokens.css`)
- [ ] Logical properties only; RTL default verified at 390px width
- [ ] Touch targets ≥ 44px on interactive elements
- [ ] Identity uses glyph + color (not color alone)
- [ ] `npm run typecheck && npm run lint && npm run test && npm run build` pass
- [ ] No new arbitrary Tailwind classes

## Visual acceptance (Card — done)

- [ ] Operative resting: surface tile, no corner key
- [ ] Spymaster resting: tint + border + corner glyph + top key bar
- [ ] Revealed: faction fill, watermark + reveal glyph, word on back
- [ ] Flip 190ms with overshoot ease; reduced motion disables flip transition
- [ ] Arabic word: Cairo 17px; Latin: Rubik 13px

## Visual acceptance (next: Board)

- [ ] 5×5 grid, gap 6px, tile aspect `1 / 0.92`
- [ ] Fits ~390px without horizontal scroll
- [ ] Operative tap reveals; spymaster sees keys on unrevealed tiles
- [ ] Assassin hidden from operatives until revealed

## When blocked

Stop and ask if:

- A required token does not exist in `tokens.css`
- Specs conflict between handoff files
- Engine `PlayerView` shape does not map cleanly to a component state

Do not guess hex values, font sizes, or layout numbers.
