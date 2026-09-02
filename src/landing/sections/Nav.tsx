import { playUrl } from "../../config/routes";
import { Mark } from "../../ui/components/Mark";
import type { Lang, LandingStrings } from "../strings";

const OPTIONS: readonly { id: Lang; label: string; className: string }[] = [
  { id: "ar", label: "عربي", className: "cn-lp-lang__btn--ar" },
  { id: "en", label: "EN", className: "cn-lp-lang__btn--en" },
];

export interface NavProps {
  lang: Lang;
  onLangChange: (next: Lang) => void;
  t: LandingStrings;
}

export function Nav({ lang, onLangChange, t }: NavProps) {
  return (
    <nav className="cn-lp-nav" aria-label={t.nav}>
      <div className="cn-lp-wrap cn-lp-nav__inner">
        <Mark size={30} />
        <span className="cn-lp-wordmark">Codenames Hub</span>
        <div className="cn-lp-nav__actions">
          <div className="cn-lp-lang" role="group" aria-label={t.langGroup}>
            {OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`cn-lp-lang__btn ${option.className}`}
                aria-pressed={lang === option.id}
                onClick={() => onLangChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <a
            className="cn-lp-btn cn-lp-btn--primary cn-lp-btn--nav"
            href={playUrl({ create: true })}
          >
            {t.play}
          </a>
        </div>
      </div>
    </nav>
  );
}
