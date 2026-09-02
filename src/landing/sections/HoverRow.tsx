import { useState } from "react";
import { WordCard } from "../../ui/card/Card";
import { ROT, ROW } from "../data/demoBoard";
import type { Lang } from "../strings";

export interface HoverRowProps {
  lang: Lang;
}

/**
 * Scattered word tiles that flip on hover — and on tap/keyboard, so the
 * effect is reachable without a pointer.
 */
export function HoverRow({ lang }: HoverRowProps) {
  const [flipped, setFlipped] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );

  const set = (index: number, on: boolean) => {
    setFlipped((current) => {
      const next = new Set(current);
      if (on) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  return (
    <div className="cn-lp-hoverrow">
      {ROW.map((word, i) => (
        <div
          key={i}
          className="cn-lp-hoverrow__tile"
          style={{ transform: `rotate(${ROT[i]}deg)` }}
          onMouseEnter={() => set(i, true)}
          onMouseLeave={() => set(i, false)}
        >
          <WordCard
            word={word[lang]}
            role={word.role}
            view="operative"
            lang={lang}
            revealed={flipped.has(i)}
            aria-label={word[lang]}
            onClick={() => set(i, !flipped.has(i))}
          />
        </div>
      ))}
    </div>
  );
}
