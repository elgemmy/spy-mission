# Third-party notices

Copyright (c) 2026 Ahmed Gamal (elgemmy)

Spy Mission is an independent word-association game project. It is not
affiliated with, endorsed by, or associated with the commercial Codenames
product or its publishers.

This file lists third-party software and hosted typefaces used by the
repository. First-party assets and unresolved provenance are recorded in
[`ASSET_PROVENANCE.md`](ASSET_PROVENANCE.md).

## Direct runtime dependencies

Licenses taken from each package’s published `package.json` at the version
pinned in this repository:

| Package | Version | License |
| --- | --- | --- |
| `@supabase/supabase-js` | 2.106.2 | MIT |
| `clsx` | 2.1.1 | MIT |
| `react` | 19.2.6 | MIT |
| `react-dom` | 19.2.6 | MIT |
| `tailwind-merge` | 3.6.0 | MIT |
| `zod` | 4.4.3 | MIT |

Transitive dependency licenses are recorded in `package-lock.json` and in each
package under `node_modules/`.

## Hosted typefaces

The app loads these families from Google Fonts at runtime. They are **not**
vendored in this repository. Each is published under the SIL Open Font License
1.1:

| Family | Typical use in this project | License |
| --- | --- | --- |
| [Rubik](https://fonts.google.com/specimen/Rubik) | UI chrome and Latin board words | SIL OFL 1.1 |
| [Cairo](https://fonts.google.com/specimen/Cairo) | Arabic board words and Arabic UI | SIL OFL 1.1 |
| [DM Mono](https://fonts.google.com/specimen/DM+Mono) | Room codes, counts, clue numbers | SIL OFL 1.1 |

## Development tooling

Build, test, and lint tooling (`vite`, `vitest`, `typescript`, `eslint`,
`tailwindcss`, `supabase` CLI, and related packages) are development-only.
Their licenses are likewise recorded in `package-lock.json`.

## Trademark

Product and company names mentioned for identification (React, Vite, Supabase,
Vercel, Google Fonts, and others) remain the marks of their owners.
