# Landing page — design reference (canonical)

Source: Claude Design project **Awesome Codenames** →
`Spymaster Mission Landing.html` (+ `cn-components.jsx`, `cn-lobby.jsx`,
`cn-landing.jsx`). These files are the visual source of truth for
`src/landing/`. They are prototype code (Babel-in-browser, inline styles) and
are **not** imported by the app — the app re-implements them with repo
conventions (tokens, Tailwind v4 `@theme`, logical properties, `WordCard`,
`GlyphIcon`).

Translation notes (design → repo):

| Design prototype                | Repo implementation                                  |
| ------------------------------- | ---------------------------------------------------- |
| `Card` (inline styles)          | `src/ui/card/WordCard` (`docs/handoff/Card.html`)     |
| `Glyph`                         | `src/ui/card/glyphs.tsx` `GlyphIcon` (+ `GlyphDefs`)  |
| `EyeMark`                       | `src/ui/components/EyeMark.tsx`                       |
| `Mark` (2×2 wordmark)           | `src/ui/components/Mark.tsx` (same as `.cn-wordmark`) |
| `THEMES.sand` vars              | `src/styles/tokens.css` (already identical values)    |
| `PLAY_URL` external host        | same-origin `/play/` via `src/config/routes.ts`       |
| `.btnP` red CTA                 | `.cn-landing-btn--primary` (red is intentional here)  |
| `rgba(...)` shadows, `#28241f`  | new tokens `--cn-shadow-float`, `--cn-shadow-phone`, `--cn-phone-frame` |
| `.wrap` 1060px                  | `--cn-max-w-landing` / `.cn-landing-wrap`             |

See `docs/planning/adr-001-landing-and-play-route.md` for the routing/PWA
decisions.
