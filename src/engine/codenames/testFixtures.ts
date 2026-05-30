import type { Concept, GameState } from "./types";
import { initialState } from "./initialState";
import { reducer } from "./reducer";

export function makeConcepts(count = 25): Concept[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `n${String(index).padStart(4, "0")}`,
    en: `word-${index}`,
    ar: `كلمة-${index}`,
  }));
}

export function lobbyWithRoster(roomId = "test-room"): GameState {
  let state = initialState({ roomId, lang: "ar" });
  state = reducer(state, { type: "joinRoom", name: "Red SM" }, "p-red-sm");
  state = reducer(
    state,
    { type: "assignSelf", team: "red", role: "spymaster" },
    "p-red-sm",
  );
  state = reducer(state, { type: "joinRoom", name: "Red OP" }, "p-red-op");
  state = reducer(
    state,
    { type: "assignSelf", team: "red", role: "operative" },
    "p-red-op",
  );
  state = reducer(state, { type: "joinRoom", name: "Blue SM" }, "p-blue-sm");
  state = reducer(
    state,
    { type: "assignSelf", team: "blue", role: "spymaster" },
    "p-blue-sm",
  );
  state = reducer(state, { type: "joinRoom", name: "Blue OP" }, "p-blue-op");
  state = reducer(
    state,
    { type: "assignSelf", team: "blue", role: "operative" },
    "p-blue-op",
  );
  return state;
}

export function startTestGame(seed = 42): GameState {
  const lobby = lobbyWithRoster();
  return reducer(
    lobby,
    { type: "startGame", concepts: makeConcepts(), seed },
    "p-red-sm",
  );
}
