# Landing page — component spec (Warm Sand · "Spymaster Mission")

Source of truth: `Spymaster Mission Landing.html` + `cn-landing.jsx` +
`cn-components.jsx` + `cn-lobby.jsx` in this folder. This document translates
the prototype into repo conventions. Where this doc and the prototype disagree
on a _visual_ value, the prototype wins; where they disagree on _engineering_
(tokens, a11y, routing), this doc wins.

Global rules (from `AGENTS.md`): `--cn-*` tokens only (no raw hex/rgb in
TSX/CSS; the only exception is the boot splash in `index.html` which runs
before the stylesheet exists), no Tailwind arbitrary values, logical
properties only, ≥ 44 px hit areas on every interactive element, glyph +
colour for identity, `prefers-reduced-motion` disables transforms/flip.

Implementation lives in `src/landing/`:

```
main.tsx               entry (styles, GlyphDefs, boot-splash removal)
LandingPage.tsx        composition of the sections below
Landing.css            all landing CSS, classes prefixed `cn-lp-`
strings.ts             STR.ar / STR.en (typed, identical key sets)
useLang.ts             'ar' | 'en' state, localStorage "sm-lang", html lang/dir
data/demoBoard.ts      LAYOUT, WORDS_AR, WORDS_EN, ROW, ROT (from cn-components/cn-landing)
sections/Nav.tsx       Hero.tsx  HoverRow.tsx  HowToPlay.tsx  Features.tsx
sections/Screens.tsx   (PhoneFrame, LobbyPreview, BoardPreview)
sections/ClosingCta.tsx Footer.tsx
```

Shared primitives (new, reusable by the game):

- `src/ui/components/Mark.tsx` — 2×2 wordmark, `size` prop; cells red/blue/
  neutral/assassin, gap `size*0.11`, radius `size*0.16` (inline `style` for the
  two derived numbers is acceptable; colours via tokens).
- `src/ui/components/EyeMark.tsx` — spymaster eye (path + pupil from
  `cn-lobby.jsx`), `size`, `color` (default `currentColor`), `aria-hidden`.

Routing: every link into the game uses `playUrl()` from `src/config/routes.ts`.
"Create a room" CTAs → `playUrl({ create: true })`. Host label/mono links →
`playUrl()` with visible text `playHostLabel(window.location.host)`.

---

## Page root

`<div class="cn-lp" dir={lang==='ar'?'rtl':'ltr'}>` — `background: var(--cn-bg)`,
`color: var(--cn-ink)`, `min-height: 100dvh`, font family `var(--cn-font-ar)`
for `ar`, `var(--cn-font-ui)` for `en` (set `data-lang` on root and switch the
family in CSS). Anchors inside: `color: var(--cn-red-ink)`, hover `var(--cn-red)`.

`.cn-lp-wrap` — `max-width: var(--cn-max-w-landing)` (1060px), `margin-inline:
auto`, `box-sizing: border-box`.

Buttons:

- `.cn-lp-btn--primary` — inline-flex, center, `background: var(--cn-red)`,
  `color: var(--cn-red-on)`, weight 700, `border-radius: var(--cn-r-bar)`,
  `box-shadow: 0 6px 18px color-mix(in srgb, var(--cn-red) 35%, transparent)`,
  hover `translateY(-2px)` + `0 10px 24px … 42%`, `transition: transform .18s
var(--cn-flip-ease), box-shadow .18s`, `min-height: 44px`.
- `.cn-lp-btn--secondary` — `background: var(--cn-surface)`, `color:
var(--cn-ink)`, `border: 1px solid var(--cn-line)`, same radius/hover/min-height.
- Focus: `outline: 2px solid var(--cn-ink); outline-offset: 2px` on
  `:focus-visible`.

Size variants (font-size / padding): nav `14 / 8px 16px`; hero primary
`17 / 13px 26px`; hero secondary `15 / 12px 20px`; closing `18 / 15px 34px`.

---

## Nav (`<nav aria-label>`)

Sticky top, `z-index: 20`, `background: color-mix(in srgb, var(--cn-bg) 82%,
transparent)`, `backdrop-filter: blur(10px)` (+ `-webkit-`), `border-block-end:
1px solid var(--cn-line)`. Inner `.cn-lp-wrap`: flex, center, gap 12, padding
`13px 24px`.

