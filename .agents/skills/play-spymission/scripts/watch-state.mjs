function signalKey(mission) {
  return mission?.signal
    ? `${mission.version ?? ""}:${mission.signal.word}:${mission.signal.count}`
    : "";
}

function revealedEntries(mission) {
  return (mission?.cards ?? [])
    .filter((card) => card.revealed)
    .map((card) => ({ id: card.id, word: card.word, result: card.result }));
}

function revealedKey(entries) {
  return entries
    .map((entry) => `${entry.id}:${entry.result}`)
    .sort()
    .join(",");
}

function freshReveals(previousKey, entries) {
  const seen = new Set(previousKey.split(",").filter(Boolean));
  return entries.filter((entry) => !seen.has(`${entry.id}:${entry.result}`));
}

export function createMissionChangeDetector() {
  let lastSignalWake = "";
  let lastRevealKey = "";
  let seeded = false;

  return {
    reset() {
      lastSignalWake = "";
      lastRevealKey = "";
      seeded = false;
    },

    observe(mission) {
      const entries = revealedEntries(mission);
      const currentRevealKey = revealedKey(entries);
      const newReveals = seeded ? freshReveals(lastRevealKey, entries) : [];
      seeded = true;
      lastRevealKey = currentRevealKey;

      const currentSignalKey = signalKey(mission);
      const newSignal =
        mission.phase === "field_agent_turn" &&
        currentSignalKey !== lastSignalWake;
      if (newSignal) lastSignalWake = currentSignalKey;

      return {
        ended: mission.phase === "won" || mission.phase === "lost",
        newReveals,
        newSignal,
      };
    },
  };
}
