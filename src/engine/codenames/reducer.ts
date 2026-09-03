import { IllegalMove } from "../contract.js";
import { buildBoard } from "./deal.js";
import {
  allTeamCardsRevealed,
  flipTurn,
  finiteGuessesExhausted,
  hasRequiredRoster,
  isValidClue,
  otherTeam,
  smallerTeamForJoin,
} from "./helpers.js";
import type { Action, GameState, Team } from "./types.js";

function assertPhase(state: GameState, phase: GameState["phase"]): void {
  if (state.phase !== phase) {
    throw new IllegalMove("WRONG_PHASE");
  }
}

function getPlayer(state: GameState, playerId: string) {
  const me = state.players[playerId];
  if (!me) {
    throw new IllegalMove("NOT_A_PLAYER");
  }
  return me;
}

function endGame(state: GameState, winner: Team): GameState {
  return {
    ...state,
    phase: "ended",
    winner,
    clue: null,
    guessesMadeThisTurn: 0,
  };
}

function checkWinAfterReveal(
  state: GameState,
  actingTeam: Team,
  revealedKind: GameState["board"][number]["kind"],
): GameState {
  if (revealedKind === "assassin") {
    return endGame(state, otherTeam(actingTeam));
  }

  if (allTeamCardsRevealed(state.board, "red")) {
    return endGame(state, "red");
  }

  if (allTeamCardsRevealed(state.board, "blue")) {
    return endGame(state, "blue");
  }

  return state;
}

export function reducer(
  state: GameState,
  action: Action,
  playerId: string,
): GameState {
  if (state.phase === "ended") {
    throw new IllegalMove("WRONG_PHASE");
  }

  switch (action.type) {
    case "joinRoom": {
      assertPhase(state, "lobby");
      if (state.players[playerId]) {
        throw new IllegalMove("ALREADY_JOINED");
      }
      const team = smallerTeamForJoin(state.players);
      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: { name: action.name, team, role: "operative" },
        },
      };
    }

    case "assignSelf": {
      assertPhase(state, "lobby");
      const me = getPlayer(state, playerId);
      if (me.team === action.team && me.role === action.role) {
        return state;
      }
      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: { ...me, team: action.team, role: action.role },
        },
      };
    }

    case "setLang": {
      if (state.phase !== "lobby") {
        throw new IllegalMove("LANG_LOCKED");
      }
      if (state.lang === action.lang) {
        return state;
      }
      return { ...state, lang: action.lang };
    }

    case "startGame": {
      if (state.phase !== "lobby") {
        throw new IllegalMove("ALREADY_STARTED");
      }
      if (action.concepts.length !== 25) {
        throw new IllegalMove("BAD_DEAL");
      }
      if (!hasRequiredRoster(state.players)) {
        throw new IllegalMove("NOT_ENOUGH_PLAYERS");
      }

      const { board, startingTeam } = buildBoard(action.concepts, action.seed);

      return {
        ...state,
        board,
        startingTeam,
        turn: startingTeam,
        phase: "clue",
        clue: null,
        guessesMadeThisTurn: 0,
        winner: null,
      };
    }

    case "giveClue": {
      assertPhase(state, "clue");
      const me = getPlayer(state, playerId);
      if (me.role !== "spymaster") {
        throw new IllegalMove("WRONG_ROLE");
      }
      if (me.team !== state.turn) {
        throw new IllegalMove("NOT_YOUR_TURN");
      }
      if (!isValidClue(action.word, action.count)) {
        throw new IllegalMove("INVALID_CLUE");
      }

      return {
        ...state,
        clue: { word: action.word.trim(), count: action.count },
        phase: "guess",
        guessesMadeThisTurn: 0,
      };
    }

    case "guess": {
      assertPhase(state, "guess");
      const me = getPlayer(state, playerId);
      if (me.role !== "operative") {
        throw new IllegalMove("WRONG_ROLE");
      }
      if (me.team !== state.turn) {
        throw new IllegalMove("NOT_YOUR_TURN");
      }
      if (action.cardIndex < 0 || action.cardIndex > 24) {
        throw new IllegalMove("CARD_OUT_OF_RANGE");
      }

      const target = state.board[action.cardIndex];
      if (!target) {
        throw new IllegalMove("CARD_OUT_OF_RANGE");
      }
      if (target.revealed) {
        throw new IllegalMove("CARD_ALREADY_REVEALED");
      }

      const board = state.board.map((card, index) =>
        index === action.cardIndex ? { ...card, revealed: true } : card,
      );
      const revealedKind = target.kind;
      const actingTeam = me.team;
      const opponent = otherTeam(actingTeam);

      let next: GameState = {
        ...state,
        board,
        guessesMadeThisTurn: state.guessesMadeThisTurn + 1,
      };

      next = checkWinAfterReveal(next, actingTeam, revealedKind);
      if (next.phase === "ended") {
        return next;
      }

      if (revealedKind === "neutral" || revealedKind === opponent) {
        return { ...next, ...flipTurn(next) };
      }

      if (revealedKind === actingTeam) {
        if (finiteGuessesExhausted(next.clue, next.guessesMadeThisTurn)) {
          return { ...next, ...flipTurn(next) };
        }
        return next;
      }

      return next;
    }

    case "endTurn": {
      assertPhase(state, "guess");
      const me = getPlayer(state, playerId);
      if (me.role !== "operative") {
        throw new IllegalMove("WRONG_ROLE");
      }
      if (me.team !== state.turn) {
        throw new IllegalMove("NOT_YOUR_TURN");
      }
      if (state.guessesMadeThisTurn < 1) {
        throw new IllegalMove("MUST_GUESS_ONCE");
      }

      return { ...state, ...flipTurn(state) };
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
