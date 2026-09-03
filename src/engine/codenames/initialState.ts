import type { CodenamesConfig, GameState } from "./types.js";

export function initialState(config: CodenamesConfig): GameState {
  return {
    roomId: config.roomId,
    lang: config.lang,
    phase: "lobby",
    board: [],
    startingTeam: null,
    turn: "red",
    clue: null,
    guessesMadeThisTurn: 0,
    players: {},
    winner: null,
  };
}
