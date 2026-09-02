import { cn } from "../../lib/cn";
import type { CardRole } from "../card/types";

const CELLS: readonly CardRole[] = ["red", "blue", "neutral", "assassin"];

export interface MarkProps {
  /** Edge length in px. Gap and cell radius are derived from it. */
  size?: number;
  className?: string;
}

/**
 * The 2×2 wordmark tile: one cell per faction colour.
 * Decorative — the product name always sits next to it.
 */
export function Mark({ size = 34, className }: MarkProps) {
  return (
    <span
      className={cn("cn-mark", className)}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: size * 0.11,
        flex: "0 0 auto",
      }}
    >
      {CELLS.map((role) => (
        <span
          key={role}
          style={{
            background: `var(--cn-${role})`,
            borderRadius: size * 0.16,
          }}
        />
      ))}
    </span>
  );
}
