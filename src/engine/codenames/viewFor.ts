import {
  countRemaining,
  derivedGuessesRemaining,
  hasRequiredRoster,
} from "./helpers.js";
import type { GameState, PlayerView, ViewCard } from "./types.js";

function mapBoard(state: GameState, playerId: string): ViewCard[] {
  const me = state.players[playerId];
  const showUnrevealedKinds =
    me?.role === "spymaster" || state.phase === "ended";

  return state.board.map((card) => ({
    concept: card.concept,
    revealed: card.revealed,
    kind: card.revealed || showUnrevealedKinds ? card.kind : null,
  }));
}

function buildCan(state: GameState, playerId: string): PlayerView["can"] {
  const ended = state.phase === "ended";
  const me = state.players[playerId] ?? null;
  const inLobby = state.phase === "lobby";
  const joined = Boolean(me);

  const guessCan =
    state.phase === "guess" &&
    me !== null &&
    me.role === "operative" &&
    me.team === state.turn;

  return {
    joinRoom: !ended && inLobby && !joined,
    assignSelf: !ended && inLobby && joined,
    setLang: !ended && inLobby,
    startGame: !ended && inLobby && hasRequiredRoster(state.players),
    giveClue:
      !ended &&
      state.phase === "clue" &&
      me !== null &&
      me.role === "spymaster" &&
      me.team === state.turn,
    guess: !ended && guessCan,
    endTurn: !ended && guessCan && state.guessesMadeThisTurn >= 1,
  };
}

export function viewFor(state: GameState, playerId: string): PlayerView {
  const meRecord = state.players[playerId] ?? null;

  return {
    roomId: state.roomId,
    lang: state.lang,
    phase: state.phase,
    board: mapBoard(state, playerId),
    turn: state.turn,
    clue: state.clue,
    redRemaining: countRemaining(state.board, "red"),
    blueRemaining: countRemaining(state.board, "blue"),
    guessesRemaining: derivedGuessesRemaining(
      state.phase,
      state.clue,
      state.guessesMadeThisTurn,
    ),
    winner: state.winner,
    me: meRecord
      ? { id: playerId, team: meRecord.team, role: meRecord.role }
      : null,
    players: Object.entries(state.players).map(([id, player]) => ({
      id,
      name: player.name,
      team: player.team,
      role: player.role,
    })),
    can: buildCan(state, playerId),
  };
}
