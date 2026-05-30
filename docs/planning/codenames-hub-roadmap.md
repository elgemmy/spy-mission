# Codenames Hub: MVP Roadmap

How to use: phases run in order. Each lists its owner, the work, and the exit criteria that let you move on. Two principles keep quick and clean from fighting: get the game fully playable locally before any network exists, and lock the engine contract and design tokens before the agent writes UI. See the architecture brief and design system for the why and the visual rules.

Owners: You (contract, reviews, decisions, Arabic curation). Codex (implementation against the contract and design files). Claude Code (scaffold, schema, config, env). Cursor (surgical edits). Claude chat (contract design, debugging logic, reviews).

## Phase 0: Scaffold
Owner: Claude Code, you steering.
Do: Vite + React + TS + Tailwind. Add `tokens.css` and the Tailwind theme extension from the design system. Create `AGENTS.md` pointing at the brief and design system with the hard rules restated. Set the folder structure. Create the Supabase project, do not wire it yet.
Structure:
```
src/
  engine/
    contract.ts          # GameModule seam
    codenames/
      types.ts
      setup.ts           # initialState, board deal (seedable)
      reducer.ts
      view.ts            # viewFor
      index.ts           # the Codenames GameModule
  content/words/
    codenames.json       # Concept[] { id, en, ar }
  room/
    client.ts            # supabase client
    useRoom.ts           # subscribe + dispatch (added in Phase 4)
  ui/
    card/ board/ clue/ lobby/ common/
  app/                   # providers, routing
  styles/tokens.css
```
Done when: the app boots to a blank themed screen on your phone over local network, fonts load, and RTL flips from a single `dir` attribute.

## Phase 1: Lock the engine contract
Owner: You, with Claude chat.
Do: run the first-session prompt. Produce `types.ts` and `contract.ts`, the action set, the reducer behavior spec, the viewFor spec, and a written list of locked rule decisions.
Done when: every rule decision is settled in writing and the types compile. No function bodies yet.

## Phase 2: Pure engine + tests
Owner: Codex implements, you review line by line.
Do: implement setup (seedable deal, the 9/8/7/1 split, starting team), reducer (all transitions with validation), viewFor (role-based). Unit-test the reducer against the Phase 1 transition spec.
Done when: tests cover give-clue, correct guess, neutral, opponent agent, assassin, exhausted guesses, voluntary end, and win detection, and all pass. Zero React, zero network in this folder.

## Phase 3: Local hot-seat UI
Owner: Codex builds to the design system, you wire an in-memory provider.
Do: build Card first as the reference component, then Board, ClueBar, TopBar, Lobby, all against the tokens. Wire to an in-memory state provider that runs the engine in the browser. Switch role and team manually to exercise every view.
Done when: a full game is playable in one browser with no network, spymaster and operative views correct, on a 390px viewport and centered on desktop.

## Phase 4: Persistence + realtime
Owner: Claude Code for schema, Codex for the provider swap.
Do: create the `rooms` table (id, code, game_id, state jsonb, lang, updated_at). Implement `useRoom`: subscribe to the row via Realtime, dispatch actions by applying the reducer and writing the row back (client-side last-write-wins for now). Swap the in-memory provider for the Supabase one.
Done when: two phones join the same room by code and play a full game in sync, and the room survives a refresh and an app switch.

## Phase 5: Arabic content + RTL pass
Owner: You curate, Codex wires.
Do: build the word list (source English, translate, curate Arabic for richness and family-appropriateness), load as `Concept[]`. Verify RTL on a real phone: logical properties throughout, bidi correct, Arabic legible at card size.
Done when: a full Arabic game plays cleanly on a phone and the English room works from the same build.

## Phase 6: Polish and finish line
Owner: Codex, you reviewing.
Do: reveal animation, win and assassin end states, room code share, reduced-motion fallback, and a reconnect test you run by force-quitting mid-game.
Done when: the MVP definition below holds.

## MVP definition of done
Two teams create and join a room by code on their own phones, play a full Arabic game with correct spymaster and operative views, the assassin ends the game and a cleared team wins, and the room never disappears on refresh or app switch. English works from the same build. The UI uses only design tokens and reads well one-handed.

## Working rules
- One branch and PR per phase. Keep the Phase 2 engine PR small enough to actually read.
- Tests live on the reducer only for the MVP. Skip heavy UI tests.
- The agent never makes design or rule decisions. Those are locked in the brief, the design system, and the Phase 1 contract.