1. `Mark size=30`
2. Wordmark "Spymaster Mission" — `var(--cn-font-ui)` 17 / 700, letter-spacing
   `-.01em` (always Latin).
3. `margin-inline-start: auto` group, gap 10:
   - Language toggle — `role="group" aria-label`; pill: `background:
var(--cn-surface)`, `border: 1px solid var(--cn-line)`, radius 999,
     padding 3. Two `<button aria-pressed>`: "عربي" (Cairo) / "EN" (Rubik),
     13 / 700, padding `5px 12px`, radius 999, `min-height: 38px` _and_ a
     44 px hit area (`min-width: 44px`). Active: `background: var(--cn-red)`,
     `color: var(--cn-red-on)`; idle: `color: var(--cn-ink-soft)`. `transition:
all .18s`.
   - `.cn-lp-btn--primary` (nav size) → `playUrl({ create: true })`, text `STR.play`.

---

## Hero (`<header class="cn-lp-wrap cn-lp-hero">`)

Padding `58px 24px 8px`. Grid `1.02fr 1fr`, gap 52, `align-items: center`.
≤ 940 px: one column, gap 40.

Left column:

- Tag — 13.5 / 700, `color: var(--cn-red-ink)`, margin-block-end 14. EN:
  `letter-spacing: .1em; text-transform: uppercase`. AR: none.
- `<h1>` — AR 47 px, EN 52 px; 700; line-height 1.12; EN letter-spacing
  `-.02em`; margin `0 0 18px`; `text-wrap: balance`. Contains the highlighted
  span (`STR.h1Highlight`: "٢٥ كلمة." / "25 words.") in `var(--cn-red-ink)`.
  Shape: `{h1Before} <span>{h1Highlight}</span> {h1After}`.
- Sub `<p>` — 17.5, line-height 1.6, `var(--cn-ink-soft)`, margin `0 0 28px`,
  `max-width: 460px`.
- CTA row — flex, gap 12, wrap, center: primary → `playUrl({ create: true })`;
  secondary `href="#how"` → `STR.how`.
- Host line — `dir="ltr"`, margin-block-start 18, `<a>` mono 12.5,
  `text-decoration: none`, href `playUrl()`, text `playHostLabel(host)`.

Right column — **MiniBoard** (interactive):

- Wrapper `.cn-lp-tilt`: `transform: rotate(-1.4deg)`, hover `rotate(0)`,
  `transition: transform .35s var(--cn-flip-ease)`; reduced-motion: no
  transform/transition.
- Card: `background: var(--cn-surface)`, `border: 1px solid var(--cn-line)`,
  radius 22, padding `14px 14px 12px`, `box-shadow: var(--cn-shadow-float)`.
- Header row (flex, between, gap 8, padding `0 2px 10px`): `LandChip red`
  (`9 − revealed red`), label `STR.tryMe` 12 / 700 ink-soft, `LandChip blue`
  (`8 − revealed blue`). `LandChip`: flex, center, gap 6, padding
  `5px 11px 5px 9px`, radius 999, `background: var(--cn-{role}-tint)`,
  `color: var(--cn-{role}-ink)`; `GlyphIcon` 14 px coloured `var(--cn-{role})`;
  number mono 15 / 500 `font-variant-numeric: tabular-nums`.
- Grid `repeat(5, 1fr)`, gap 6, 25 × `WordCard` (`view="operative"`,
  `lang`, `revealed={set.has(i)}`, `aria-label={word}`, `onClick` adds `i`;
  revealed cards `disabled`). Data: `LAYOUT` roles + `WORDS_AR|EN` (ignore the
  `r` flags here — MiniBoard starts fully hidden).
- Reset row (flex, center, padding-block-start 10): `<button>` `STR.reset`
  12.5 / 700 ink-soft, `background: var(--cn-surface-2)`, border line, radius
  999, padding `6px 14px`, min-height 44 → clears the set.
- Re-key the board on `lang` change so the tiles re-render with the new words.

---

## HoverRow

