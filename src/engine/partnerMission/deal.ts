import { IllegalMove } from "../contract.js";
import { shuffleWithSeed } from "../codenames/seeded.js";
import type { Concept } from "../codenames/types.js";
import {
  PARTNER_BOARD_SIZE,
  PARTNER_DECOY_COUNT,
  PARTNER_TARGET_COUNT,
  PARTNER_TRAP_COUNT,
  type PartnerCardKind,
  type PartnerMissionCard,
} from "./types.js";

export function buildPartnerMissionBoard(
  concepts: Concept[],
  seed: number,
  kinds?: PartnerCardKind[],
): PartnerMissionCard[] {
  if (
    concepts.length !== PARTNER_BOARD_SIZE ||
    new Set(concepts.map(({ id }) => id)).size !== PARTNER_BOARD_SIZE
  ) {
    throw new IllegalMove("BAD_DEAL");
  }

  const canonicalKinds: PartnerCardKind[] = [
    ...Array<PartnerCardKind>(PARTNER_TARGET_COUNT).fill("target"),
    ...Array<PartnerCardKind>(PARTNER_DECOY_COUNT).fill("decoy"),
    "trap",
  ];
  const boardKinds = kinds
    ? validateProvidedKinds(kinds)
    : shuffleWithSeed(canonicalKinds, seed);
  const shuffledConcepts = shuffleWithSeed(concepts, seed + 1);

  return shuffledConcepts.map((concept, index) => ({
    id: concept.id,
    concept,
    kind: boardKinds[index]!,
    revealed: false,
  }));
}

function validateProvidedKinds(kinds: PartnerCardKind[]): PartnerCardKind[] {
  if (kinds.length !== PARTNER_BOARD_SIZE) {
    throw new IllegalMove("BAD_DEAL");
  }

  const counts: Record<PartnerCardKind, number> = {
    target: 0,
    decoy: 0,
    trap: 0,
  };
  for (const kind of kinds) {
    if (kind !== "target" && kind !== "decoy" && kind !== "trap") {
      throw new IllegalMove("BAD_DEAL");
    }
    counts[kind] += 1;
  }
  if (
    counts.target !== PARTNER_TARGET_COUNT ||
    counts.decoy !== PARTNER_DECOY_COUNT ||
    counts.trap !== PARTNER_TRAP_COUNT
  ) {
    throw new IllegalMove("BAD_DEAL");
  }

  return [...kinds];
}
