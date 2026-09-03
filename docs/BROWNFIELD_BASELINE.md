# Brownfield baseline

Spy Mission is a **brownfield** project: an existing bilingual multiplayer
word-association game that is being extended. It is not a greenfield
competition submission.

## Product that already existed

Before the WebMCP competition work, this repository already shipped:

- A pure, deterministic game engine (`src/engine`) with contract tests
- A bilingual English/Arabic concept pack (English-list lineage unresolved)
- Mobile-first play: create/join room, roles, clues, guesses, replay
- Shared multiplayer over Supabase, later hardened so browsers do not write
  raw room rows
- Arabic-first family play as the original product reason

## Comparison baseline

Use this commit when comparing “what existed” to later competition work:

`7a480445e608071a02e712f823176d3f93b38177`

That merge (23 August 2026) locked down anonymous access to room data and is
the agreed pre-competition baseline.

An older full-flow commit exists for historical context only:

`1d4722d63852c9211635807fd50fd5beee892ae1` (30 May 2026)

Do not treat the May commit as the competition baseline. The August commit is
the comparison point.

## What landed after the baseline

After `7a48044`, the tree gained work that is **already on `main`** and should
be judged as existing product hardening and polish, not as a new game:

- Server-authoritative room API (`/api/rooms`) and role-filtered snapshots
- Landing page at `/` and game at `/play/`, with the PWA scoped to the game
- Vercel Function load/compile fixes
- Room lifecycle, membership, ban/delete, and invite rules
  (see [`room-lifecycle-contract.md`](room-lifecycle-contract.md))

## What is not shipped yet

Partner Mission / WebMCP exhibition mode is **competition work in progress**.
It is not in this tree. Do not describe it as a shipped feature.

A later branch may add that mode on top of the existing multiplayer game. The
normal multiplayer product remains part of Spy Mission either way.

## How to read this repository

Internal paths and types still use historical identifiers such as `codenames`
and `awesome-codenames`. Those are implementation names. The public product
name is **Spy Mission**.