Flex, gap 12, center, wrap, padding `34px 24px 10px`. Eight `WordCard`s
(`dense`, `view="operative"`) from `ROW` in 106 px-wide wrappers rotated by
`ROT[i]` degrees. `onMouseEnter` → revealed, `onMouseLeave` → hidden,
`onClick` toggles (keyboard/touch path). `aria-label={word}`. Re-key on `lang`.

---

## Section heading

`<h2 class="cn-lp-h2">` — 30 / 700, margin `0 0 26px`, centered; EN
letter-spacing `-.01em`. Font follows page language.

## How to play (`<section id="how" class="cn-lp-wrap">`, padding `64px 24px 0`)

Grid `repeat(3, 1fr)`, gap 18; ≤ 760 px: one column. Step card: `background:
var(--cn-surface)`, border line, radius 18, padding `20px 20px 18px`.

- Index — mono 13 / 500 `var(--cn-red-ink)`, margin-block-end 8: `01`, `02`, `03`.
- Visual (height 74, centered):
  1. Code chip `dir="ltr"` — mono 25 / 500, letter-spacing `.06em`,
     `color: var(--cn-ink)`, `background: var(--cn-surface-2)`, `border: 1.5px
dashed var(--cn-neutral)`, radius 12, padding `10px 18px`, text `QMR-72K`.
  2. Clue pill — flex, center, gap 10, `background: var(--cn-surface-2)`,
     border line, `border-radius: var(--cn-r-bar)`, padding `10px 16px`:
     `EyeMark 18` ink · `STR.clue` 12 / 700 ink-soft · `STR.clueWord` 19 / 700 ·
     count "3" mono 15 / 500 `var(--cn-red-ink)` on `var(--cn-red-tint)`,
     radius 7, padding `1px 8px`.
  3. Three static 66 px `WordCard`s, no flip transition (`className` that sets
     `transition: none` on `.cn-card__inner`), not interactive (`disabled`,
     `tabIndex={-1}`, `aria-hidden`): `باب/DOOR` neutral hidden · `نار/FIRE`
     red revealed · `سيف/SWORD` assassin revealed.
- `<h3>` 18 / 700, margin `12px 0 6px`; `<p>` 14.5, lh 1.6, ink-soft.

## Features (`.cn-lp-wrap`, padding `64px 24px 0`)

Grid `repeat(4, 1fr)`, gap 16; ≤ 940: 2 columns; ≤ 520: 1. Card: surface,
border line, radius 18, padding `18px 18px 16px`. Icon row height 24,
margin-block-end 10; title 16 / 700, margin-block-end 4; body 13.5, lh 1.55,
ink-soft.

Icons by key: `noapp` → `GlyphIcon blue` 20 in `var(--cn-blue)`; `free` →
`GlyphIcon neutral` 20 in `var(--cn-neutral-ink)`; `bi` → `<span>` 17 / 700:
"ع" (Cairo) + " · A" (Rubik, `var(--cn-red-ink)`); `cb` → four `GlyphIcon`s
13 px, gap 5, each in its `-ink`.

## Inside the game (`.cn-lp-wrap`, padding `68px 24px 0`)

Flex, gap 34, wrap, center, `align-items: flex-start`. Two `PhoneFrame`s:
`STR.screens[0]` → `LobbyPreview`; `STR.screens[1]` (fixed inner height 664)
→ `BoardPreview`.

**PhoneFrame** — column, center, gap 12. Shell: width 412, `max-width: 92vw`,
radius 44, padding 11, `background: var(--cn-phone-frame)`, `box-shadow:
var(--cn-shadow-phone), inset 0 0 0 1px color-mix(in srgb, var(--cn-surface)
4%, transparent)`. Screen: radius 34, overflow hidden, `background:
var(--cn-bg)`, column, `height: h ?? auto`. `StatusMini` (`aria-hidden`): flex,
between, padding `9px 20px 2px`; "9:41" mono 13 / 500; right: "●●●" 11 px +
battery (18×9, `border: 1px solid var(--cn-ink)`, radius 2, inner 70 % fill).
Caption 13 / 700 ink-soft.

