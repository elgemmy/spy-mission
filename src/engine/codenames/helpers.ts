import type { Card, CardKind, GameState, Team } from "./types";

export function otherTeam(team: Team): Team {
  return team === "red" ? "blue" : "red";
}

export function flipTurn(
  state: GameState,
): Pick<GameState, "turn" | "phase" | "clue" | "guessesMadeThisTurn"> {
  return {
    turn: otherTeam(state.turn),
    phase: "clue",
    clue: null,
    guessesMadeThisTurn: 0,
  };
}

export function countRemaining(board: Card[], kind: CardKind): number {
  return board.filter((card) => card.kind === kind && !card.revealed).length;
}

export function allTeamCardsRevealed(board: Card[], team: Team): boolean {
  return board
    .filter((card) => card.kind === team)
    .every((card) => card.revealed);
}

export function teamCounts(players: GameState["players"]): {
  red: number;
  blue: number;
} {
  let red = 0;
  let blue = 0;
  for (const player of Object.values(players)) {
    if (player.team === "red") red += 1;
    else blue += 1;
  }
  return { red, blue };
}

export function smallerTeamForJoin(players: GameState["players"]): Team {
  const { red, blue } = teamCounts(players);
  if (blue < red) return "blue";
  return "red";
}

export function hasRequiredRoster(players: GameState["players"]): boolean {
  let redSpymaster = false;
  let redOperative = false;
  let blueSpymaster = false;
  let blueOperative = false;

  for (const player of Object.values(players)) {
    if (player.team === "red" && player.role === "spymaster")
      redSpymaster = true;
    if (player.team === "red" && player.role === "operative")
      redOperative = true;
    if (player.team === "blue" && player.role === "spymaster")
      blueSpymaster = true;
    if (player.team === "blue" && player.role === "operative")
      blueOperative = true;
  }

  return redSpymaster && redOperative && blueSpymaster && blueOperative;
}

export function isValidClue(word: string, count: number): boolean {
  const trimmed = word.trim();
  if (trimmed.length === 0) return false;
  if (!Number.isInteger(count)) return false;
  if (count < 0 || count > 9) return false;
  return true;
}

export function derivedGuessesRemaining(
  phase: GameState["phase"],
  clue: GameState["clue"],
  guessesMadeThisTurn: number,
): number | "unlimited" | null {
  if (phase !== "guess" || clue === null) return null;
  if (clue.count === 0) return "unlimited";
  return clue.count + 1 - guessesMadeThisTurn;
}

export function finiteGuessesExhausted(
  clue: GameState["clue"],
  guessesMadeThisTurn: number,
): boolean {
  if (clue === null || clue.count === 0) return false;
  return clue.count + 1 - guessesMadeThisTurn <= 0;
}
