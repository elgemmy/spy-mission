# Codenames Engine Contract (draft v1)

Output of the engine-contract session. This is what Codex implements against in
Phase 2. Types and specs only: no React, no network, no Supabase.

Scope rule for the implementer: the reducer is pure and deterministic. All
randomness lives in the `startGame` deal, seeded. No `Date`, no `Math.random`,
no I/O. Stored state must be JSON-serialisable (it lives in a Supabase `jsonb`
column): no `Infinity`, no `undefined` in fields, no class instances, no `Date`.

---

## 1. `types.ts`

```ts
// engine/codenames/types.ts

export type Team = "red" | "blue";
export type Role = "spymaster" | "operative";
export type Lang = "ar" | "en";

// Card allegiance. Kept distinct from Team so neutral/assassin are first-class,
// not a nullable team.
export type CardKind = "red" | "blue" | "neutral" | "assassin";

export type Phase = "lobby" | "clue" | "guess" | "ended";

export interface Concept {
  id: string; // stable id from the word list, e.g. "n0142"
  en: string;
  ar: string;
}

export interface Card {
  concept: Concept; // both labels travel; display picks state.lang
  kind: CardKind;   // SECRET. Stripped for operatives by viewFor.
  revealed: boolean;
}

export interface Player {
  name: string;
  team: Team;
  role: Role;
}

export interface Clue {
  word: string;
  count: number; // 0 = unlimited; 1..9 otherwise (see decisions)
}

export interface GameState {
  roomId: string;
  lang: Lang;                        // room-level; everyone sees one language
  phase: Phase;
  board: Card[];                     // exactly 25 once dealt; [] before deal
  startingTeam: Team | null;         // team dealt 9; null before deal
  turn: Team;                        // whose turn it is
  clue: Clue | null;                 // current clue; null outside a guess phase
  guessesMadeThisTurn: number;       // resets to 0 on giveClue and on turn flip
  players: Record<string, Player>;   // key = playerId
  winner: Team | null;               // set only when phase === "ended"
}

// guessesRemaining is DERIVED in viewFor, never stored (single source of truth).

export type Action =
  // lobby
  | { type: "joinRoom"; name: string }
  | { type: "assignSelf"; team: Team; role: Role }
  | { type: "setLang"; lang: Lang }
  | { type: "startGame"; concepts: Concept[]; seed: number }
  // play
  | { type: "giveClue"; word: string; count: number }
  | { type: "guess"; cardIndex: number }
  | { type: "endTurn" };
// The acting playerId is the reducer's 3rd argument, so joinRoom/assignSelf/
// guess/etc. are implicitly "by this player". No playerId in the payloads.

// ---- The derived per-client view -------------------------------------------

export interface ViewCard {
  concept: Concept;      // UI renders concept[view.lang]; both ship for the switch
  revealed: boolean;
  kind: CardKind | null; // revealed: always set. unrevealed: set ONLY for
                         // spymasters, else null.
}

export interface PlayerView {
  roomId: string;
  lang: Lang;
  phase: Phase;
  board: ViewCard[];
  turn: Team;
  clue: Clue | null;

  // public scoreboard, derived from board + kinds (both counts are public info)
  redRemaining: number;
  blueRemaining: number;

  // null outside guess phase; "unlimited" for a 0-clue; else count+1-made
  guessesRemaining: number | "unlimited" | null;

  winner: Team | null;

  me: { id: string; team: Team; role: Role } | null; // null if not joined
  players: Array<{ id: string; name: string; team: Team; role: Role }>;

  // engine owns the rules; UI just renders these. All false when phase==="ended".
  can: {
    joinRoom: boolean;
    assignSelf: boolean;
    setLang: boolean;
    startGame: boolean;
    giveClue: boolean;
    guess: boolean;
    endTurn: boolean;
  };
}
```

---

## 2. `contract.ts`

```ts
// engine/contract.ts

// The shared seam every future game implements. We TYPE it now and DEFER the
// registry / generic lobby / dynamic loading until a second game exists.
// Generics default to unknown so a future heterogeneous registry can hold
// modules without knowing their internals.
export interface GameModule<S = unknown, A = unknown, V = unknown, C = unknown> {
  id: string;
  initialState(config: C): S;
  reducer(state: S, action: A, playerId: string): S; // pure; throws IllegalMove
  viewFor(state: S, playerId: string): V;
}

export type IllegalMoveCode =
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "WRONG_ROLE"
  | "NOT_A_PLAYER"
  | "ALREADY_JOINED"
  | "CARD_ALREADY_REVEALED"
  | "CARD_OUT_OF_RANGE"
  | "INVALID_CLUE"
  | "MUST_GUESS_ONCE"
  | "LANG_LOCKED"
  | "ALREADY_STARTED"
  | "NOT_ENOUGH_PLAYERS"
  | "BAD_DEAL"; // startGame given != 25 concepts

export class IllegalMove extends Error {
  constructor(public code: IllegalMoveCode, message?: string) {
    super(message ?? code);
    this.name = "IllegalMove";
  }
}
```

