# Landing page — design reference

Canonical spec: [`landing-spec.md`](landing-spec.md).
Implementation: `src/landing/`.

The public product name is **Spy Mission**.

Translation notes (design → repo):

| Design reference               | Repo implementation                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `Card` (inline styles)         | `src/ui/card/WordCard` (`docs/handoff/Card.html`)                                       |
| `Glyph`                        | `src/ui/card/glyphs.tsx` `GlyphIcon` (+ `GlyphDefs`)                                    |
| `EyeMark`                      | `src/ui/components/EyeMark.tsx`                                                         |
| `Mark` (2×2 wordmark)          | `src/ui/components/Mark.tsx` (same as `.cn-wordmark`)                                   |
| `THEMES.sand` vars             | `src/styles/tokens.css` (live file may add landing tokens such as `--cn-max-w-landing`) |
| `PLAY_URL` external host       | same-origin `/play/` via `src/config/routes.ts`                                         |
| `.btnP` red CTA                | `.cn-landing-btn--primary` (red is intentional here)                                    |
| `rgba(...)` shadows, `#28241f` | new tokens `--cn-shadow-float`, `--cn-shadow-phone`, `--cn-phone-frame`                 |
| `.wrap` 1060px                 | `--cn-max-w-landing` / `.cn-landing-wrap`                                               |

See `docs/planning/adr-001-landing-and-play-route.md` for the routing/PWA
decisions.
