import { GlyphIcon } from "../../ui/card/glyphs";
import type { CardRole } from "../../ui/card/types";
import type { FeatureKey, LandingStrings } from "../strings";

const ALL_ROLES: readonly CardRole[] = ["red", "blue", "neutral", "assassin"];

function FeatureIcon({ k }: { k: FeatureKey }) {
  if (k === "noapp") {
    return (
      <GlyphIcon role="blue" className="cn-lp-feat__glyph cn-lp-solid-blue" />
    );
  }
  if (k === "free") {
    return (
      <GlyphIcon
        role="neutral"
        className="cn-lp-feat__glyph cn-lp-ink-neutral"
      />
    );
  }
  if (k === "bi") {
    return (
      <span className="cn-lp-feat__bi" aria-hidden="true">
        <span className="cn-lp-feat__bi-ar">ع</span>
        <span className="cn-lp-feat__bi-en"> · A</span>
      </span>
    );
  }
  return (
    <span className="cn-lp-feat__glyphs">
      {ALL_ROLES.map((role) => (
        <GlyphIcon
          key={role}
          role={role}
          className={`cn-lp-feat__glyph-sm cn-lp-ink-${role}`}
        />
      ))}
    </span>
  );
}

export interface FeaturesProps {
  t: LandingStrings;
}

export function Features({ t }: FeaturesProps) {
  return (
    <section className="cn-lp-wrap cn-lp-section">
      <h2 className="cn-lp-h2">{t.featTitle}</h2>
      <div className="cn-lp-feats">
        {t.feats.map((feature) => (
          <article key={feature.k} className="cn-lp-feat">
            <div className="cn-lp-feat__icon">
              <FeatureIcon k={feature.k} />
            </div>
            <h3 className="cn-lp-feat__title">{feature.t}</h3>
            <p className="cn-lp-feat__body">{feature.b}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
