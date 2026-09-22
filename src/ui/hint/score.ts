/** The score describes clue association only; card classifications are never used. */
export function validHintScore(score: number | undefined): number | undefined {
  return typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 1
    ? score
    : undefined;
}

export function hintColor(score: number): string {
  if (score === 0) return "var(--cn-hint-low)";
  if (score === 0.5) return "var(--cn-hint-mid)";
  if (score === 1) return "var(--cn-hint-high)";
  return score < 0.5
    ? `color-mix(in srgb, var(--cn-hint-low), var(--cn-hint-mid) ${score * 200}%)`
    : `color-mix(in srgb, var(--cn-hint-mid), var(--cn-hint-high) ${(score - 0.5) * 200}%)`;
}