**LobbyPreview** (`cn-lobby.jsx › Lobby`) — `dir` by its _own_ `lng` state
(initialised from page `lang`, re-initialised when page `lang` changes). Column,
gap 16, padding `18px 16px calc(18px + env(safe-area-inset-bottom))`.

1. Header — `Mark 32`; title 18 / 700 `STR.lobby.title` ("اسم الرمز" /
   "Codename"), subtitle 12 / 500 ink-soft ("غرفة العائلة" / "Family room");
   presence pill at inline-end: 12 / 600 ink-soft, surface, border line, radius
   999, padding `6px 11px`, 7 px dot `var(--cn-blue)`, text "٥ متصلون" / "5 online".
2. Room-code card — surface, border line, radius bar, padding `16px 16px 14px`,
   `box-shadow: var(--cn-shadow-bar)`. Label 11 / 700, letter-spacing `.06em`,
   ink-soft ("رمز الغرفة" / "ROOM CODE"). Row: code `dir="ltr"` mono 34 / 500,
   letter-spacing `.06em` = `QMR-72K`; **Copy button (interactive)** 13 / 700,
   `background: var(--cn-surface-2)`, border line, radius 999, padding
   `9px 15px`, 15 px icon; on click: `navigator.clipboard?.writeText('QMR-72K')`
   (swallow errors), show "تم النسخ" / "Copied" with check icon, `color:
var(--cn-blue-ink)`, `background: var(--cn-blue-tint)`, `border-color:
var(--cn-blue)` for 1.6 s. Helper 12 ink-soft, margin-block-start 10, lh 1.4.
3. Board language — label (11 / 700 `.06em` ink-soft, "لغة اللوح" / "BOARD
   LANGUAGE") + **segmented control (interactive)**: `background:
var(--cn-surface-2)`, border line, radius 999, padding 3, gap 3; buttons
   `aria-pressed`, flex 1, 13 / 700, padding `8px 0`, radius 999, min-height 44;
   on: surface + ink + `box-shadow: 0 1px 4px color-mix(in srgb, var(--cn-ink)
12%, transparent)`; off: ink-soft. Options "العربية" / "English". Changes `lng`.
4. Teams — flex, gap 10. `TeamCard` (red: "الفريق الأحمر"/"Red team",
   spymaster "سارة"/"Sara", operatives "خالد"/"Khaled" _(you)_, "ريم"/"Reem";
   blue: "الفريق الأزرق"/"Blue team", "عمر"/"Omar", "نورا"/"Noura",
   "يوسف"/"Yousef"): `flex: 1; min-width: 0`, `background: var(--cn-{role}-tint)`,
   `border: 1.5px solid var(--cn-{role})`, radius 16, padding 12, column gap 9.
   - Header: `GlyphIcon` 18 `var(--cn-{role})` · title 14 / 700 `-ink` · count
     (1 + operatives) mono 13 / 500 `-ink` opacity .8 at inline-end.
   - Spymaster slot: flex, gap 8, padding `8px 10px`, surface, `border: 1.5px
solid var(--cn-{role})`, radius 10: `EyeMark 17` `-ink`; name 13 / 700
     ellipsis; label 10 / 700 `-ink` ("سيّد التجسس" / "SPYMASTER", EN
     letter-spacing `.03em`).
   - Operative chips (column, gap 6): flex, gap 8, padding `7px 10px`, surface,
     border line, radius 10: avatar 22 px circle (`var(--cn-surface-2)`, border
     line, first letter 11 / 700 ink-soft) · name 13 / 600 ellipsis · optional
     "أنت" / "you" badge 10 / 700 ink-soft on surface-2, radius 999, padding `1px 6px`.
   - Join row (decorative, render as `<span aria-hidden>` not a button):
     centered 12.5 / 700 `-ink`, `border: 1.5px dashed var(--cn-{role})`,
     radius 10, padding `8px 0`, opacity .9, "+ انضمّ كعميل" / "+ Join as operative".
5. Start CTA (decorative `<span aria-hidden>`): centered 17 / 700,
   `color: var(--cn-surface)`, `background: var(--cn-ink)`, radius bar, padding
   `16px 0`, `box-shadow: var(--cn-shadow-cta)`, "ابدأ اللعب" / "Start game".

**BoardPreview** (`cn-components.jsx › Board`, operative view, interactive) —
column, `min-height: 100%`, `dir` by page `lang`. State: revealed set
initialised from `LAYOUT[i].r`.

- Top bar — flex, between, padding `14px 16px 10px`, gap 8: `CountChip red`
  **active** (`9 − revealed red`), center stack (eyebrow 11 / 600 ink-soft,
  EN letter-spacing `.04em`, "الدور الآن" / "NOW PLAYING"; team 14 / 700
  `var(--cn-red-ink)` "دور الأحمر" / "Red's turn"), `CountChip blue` idle
  (`8 − revealed blue`). `CountChip`: flex, gap 7, padding `6px 12px 6px 10px`,
  `border-radius: var(--cn-r-chip)`; active: `background: var(--cn-{role})`,
  `color: var(--cn-{role}-on)`, `box-shadow: 0 2px 8px color-mix(in srgb,
var(--cn-{role}) 45%, transparent)`; idle: `-tint` / `-ink`; `GlyphIcon` 16;
  number mono 18 / 500 tabular.
- Grid `repeat(5, 1fr)`, gap 6, padding `6px 12px 12px`, 25 × `WordCard`
  (operative, `lang`, revealed from state, click reveals, revealed → `disabled`).
- Clue bar — `margin-block-start: auto`, padding `12px 14px calc(12px +
env(safe-area-inset-bottom))`; inner: surface, border line, radius bar,
  padding `12px 14px`, flex, between, gap 12, `box-shadow: var(--cn-shadow-bar)`:
  left (flex, baseline, gap 8, `min-width: 0`): `STR.clue` 12 / 600 ink-soft ·
  `STR.clueWord` 22 / 700 · "3" mono 18 / 500 `var(--cn-red-ink)` on
  `var(--cn-red-tint)`, radius 8, padding `2px 9px`; right: decorative
  "إنهاء الدور" / "End turn" ghost pill (14 / 700 ink-soft, surface-2, border
  line, radius 999, padding `8px 14px`) as `<span aria-hidden>`.

## Closing CTA (`<section>`, centered, padding `76px 24px 84px`)

`<h2>` 36 / 700, margin `0 0 8px` (`STR.ctaTitle`); `<p>` 16.5 ink-soft,
margin `0 0 24px` (`STR.ctaSub`). Button row (flex, center, wrap, gap 12):
`.cn-lp-btn--primary` closing size → `playUrl({ create: true })`; **Install
button** `.cn-lp-btn--secondary` (`STR.install`: "تثبيت التطبيق" / "Install the
app") — behaviour: `const { canPrompt, prompt, isStandalone } =
useInstallPrompt()`; hidden when `isStandalone`; on click: `canPrompt ? await
prompt() : window.location.assign(playUrl({ install: true }))`. Below: `dir="ltr"`
mono 13 host link (margin-block-start 16) → `playUrl()`.

## Footer (`border-block-start: 1px solid var(--cn-line)`)

`.cn-lp-wrap` flex, center, gap 12, wrap, padding `22px 24px`: `Mark 24` ·
"Spymaster Mission" Rubik 14 / 700 · "· {STR.credit}" 13 ink-soft ·
inline-end `dir="ltr"` mono 12 ink-soft: "© 2026 · " + `<a>` host label →
`playUrl()`.

---

## Strings (`strings.ts`)

Exactly the `STR` object from `cn-landing.jsx` (both languages), plus:
`h1Before` / `h1Highlight` / `h1After` (replacing the JSX `h1`), `install`,
`langGroup` (a11y label for the toggle), `nav` (a11y label), and the lobby /
board preview strings listed above under `lobby.*` / `board.*`. Export
`type LandingStrings` and assert `STR.ar` and `STR.en` share the type.

## Boot splash (`index.html`)

Fixed overlay `#boot` (`inset: 0`, grid center, background `#f1e8da`,
`z-index: 99`, `transition: opacity .35s`) with a 46 px 2×2 pulsing mark
(`@keyframes bootpulse` opacity .45 ↔ 1, 1.1 s). `main.tsx` hides it on the
first animation frame after render (`classList.add('hide')`, remove after 400 ms).
Inline hex here only.

