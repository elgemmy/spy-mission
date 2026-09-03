import { useState } from "react";
import { playUrl } from "../../config/routes";
import { WordCard } from "../../ui/card/Card";
import { GlyphIcon } from "../../ui/card/glyphs";
import type { CardRole } from "../../ui/card/types";
import { BLUE_TOTAL, LAYOUT, RED_TOTAL, wordsFor } from "../data/demoBoard";
import type { Lang, LandingStrings } from "../strings";

function LandChip({ role, n }: { role: CardRole; n: number }) {
  return (
    <span className="cn-lp-landchip cn-lp-role" data-role={role}>
      <GlyphIcon role={role} className="cn-lp-landchip__glyph" />
      <span className="cn-lp-landchip__n">{n}</span>
    </span>
  );
}

function MiniBoard({ lang, t }: { lang: Lang; t: LandingStrings }) {
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  const words = wordsFor(lang);

  const left = (role: CardRole, total: number) =>
    total -
    LAYOUT.filter((cell, i) => cell.role === role && revealed.has(i)).length;

  const reveal = (index: number) => {
    setRevealed((current) => new Set(current).add(index));
  };

  return (
    <div className="cn-lp-tilt">
      <div className="cn-lp-miniboard">
        <div className="cn-lp-miniboard__head">
          <LandChip role="red" n={left("red", RED_TOTAL)} />
          <span className="cn-lp-miniboard__hint">{t.tryMe}</span>
          <LandChip role="blue" n={left("blue", BLUE_TOTAL)} />
        </div>
        <div className="cn-lp-grid">
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
              onClick={() => reveal(i)}
            />
          ))}
        </div>
        <div className="cn-lp-miniboard__foot">
          <button
            type="button"
            className="cn-lp-reset"
            onClick={() => setRevealed(new Set<number>())}
          >
            {t.reset}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface HeroProps {
  lang: Lang;
  t: LandingStrings;
  hostLabel: string;
}

export function Hero({ lang, t, hostLabel }: HeroProps) {
  return (
    <header className="cn-lp-wrap cn-lp-hero">
      <div className="cn-lp-hero__copy">
        <p className="cn-lp-hero__tag">{t.tag}</p>
        <h1 className="cn-lp-hero__title">
          {t.h1Before} <span className="cn-lp-hi">{t.h1Highlight}</span>{" "}
          {t.h1After}
        </h1>
        <p className="cn-lp-hero__sub">{t.sub}</p>
        <div className="cn-lp-hero__cta">
          <a
            className="cn-lp-btn cn-lp-btn--primary cn-lp-btn--hero"
            href={playUrl({ create: true })}
          >
            {t.play}
          </a>
          <a
            className="cn-lp-btn cn-lp-btn--secondary cn-lp-btn--hero-2"
            href="#how"
          >
            {t.how}
          </a>
        </div>
        <p className="cn-lp-hostline" dir="ltr">
          <a className="cn-lp-hostlink" href={playUrl()}>
            {hostLabel}
          </a>
        </p>
      </div>
      <MiniBoard key={lang} lang={lang} t={t} />
    </header>
  );
}
