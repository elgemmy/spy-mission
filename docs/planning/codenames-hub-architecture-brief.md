# SUPERSEDED — historical architecture brief

**Status:** superseded. Keep this file for product-intent history (Arabic-first,
mobile-first, bilingual `Concept { en, ar }`). **Do not implement from it.**

Current sources of truth:

- Multiplayer path: browser → authenticated `/api/rooms` → server domain +
  engine → service-role Supabase RPC/storage → role-filtered `RoomSnapshot` →
  state-free Realtime invalidation + polling fallback
- Rooms: [`docs/room-lifecycle-contract.md`](../room-lifecycle-contract.md)
- Rules: [`codenames-engine-contract.md`](codenames-engine-contract.md)
- Routing: [`adr-001-landing-and-play-route.md`](adr-001-landing-and-play-route.md)
- Public product name: Spy Mission (this brief’s “Codenames Hub” title is
  historical)

Obsolete claims in the body below — **not current**:

- Client-side last-write-wins and browsers writing room rows
- Realtime pushing full room rows
- Static hosting on Netlify as the current deploy
- “No real auth” / display-name identity
- Chrome shipping in one language only (the landing is bilingual; game chrome
  is still Arabic-first)
- Open decisions that the engine contract and room lifecycle contract already
  closed

---

# Codenames Game Hub: Architecture Brief

Historical standing reference from the first planning pass. The notice above
replaces it as a source of truth.

## What this is

An Arabic-first Codenames web game for family events, English as secondary. Built so it can later become a hub that hosts other games we make together. Arabic is the reason the project exists: existing Arabic versions are glitchy, desktop-first, lose the room mid-game, and the younger players don't read English.

## Priorities (in order)

1. Mobile-first experience on each player's own phone. This is the dominant priority.
2. Arabic correctness and quality.
3. Persistent rooms that survive reconnects and never vanish mid-game.
4. A good web view on desktop (the same layout, centered), not a separate desktop design.
5. Clean, debuggable architecture a single human can hold in their head and extend.

## Play model (confirmed)

- Each player plays on their own mobile device. There is no shared screen.
- Each device shows the board through a role-appropriate view: spymasters see the key, operatives do not.
- Mobile-first is therefore non-negotiable; desktop is the same column centered with a max width.

## Language model (confirmed)

- A concept is stored in both languages: `{ en, ar }`. Both labels always travel with the card.
- Display is single-language, selected per room. Everyone in a room sees the same language.
- Switching language is a room-level action and re-renders the other label with no re-deal.
- Menus and chrome are NOT translated for the MVP. They ship in one language and one layout direction.
- Default chrome: Arabic and RTL (identity and audience). Flippable to English and LTR cheaply because styling uses CSS logical properties. Decide consciously, do not drift.

## Core reframing

The Codenames rules are trivial: a state machine over 25 cards. The hard and valuable parts are state synchronization and persistence. The known pain points map directly onto these: rooms vanishing means state lived in memory instead of a durable store; glitchy UI means client state drifted from truth without reconciliation. So the architecture is organized around state, not rules.

## Architecture principles (load-bearing)

- Pure engine. The rules live in one framework-free module. No React, no network, no Supabase SDK. Three functions:
  - `initialState(config) -> State`
  - `reducer(state, action, playerId) -> State` (validates, rejects illegal moves)
  - `viewFor(state, playerId) -> PlayerView` (strips the spymaster key for operatives)
- Actions in, views out. The UI renders a derived `PlayerView` and dispatches actions. It never mutates shared state and never contains rules. This is what keeps the vibe-coded UI safe to be messy: the brain stays small, pure, and testable.
- Language is room-level state, not a per-player view concern. `viewFor` varies output by role, not by language.
- Server-authoritative state. One source of truth, clients send actions rather than state mutations.

## Engine interface (DRAFT, to finalize in the first working session)

A starting sketch, not a locked contract. The first real session is to pin down `State`, the action set, and `viewFor`.