## Tests (`src/landing/LandingPage.test.tsx`, vitest + RTL)

1. Renders Arabic by default: `document.documentElement.dir === 'rtl'`, h1 text
   contains "٢٥ كلمة".
2. Toggling "EN" sets `dir="ltr"`, `lang="en"`, persists `sm-lang`, and the h1
   contains "25 words."; reload-from-storage path honoured.
3. Every "create" CTA (`nav`, hero, closing) has `href === playUrl({ create: true })`;
   host links have `href === playUrl()`.
4. MiniBoard: clicking a red tile decrements the red chip from 9 to 8; reset
   restores 9/8; revealed tile is disabled.
5. LobbyPreview: copy button shows "Copied" state; segmented control switches
   the preview's `dir`.
6. BoardPreview: initial counts reflect `LAYOUT.r` flags (red 7, blue 7);
   clicking a hidden tile updates counts.
7. Install button: with no captured prompt, click → `window.location.assign`
   called with `playUrl({ install: true })`; with a captured prompt, `prompt()`
   is called and no navigation happens; hidden when standalone.

---

## Implementation deviations (recorded at build time)

Everything above is implemented as written except for the following, each of
which is a repo-rule or bug-avoidance concession rather than a design change.

1. **File layout.** `Screens.tsx` keeps the section shell + `PhoneFrame` +
   `StatusMini`; `LobbyPreview` and `BoardPreview` live in their own files next
   to it (they are ~180 and ~90 lines). A small `hostLabel.ts` holds
   `useHostLabel()` (`playHostLabel(window.location.host)`, `window`-safe), and
   the three static step-03 tiles are data, so they sit in
   `data/demoBoard.ts` as `STEP_TILES` alongside `ROW`/`ROT`.
