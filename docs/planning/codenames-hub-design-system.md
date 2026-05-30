# Codenames Hub: Design System (v0)

This is the single source of truth for visual decisions. The coding agent implements against it and never invents palette, type, spacing, or component anatomy. If a needed value is not a token here, the agent stops and asks rather than guessing.

## Aesthetic direction

Warm tactile board game with a quiet espionage accent. Think a premium board-game box: warm paper surface, confident saturated team colors, soft card depth, and a brass cipher accent for codes and clue numbers. Friendly enough for kids, with enough character to not feel like a generic web app. Arabic typography is a first-class citizen, not a retrofit.

One memorable thing: cards feel like physical tiles that flip to reveal their allegiance. Lean into that tactility (depth, a satisfying reveal) and keep everything else calm.

## Typography

- Primary family (Arabic + Latin in one voice): **Rubik**. It covers both scripts with a coherent, slightly rounded, geometric feel that suits a family game. Using one family keeps the per-room language switch visually consistent.
- If Arabic warmth needs more, swap the Arabic face to **Cairo** or **Tajawal** while keeping Latin on Rubik. Decide once, then lock.
- Cipher accent (clue numbers, room join codes, counts): **DM Mono**. The monospace gives the espionage character and makes codes unmistakable.
- Arabic renders ~10 to 15 percent larger than Latin for equal legibility. Bake this into the type scale, do not eyeball per component.
- Avoid the generic defaults (Inter, Roboto, Arial, system stacks). The fonts above are the identity.

## Color tokens

Defined as CSS custom properties. The agent uses the Tailwind semantic classes mapped to these, never raw hex.

```css
:root {
  /* surfaces */
  --bg:            #F4F1EA;  /* warm paper backdrop */
  --surface:       #FFFFFF;  /* unrevealed card */
  --surface-edge:  #E6E0D3;  /* card border, hairlines */

  /* ink */
  --ink:           #1F1B16;  /* primary text */
  --ink-soft:      #6E665A;  /* secondary text */
  --on-color:      #FBF8F2;  /* text on saturated fills */

  /* teams */
  --red:           #C8483F;  /* red team revealed fill */
  --red-tint:      #F6DAD6;  /* red key-tint bg (spymaster view) */
  --blue:          #2E6FB0;  /* blue team revealed fill */
  --blue-tint:     #D7E5F4;  /* blue key-tint bg (spymaster view) */

  /* board roles */
  --neutral:       #CBB892;  /* bystander revealed fill */
  --neutral-tint:  #EBE2CE;
  --assassin:      #16130F;  /* assassin revealed fill */
  --assassin-edge: #C8483F;  /* danger edge on assassin */

  /* accent */
  --brass:         #B5893B;  /* primary actions, codes, clue numbers */
  --brass-strong:  #8F6B2A;

  /* feedback */
  --ok:            #2F8F6B;
  --warn:          #C97A2B;

  /* depth + motion */
  --shadow-card:   0 1px 2px rgba(31,27,22,.08), 0 4px 12px rgba(31,27,22,.06);
  --radius-card:   14px;
  --radius-ctrl:   10px;
  --radius-pill:   999px;
  --ease:          cubic-bezier(.2,.7,.2,1);
}
```

Tailwind theme extension (so the agent writes `bg-team-red`, `text-ink`, `rounded-card`, not arbitrary values):

```js
// tailwind.config.js -> theme.extend
colors: {
  bg: 'var(--bg)', surface: 'var(--surface)', edge: 'var(--surface-edge)',
  ink: { DEFAULT: 'var(--ink)', soft: 'var(--ink-soft)', on: 'var(--on-color)' },
  team: { red: 'var(--red)', 'red-tint': 'var(--red-tint)',
          blue: 'var(--blue)', 'blue-tint': 'var(--blue-tint)' },
  role: { neutral: 'var(--neutral)', 'neutral-tint': 'var(--neutral-tint)',
          assassin: 'var(--assassin)' },
  brass: { DEFAULT: 'var(--brass)', strong: 'var(--brass-strong)' },
},
borderRadius: { card: 'var(--radius-card)', ctrl: 'var(--radius-ctrl)', pill: 'var(--radius-pill)' },
fontFamily: { sans: ['Rubik','sans-serif'], mono: ['"DM Mono"','monospace'] },
```

