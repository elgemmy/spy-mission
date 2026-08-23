import { WordCard } from "../../ui/card/Card";
import { EyeMark } from "../../ui/components/EyeMark";
import { STEP_TILES } from "../data/demoBoard";
import { DEMO_ROOM_CODE, type Lang, type LandingStrings } from "../strings";

const INDEXES = ["01", "02", "03"] as const;

function StepVisual({
  n,
  lang,
  t,
}: {
  n: number;
  lang: Lang;
  t: LandingStrings;
}) {
  if (n === 0) {
    return (
      <div className="cn-lp-step__visual">
        <span className="cn-lp-code-chip" dir="ltr">
          {DEMO_ROOM_CODE}
        </span>
      </div>
    );
  }

  if (n === 1) {
    return (
      <div className="cn-lp-step__visual">
        <span className="cn-lp-cluepill">
          <EyeMark size={18} color="var(--cn-ink)" />
          <span className="cn-lp-cluepill__label">{t.clue}</span>
          <span className="cn-lp-cluepill__word">{t.clueWord}</span>
          <span className="cn-lp-cluepill__count">3</span>
        </span>
      </div>
    );
  }

  return (
    <div className="cn-lp-step__visual cn-lp-step__tiles">
      {STEP_TILES.map((tile) => (
        <div key={tile.en} className="cn-lp-step__tile">
          <WordCard
            word={tile[lang]}
            role={tile.role}
            view="operative"
            lang={lang}
            revealed={tile.revealed}
            disabled
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  );
}

export interface HowToPlayProps {
  lang: Lang;
  t: LandingStrings;
}

export function HowToPlay({ lang, t }: HowToPlayProps) {
  return (
    <section id="how" className="cn-lp-wrap cn-lp-section">
      <h2 className="cn-lp-h2">{t.howTitle}</h2>
      <div className="cn-lp-steps">
        {t.steps.map((step, i) => (
          <article key={step.t} className="cn-lp-step">
            <p className="cn-lp-step__index">{INDEXES[i]}</p>
            <StepVisual n={i} lang={lang} t={t} />
            <h3 className="cn-lp-step__title">{step.t}</h3>
            <p className="cn-lp-step__body">{step.b}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
