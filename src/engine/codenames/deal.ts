import type { Card, CardKind, Concept, Team } from "./types";
import { shuffleWithSeed } from "./seeded";

export function buildBoard(concepts: Concept[], seed: number): {
  board: Card[];
  startingTeam: Team;
} {
  const startingTeam: Team = seed % 2 === 0 ? "red" : "blue";
  const otherTeam: Team = startingTeam === "red" ? "blue" : "red";

  const kinds: CardKind[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill("neutral" as CardKind),
    "assassin",
  ];

  const shuffledKinds = shuffleWithSeed(kinds, seed);
  const shuffledConcepts = shuffleWithSeed(concepts, seed + 1);

  const board: Card[] = shuffledConcepts.map((concept, index) => ({
    concept,
    kind: shuffledKinds[index]!,
    revealed: false,
  }));

  return { board, startingTeam };
}
