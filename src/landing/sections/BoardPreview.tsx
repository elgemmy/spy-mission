import { useState } from "react";
import { WordCard } from "../../ui/card/Card";
import { GlyphIcon } from "../../ui/card/glyphs";
import type { CardRole } from "../../ui/card/types";
import { BLUE_TOTAL, LAYOUT, RED_TOTAL, wordsFor } from "../data/demoBoard";
import type { Lang, LandingStrings } from "../strings";
import { dirFor } from "../useLang";

function CountChip({
  role,
  n,
  active,
}: {
  role: CardRole;
  n: number;
  active?: boolean;
}) {
  return (
    <span
      className="cn-lp-countchip cn-lp-role"
      data-role={role}
      data-active={active ? "true" : "false"}
    >
      <GlyphIcon role={role} className="cn-lp-countchip__glyph" />
      <span className="cn-lp-countchip__n">{n}</span>
    </span>
  );
}

export interface BoardPreviewProps {
  lang: Lang;
  t: LandingStrings;
}

/** The operative's in-game screen, playable inside the phone frame. */
export function BoardPreview({ lang, t }: BoardPreviewProps) {
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(
    () => new Set<number>(LAYOUT.flatMap((cell, i) => (cell.r ? [i] : []))),
  );
  const words = wordsFor(lang);

  const left = (role: CardRole, total: number) =>
    total -
    LAYOUT.filter((cell, i) => cell.role === role && revealed.has(i)).length;

  return (
    <div className="cn-lp-board" data-lang={lang} dir={dirFor(lang)}>
      <div className="cn-lp-board__top">
        <CountChip role="red" n={left("red", RED_TOTAL)} active />
        <span className="cn-lp-board__turn">
          <span className="cn-lp-board__eyebrow">{t.board.nowPlaying}</span>
          <span className="cn-lp-board__team">{t.board.turn}</span>
        </span>
        <CountChip role="blue" n={left("blue", BLUE_TOTAL)} />
      </div>

      <div className="cn-lp-grid cn-lp-board__grid">
        {LAYOUT.map((cell, i) => (
          <WordCard
            key={i}
            word={words[i]}
            role={cell.role}
            view="operative"
            lang={lang}
            revealed={revealed.has(i)}
            disabled={revealed.has(i)}
            aria-label={words[i]}
            onClick={() => setRevealed((current) => new Set(current).add(i))}
          />
        ))}
      </div>

      <div className="cn-lp-cluebar">
        <div className="cn-lp-cluebar__inner">
          <span className="cn-lp-cluebar__clue">
            <span className="cn-lp-cluebar__label">{t.clue}</span>
            <span className="cn-lp-cluebar__word">{t.clueWord}</span>
            <span className="cn-lp-cluebar__count">3</span>
          </span>
          <span className="cn-lp-ghostpill" aria-hidden="true">
            {t.board.endTurn}
          </span>
        </div>
      </div>
    </div>
  );
}
