# Asset provenance

Copyright (c) 2026 Ahmed Gamal (elgemmy)

Spy Mission is an independent word-association game project. It is not
affiliated with, endorsed by, or associated with the commercial Codenames
product or its publishers.

This inventory records what is known about first-party and third-party assets
in the repository. **Unresolved items are flagged rather than guessed.**

Companion files:

- [`LICENSE`](LICENSE) — MIT grant for first-party application code and
  design; not the word pack
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — third-party package and font licenses
- [`src/content/words/README.md`](src/content/words/README.md) — word-pack structure and duplicates

## Original project work

Unless a row below says otherwise, application source, Warm Sand design tokens,
component specs, board glyphs, and the 2×2 wordmark are original work by
Ahmed Gamal (elgemmy), 2026.

| Asset                                                                                                                                | Origin                                                                         | License / status | Original? |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------- | --------- |
| Application source under `src/`, `api/`, `supabase/` (excluding the word pack and leftover starter files below)                      | Authored in this repository                                                    | MIT              | Yes       |
| Warm Sand tokens and card/chrome specs (`docs/handoff/tokens.css`, `card.css`, `Card.html`, `component-specs.md`, `landing-spec.md`) | Project design handoff                                                         | MIT              | Yes       |
| Board faction glyphs (`src/ui/card/glyphs.tsx`)                                                                                      | Project design; geometric triangle / circle / rounded square / octagon + cross | MIT              | Yes       |
| 2×2 wordmark (`src/ui/components/Mark.tsx`, `public/favicon.svg`, `public/pwa-icon.svg`)                                             | Same Warm Sand mark as the PWA icons                                           | MIT              | Yes       |
| Raster PWA icons (`public/pwa-192.png`, `public/pwa-512.png`, `public/apple-touch-icon.png`)                                         | Rasterizations of the project wordmark                                         | MIT              | Yes       |
| Eye mark (`src/ui/components/EyeMark.tsx`)                                                                                           | Project landing/game chrome                                                    | MIT              | Yes       |

No proprietary commercial-game logos or box art are included.

## Word pack

`src/content/words/codenames.json` is the shipped bilingual concept pack
(23 categories, 597 concepts). The filename is a historical identifier.

Known facts:

- The file entered git in `316dfc37c8733aa688cc889213189e9cc36482be`
  (30 May 2026).
- Arabic labels match an author-owned working document created that same day.
- English labels are stored as pairs in the same file.

Unresolved: whether any English label was taken from another published list.

The repository MIT license covers the first-party application code and design
listed above. It does **not** license this pack. This file does not claim
third-party clearance for the pack.

Do not replace or regenerate the pack in documentation-only work. Duplicate
rendered English labels are listed in
[`src/content/words/README.md`](src/content/words/README.md).

## Hosted typefaces

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Rubik, Cairo, and
DM Mono are loaded from Google Fonts under SIL OFL 1.1. No font binaries are
stored in this repository.

## Leftover starter files

These files are present and **unreferenced** by current application source.
They come from the Vite + React starter template, not from the Spy Mission
design:

| Asset                  | Origin                                                                     | License / status                 | Original? |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------- | --------- |
| `src/assets/vite.svg`  | Vite starter                                                               | Vite project marks; unused       | No        |
| `src/assets/react.svg` | Vite React starter                                                         | React marks; unused              | No        |
| `public/icons.svg`     | Vite starter social/icon sprite (Bluesky, Discord, GitHub, X, and similar) | Upstream starter artwork; unused | No        |

**Unresolved:** whether these leftover files should be deleted in a later
cleanup. This documentation pass does not remove runtime or `src/` assets
outside `src/content/words/README.md`.

## What this repository does not contain

- No commercial box art or official logos
- No vendored font files
- No claimed affiliation with another publisher’s product