```ts
// engine/codenames/index.ts  (signatures only; bodies are Codex's job)

import type { GameModule } from "../contract";
import type { GameState, Action, PlayerView, Lang } from "./types";

export interface CodenamesConfig {
  roomId: string;
  lang: Lang; // initial chrome/display language; mutable in lobby only
}

// Builds an empty lobby (board: [], no players). Deal happens in startGame.
export declare function initialState(config: CodenamesConfig): GameState;

// Pure. Validates, throws IllegalMove on illegal, returns the next state.
export declare function reducer(
  state: GameState,
  action: Action,
  playerId: string,
): GameState;

// Role-gated projection. Operatives never receive unrevealed kinds.
export declare function viewFor(state: GameState, playerId: string): PlayerView;

export declare const codenames: GameModule<
  GameState,
  Action,
  PlayerView,
  CodenamesConfig
>;
```

---

## 3. Reducer behavior spec

Conventions: `P` = acting playerId (3rd arg). `me` = `state.players[P]`. "Flip
turn" means: `turn` -> other team, `phase` -> `"clue"`, `clue` -> `null`,
`guessesMadeThisTurn` -> `0`. Any precondition failure throws `IllegalMove` with
the listed code and leaves state untouched.

### `joinRoom { name }`
- Preconditions: `phase === "lobby"` (else `WRONG_PHASE`); `P` not already in
  `players` (else `ALREADY_JOINED`).
- Transition: add `players[P] = { name, team: <smaller team, ties -> red>, role: "operative" }`.
- Auto-balance keeps lobby fair without extra taps; `assignSelf` overrides.

### `assignSelf { team, role }`
- Preconditions: `phase === "lobby"` (else `WRONG_PHASE`); `P` in `players`
  (else `NOT_A_PLAYER`).
- Transition: set `players[P].team` and `players[P].role`.

### `setLang { lang }`
- Preconditions: `phase === "lobby"` (else `LANG_LOCKED`).
- Transition: `state.lang = lang`. No re-deal. Re-render is the client's job
  (both labels already live on every card).

### `startGame { concepts, seed }`
- Preconditions: `phase === "lobby"` (else `ALREADY_STARTED`);
  `concepts.length === 25` (else `BAD_DEAL`); each team has >= 1 spymaster AND
  >= 1 operative (else `NOT_ENOUGH_PLAYERS`).
- Transition (deterministic from `seed`):
  - Choose `startingTeam` from `seed`.
  - Assign kinds: 9 to starting team, 8 to the other, 7 `neutral`, 1 `assassin`,
    then shuffle positions. Same `concepts` + same `seed` => identical board.
  - Build `board` (25 cards, `revealed: false`).
  - `turn = startingTeam`, `phase = "clue"`, `clue = null`,
    `guessesMadeThisTurn = 0`, `winner = null`.

### `giveClue { word, count }`
- Preconditions: `phase === "clue"` (else `WRONG_PHASE`); `me` exists (else
  `NOT_A_PLAYER`); `me.role === "spymaster"` (else `WRONG_ROLE"`);
  `me.team === turn` (else `NOT_YOUR_TURN`); clue valid (else `INVALID_CLUE`):
  `word.trim()` non-empty, no internal whitespace (single token), `count` an
  integer in `0..9`.
- Transition: `clue = { word: word.trim(), count }`, `phase = "guess"`,
  `guessesMadeThisTurn = 0`.
- Note: the engine does NOT check the clue word against board labels. That is a
  house rule (see decisions).

### `guess { cardIndex }`
- Preconditions: `phase === "guess"` (else `WRONG_PHASE`); `me` exists (else
  `NOT_A_PLAYER`); `me.role === "operative"` (else `WRONG_ROLE` -- the spymaster
  knows the key and cannot guess); `me.team === turn` (else `NOT_YOUR_TURN`);
  `cardIndex` in `0..24` (else `CARD_OUT_OF_RANGE`); target not already revealed
  (else `CARD_ALREADY_REVEALED`).
- Transition: set the card `revealed = true`; `guessesMadeThisTurn += 1`; then
  resolve by the revealed card's `kind` (table below). Win detection runs after
  every reveal.

Guess outcome table (acting team = `T`, opponent = `O`):

| Revealed kind | Immediate result | Win check | If no win |
| --- | --- | --- | --- |
| `T` (own agent) | correct | if all of `T`'s cards revealed -> `winner = T`, `phase = "ended"` | if `guessesRemaining === 0` -> flip turn; else stay in guess phase |
| `neutral` | turn ends | none | flip turn |
| `O` (opponent agent) | reveal helps `O`; turn ends | if all of `O`'s cards revealed -> `winner = O`, `phase = "ended"` | flip turn |
| `assassin` | acting team loses instantly | `winner = O`, `phase = "ended"` | n/a |

`guessesRemaining` used above is the derived value:
`clue.count === 0` -> effectively unlimited (never auto-ends on count; only
neutral / opponent / assassin / voluntary `endTurn` / own-set-complete stops it).
`clue.count >= 1` -> `clue.count + 1 - guessesMadeThisTurn`. The `+1` is the
bonus guess (N+1). Auto-end fires only for finite clues when this hits `0`.