## Spacing, sizing, motion

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. No values outside the scale.
- Touch targets: every interactive element at least 44px in both dimensions.
- Card radius 14px, control radius 10px, pills fully rounded.
- Reveal animation: scale-and-fade with a color wash, 160 to 200ms, `--ease`. Stagger only on the initial board deal. Respect `prefers-reduced-motion` and drop to an instant state change.
- Shadows are subtle and warm (see `--shadow-card`). No hard black drop shadows.

## Layout (mobile-first, one column)

Design at a 390px baseline. The board is the focal element; chrome stays compact so the 5x5 grid fits without scrolling where possible.

- Top bar (compact): team remaining counts (red and blue), whose turn it is. No language control in-game; language is set in the lobby.
- Center: 5x5 board grid, 6 to 8px gap, square-ish tiles, word centered, text auto-shrinks to fit, enforce a minimum tile height for tap comfort.
- Bottom bar (thumb zone): clue area.
  - Spymaster: word input plus a number stepper plus a give-clue button.
  - Operatives: the current clue (word and number in the mono accent) plus guesses remaining plus an end-turn button.
- Good web view = the same column centered on desktop at max-width ~480px over the `--bg` backdrop. Do not build a separate desktop layout for the MVP.

## Direction (RTL)

- Use CSS logical properties only: `margin-inline-start`, `padding-inline`, `inset-inline`, `text-align: start`. Never `left` or `right`.
- The document `dir` is set from the chrome language (default RTL). The board grid is direction-symmetric, so the same grid serves both.
- Latin words inside an RTL page render correctly via the browser's bidi handling; do not force direction on individual word labels.

## Card states (the heart of the UI)

Each card has a single visual source of truth driven by the derived view:

- Unrevealed, operative view: `--surface` tile, `--ink` word, `--surface-edge` border.
- Unrevealed, spymaster view: same tile with a key tint by identity (`--red-tint`, `--blue-tint`, `--neutral-tint`, or a dark hint for assassin) plus an identity glyph.
- Revealed: filled with the identity color (`--red`, `--blue`, `--neutral`, `--assassin`), `--on-color` word, identity glyph shown.
- Assassin revealed: `--assassin` fill with the `--assassin-edge` danger edge.
- Disabled (not your turn or wrong role): reduced affordance, no hover or press feedback.

Never convey identity by color alone. Pair every state with a glyph or label (a red faction mark, a blue faction mark, a neutral dot, a dagger or skull for assassin) so it works for color-blind players and in bright sunlight.

## Component inventory (MVP)

Card, Board (5x5 grid), TopBar (scores plus turn), ClueBar (role-aware bottom bar), RoleBadge, Lobby (room code with copy, join field, team and role assignment, language selector, start), Button (primary brass, secondary, icon), Toast or banner for key events (assassin hit, win).

## Rules for the coding agent

Put these in `AGENTS.md` at the repo root and point the agent at this file and the token files.

- Use only theme tokens. No raw hex, rgb, or arbitrary px. No Tailwind arbitrary values like `w-[37px]` or `bg-[#abc]`.
- Logical properties only. Never `left` or `right`. The app must work in RTL by construction.
- Mobile-first. Base styles target ~390px; layer responsive utilities upward. Center the column at max-width on larger screens.
- Every interactive target is at least 44px.
- Never convey state by color alone; always pair with a glyph or label.
- Match the reference `Card` component's structure and class conventions for all other components.
- If a needed value or pattern is not covered here, stop and ask. Do not invent design decisions.