```ts
// DRAFT - finalize in the first working session

type Team = "red" | "blue";
type CardKind = "red" | "blue" | "neutral" | "assassin";
type Lang = "ar" | "en";

interface Concept {
  id: string;
  en: string;
  ar: string;
}

interface Card {
  concept: Concept;    // both labels stored; display picks state.lang
  kind: CardKind;      // secret: only spymasters and the server resolve this
  revealed: boolean;
}

interface GameState {
  roomId: string;
  lang: Lang;          // room-level: everyone sees the same language
  board: Card[];       // 25 cards, fixed at deal
  turn: Team;
  phase: "lobby" | "clue" | "guess" | "ended";
  clue?: { word: string; count: number };
  guessesRemaining: number;
  winner?: Team;
  players: Record<string, { name: string; team: Team; role: "spymaster" | "operative" }>;
}

type Action =
  | { type: "startGame"; seed?: number }
  | { type: "setLang"; lang: Lang }
  | { type: "giveClue"; word: string; count: number }
  | { type: "guess"; cardIndex: number }
  | { type: "endTurn" };

// The shared seam every future game implements (defines the hub without building it):
interface GameModule<S, A> {
  id: string;
  initialState(config: unknown): S;
  reducer(state: S, action: A, playerId: string): S;
  viewFor(state: S, playerId: string): unknown; // hides secrets per player and role
}
```

## Tech stack and why

- React + Vite + TypeScript (client). TS end to end so the engine is one shared module across client and server: same validation both sides, optimistic UI consistent with the server by construction. Chosen over a Go backend for this small game because splitting the engine across two languages costs more than it gives.
- Supabase for state, persistence, and identity. Room = row, game state = `jsonb` column, Realtime pushes row changes to all clients. The room is a database record, so it cannot vanish; reconnect = re-read the row.
- Tailwind CSS for styling, driven by a token layer (see the design system doc).
- Deploy: static frontend on Netlify (or Vercel).
- Auth: room code + display name, or Supabase anonymous. No real auth for a family game.

## Reducer location (decision)

Start client-side with last-write-wins. Codenames is turn-based with one actor at a time, so races are rare. Write the engine so relocating it server-side (Supabase RPC or Edge Function as single writer) is a move, not a rewrite. Go server-side when secrecy or stricter consistency is wanted, or when a future game needs it.

## Persistence and room model

- `rooms` table: `id`, `code` (short join code), `game_id`, `state` (jsonb), `lang`, `updated_at`.
- Clients subscribe to their room row via Realtime and dispatch actions; the row is the durable truth.
- Reconnect is re-reading the row, so the room never dies on a refresh or app switch.

## Build roadmap

1. Scaffold: Vite + React + TS + Tailwind, token layer, repo structure, Supabase project created.
2. Lock the engine interface by hand (types and the `GameModule` seam). Human-owned.
3. Build and test the pure reducer, setup/deal, and viewFor. Vibe-code, human-reviewed, unit-tested with zero infra.
4. Local hot-seat play: full game playable in the browser with an in-memory state provider, no network. Proves rules and UI before infra.
5. Persistence and realtime: swap the local provider for the Supabase-backed one. Minimal UI change because the UI only dispatches actions.
6. Arabic content and RTL pass: word-list pipeline, load concepts, verify on a real phone.
7. Polish: reveal animation, win and assassin states, room code share, reconnect test.

## Hub strategy: design the seam, defer the framework

The `GameModule` interface is the seam. Do not build hub infrastructure (game registry, generic lobby, dynamic loading) until a second game exists. The second game reveals what actually varies; abstracting earlier creates the spaghetti we're avoiding. When game two arrives, extract the (already game-agnostic) room/lobby/realtime layer and the hub falls out.

## Word list workflow

- Source a curated English noun list (English Codenames word lists are abundant).
- Translate to Arabic, then curate the Arabic for associative richness and family-appropriateness. Raw translation flattens the polysemy that English lists rely on, so the Arabic pass is real editorial work, not a lookup.
- Store as `Concept { id, en, ar }`. Board generation samples 25 concepts at deal time.

## Multiplayer architecture context

State models sit on a spectrum: lockstep (replay identical inputs) -> server-authoritative (one truth, clients send actions) -> CRDT (merge concurrent edits). Codenames is server-authoritative and turn-based, not a CRDT problem: it has authoritative rules, turn order, and secret state that CRDTs would corrupt. Implication for the hub: a future game might be real-time and sit elsewhere on the spectrum, so the room layer should carry opaque state and actions without knowing the rules. The `GameModule` seam already enforces this.

## Open decisions

- Final engine `State` and action shape (first session).
- Start client-side last-write-wins, or go straight to server-side RPC.
- Clue legality house rule: does a word's other-language label count as on the board.
- Whether language switching mid-game is allowed or only at lobby.