### `endTurn`
- Preconditions: `phase === "guess"` (else `WRONG_PHASE`); `me` exists (else
  `NOT_A_PLAYER`); `me.role === "operative"` (else `WRONG_ROLE`);
  `me.team === turn` (else `NOT_YOUR_TURN`); `guessesMadeThisTurn >= 1` (else
  `MUST_GUESS_ONCE`).
- Transition: flip turn.

### Win detection (runs after every reveal)
1. If an `assassin` was just revealed -> the acting team loses, opponent wins.
2. Else if every card of some team is revealed -> that team wins (this can be
   the opponent, when the acting team guessed the opponent's last agent).
3. Else no winner; continue per the table.

When `phase === "ended"`, all `can.*` flags are `false` and every action throws
`WRONG_PHASE` (except none are valid). Replay = a fresh `initialState` +
`startGame`; no in-place reset for the MVP.

---

## 4. `viewFor` spec

`viewFor(state, P)` returns a `PlayerView`. `me = state.players[P]` or `null`
(a non-joined client is a spectator: treated as an operative for visibility).

Visibility is gated by ROLE, not by turn. Turn only affects the `can` flags.

Per card:
- Revealed card: `kind` is shown to everyone (it is face-up on the board).
- Unrevealed card: `kind` is shown only when `me?.role === "spymaster"`. Both
  spymasters see the full 25-card key (their own team, the opponent's, neutrals,
  and the assassin), exactly like the physical key card. Operatives and
  spectators get `kind: null`.

Public fields (identical for everyone): `roomId`, `lang`, `phase`, `turn`,
`clue`, `redRemaining`, `blueRemaining`, `guessesRemaining`, `winner`,
`players` (id, name, team, role for each).

`redRemaining` / `blueRemaining`: count of that team's cards with
`revealed === false`. Public in Codenames (the top bar shows both).

`guessesRemaining`: `null` unless `phase === "guess"`. In guess phase:
`"unlimited"` if `clue.count === 0`, else `clue.count + 1 - guessesMadeThisTurn`.

`me`: `{ id: P, team, role }` if `P` is in `players`, else `null`.

`can` flags (all `false` when `phase === "ended"`):
- `joinRoom`: `phase === "lobby"` and `P` not in `players`.
- `assignSelf`: `phase === "lobby"` and `P` in `players`.
- `setLang`: `phase === "lobby"`.
- `startGame`: `phase === "lobby"` and startGame preconditions met (both teams
  have a spymaster and an operative).
- `giveClue`: `phase === "clue"` and `me.role === "spymaster"` and `me.team === turn`.
- `guess`: `phase === "guess"` and `me.role === "operative"` and `me.team === turn`.
- `endTurn`: `guess` flag true and `guessesMadeThisTurn >= 1`.

On-turn vs off-turn: a spymaster off-turn still sees the full key (visibility is
role-based). The only off-turn difference is `can.*` flags are `false`, which
the UI renders as disabled / reduced-affordance.

---

## 5. Locked rule decisions

1. Board is 9 / 8 / 7 / 1 (starting team / other team / neutral / assassin).
   Starting team chosen by `seed`, gets the 9. Deal is deterministic from
   `concepts` + `seed`.
2. A team must make at least one guess before it can end its turn.
3. Voluntary `endTurn` is allowed in guess phase, by an operative on the active
   team, after at least one guess.
4. Clue number range is 0..9. `0` means unlimited (`"unlimited"` in the view);
   `N >= 1` grants `N + 1` guesses (the bonus).
5. Clue legality is structural only in the engine (single non-empty token, count
   in range). Semantic legality and "word on the board" are house rules, not
   engine-enforced. The hidden other-language label does NOT count as on the
   board.
6. Display language is set in the lobby and locked once the game starts.
   `setLang` is rejected outside lobby phase.
7. Both spymasters always see the full key; operatives never see unrevealed
   kinds. Visibility is role-gated; turn affects affordances only.
8. The spymaster cannot guess.
9. `startGame` requires each team to have at least one spymaster and at least
   one operative.
10. The reducer is pure and throws a typed `IllegalMove` on any illegal action.

---

## 6. Fold back into the project brief

These deviate from the brief's DRAFT `Engine interface` / resolve its `Open
decisions`, and should be updated there:

- `GameState` drops the stored `guessesRemaining`; stores `guessesMadeThisTurn`;
  adds `startingTeam`. `guessesRemaining` is derived in `viewFor`.
- The deal moves into the `startGame` action, which now carries
  `{ concepts, seed }`. `initialState` builds an empty lobby. (Closes the
  spymaster-peek-in-lobby gap and keeps content sampling out of the engine.)
- Action set adds lobby actions `joinRoom` and `assignSelf`.
- `PlayerView` gains a `can` affordance block.
- Open decision "language switch mid-game vs lobby" -> lobby only.
- Open decision "clue legality / other-language label" -> structural-only in
  engine; other-language label does not count; rest is house rule.
- Open decision "client-side vs server RPC" is untouched: this contract is
  location-agnostic (pure reducer), so the move stays a move, not a rewrite.
```