2. **Lobby language re-initialisation.** The spec's "re-initialised when page
   `lang` changes" is done by re-keying `<LobbyPreview key={lang}>` from
   `Screens`, not by an effect: the repo's
   `react-hooks/set-state-in-effect` lint rule rejects `setState` inside an
   effect body. `HoverRow`, `MiniBoard` and `BoardPreview` are re-keyed the
   same way.
3. **44 px hit areas.** The nav language buttons keep the specified 38 px
   visual pill; the 44 px target comes from `min-width: 44px` plus a
   `::before` overlay with `inset-block: -3px` (the enclosing pill is exactly
   44 px tall). The lobby copy button, the segmented control and the
   mini-board reset button additionally carry `min-height: 44px` on top of the
   padding the spec lists.
4. **Page root overflow.** `.cn-lp` uses `overflow-x: clip`, not `hidden`:
   `hidden` would turn the root into a scroll container and break the sticky
   nav. It contains the hero tilt at narrow widths.
5. **Extra breakpoint rules.** Beyond the 940 / 760 / 520 grid changes, the
   ≤ 760 and ≤ 520 blocks step the h1 (47/52 → 38/40 → 32/34) and the closing
   h2 down and reduce section inline padding from 24 px to 16 px, so the page
   does not scroll horizontally at 360 px.
6. **Feature glyph colours.** `GlyphIcon` takes only `role`/`className`, so the
   four colour-blindness glyphs are coloured by small utility classes
   (`.cn-lp-ink-red` … `.cn-lp-solid-blue`) rather than a `color` prop.
7. **Two more ≤ 520 px adjustments.** Alongside the breakpoint rules in (5),
   the ≤ 520 px block also sets `.cn-lp-wordmark` to `font-size: 15px` (down
   from 17 px) and zeroes `.cn-lp-footer__legal`'s `margin-inline-start` (down
   from `auto`) so the footer legal line wraps under the credit line instead
   of fighting it for space at narrow widths.

### Known accessibility trade-off

`--cn-ink-soft` (`#7d7263`) measures 3.88:1 against `--cn-bg` and 4.12:1
against `--cn-surface-2` — both below the WCAG AA 4.5:1 threshold for small
text. It is kept as specified for design fidelity with the prototype; a
token-level change is a design-owner decision, not an implementation one.
