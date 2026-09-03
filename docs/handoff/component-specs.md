# Component specs (Warm Sand)

Public product name: **Spy Mission**.

Mobile-first, Arabic-first. **Design baseline 390px**; on desktop the same single
column centers at **max-width 480px** (`.cn-shell`). All values reference
`tokens.css`. Chrome (TopBar, ClueBar, Lobby) ships **single-language per room**;
only the **board** switches language per room via the lobby selector.

RTL is the default. Use logical properties everywhere (`inset-inline-start`,
`margin-inline`, `padding-inline`) so the LTR variant is free.

---

## Card → see `Card.html` + `card.css` (the reference component)

The atom every other surface mirrors. Front/back faces inside `.cn-card__inner`;
reveal = 190ms `rotateY(180deg)` with a slight overshoot (`--cn-flip-ease`).
States: `data-view="operative|spymaster"` + `.is-revealed`. Glyph carries identity
so nothing depends on colour alone.

---

## TopBar

**Anatomy** — three zones in one row: `[red count] · [turn indicator] · [blue count]`.

- Count = `CountChip`: faction glyph + tabular DM-Mono number. The **active team's**
  chip is filled (`bg var(--cn-red)`, `text -on`, soft glow); the idle team's chip is
  tinted (`bg -tint`, `text -ink`).
- Turn indicator (center): a 2-line stack — eyebrow label (`الدور الآن` / `NOW PLAYING`)
  over the team name in that team's `-ink`.

**Spacing** — padding `14px 16px 10px`; gap 8; chip padding `6px 12px 6px 10px`,
radius `--cn-r-chip`; glyph 16px; number 18px.

**States** — `turn = red | blue` swaps which chip is filled and the indicator colour.
Counts decrement as cards reveal. When a team hits 0 → win banner replaces the bar.

---

## Board

**Anatomy** — `display:grid; grid-template-columns: repeat(5,1fr); gap:6px`,
25 `Card`s. Padding `6px 12px 12px`. At 390px each tile is ≈ 68px wide,
aspect `1 / 0.92`.

**Type** — Arabic board words use Cairo at **17px / 600** (Latin: Rubik 13px).
This is the validated floor — Arabic any smaller crowds at tile size.

**States per tile** — operative: idle plain tile, tap → flip reveal. Spymaster:
every unrevealed tile shows its key tint + corner glyph + top key bar; revealed
tiles match the operative reveal. Assassin is only ever distinguishable to the
spymaster until revealed.

---

## ClueBar

**Anatomy** — a floating `--cn-surface` bar pinned to the bottom
(`margin-top:auto`), radius `--cn-r-bar`, `shadow-bar`, padding `12px 14px`,
plus `env(safe-area-inset-bottom)`.

- **Operative view**: `CLUE` eyebrow · clue word (22px/700) · number pill
  (DM-Mono on `-tint`) … and an `End turn` ghost pill at the inline-end.
- **Spymaster view**: 2-line "give a clue" prompt + faux input … and a filled
  `Send` button (`bg var(--cn-red)` while red is active).

**States** — empty (awaiting clue) → active clue (number pill shows guesses left)
→ disabled (other team's turn, 55% opacity).

---

## Lobby

**Anatomy** (top → bottom):

1. **Header** — 2×2 tile wordmark + product name + presence pill.
2. **Room-code hero** — `--cn-surface` card, radius `--cn-r-bar`: `ROOM CODE`
   label, code in DM-Mono **34px** (`dir=ltr`, letter-spacing .06em), Copy
   button (→ "Copied" turns blue-tint), share helper line.
3. **Board-language** — label + segmented control `[العربية | English]`.
   This is the only language control; it sets the board language for the room.
4. **Teams** — two `TeamCard`s side by side. Each: faction header + count,
   a highlighted **spymaster slot** (eye mark + `SPYMASTER`), operative chips,
   and a dashed `Join as operative` button. The eye = spymaster (the one who sees
   the key); it never collides with the four faction glyphs.
5. **Start** — full-width primary CTA (`bg var(--cn-ink)`, `shadow-cta`),
   radius `--cn-r-bar`.

**Spacing** — shell padding `18px 16px`; section gap 16; team gap 10;
chip radius `--cn-r-sm`.

**States** — copy (idle → copied 1.6s) · language (ar ⇄ en, live) ·
team join · start (enabled once each team has ≥1 spymaster + ≥1 operative).
