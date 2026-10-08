import { useState } from "react";
import type { HintView } from "../../room/hints";

/** New turn results show automatically; hiding never discards or requests scores. */
export function useHintHeatmap(hint: HintView | undefined) {
  const [hiddenTurnId, setHiddenTurnId] = useState<string | null>(null);
  const hasScores = Boolean(hint?.turnId && hint.scores);
  const visible = hasScores && hiddenTurnId !== hint?.turnId;

  return {
    hasScores,
    visible,
    scores: visible ? hint?.scores : null,
    toggle: () => {
      if (hasScores && hint?.turnId) {
        setHiddenTurnId(visible ? hint.turnId : null);
      }
    },
  };
}
