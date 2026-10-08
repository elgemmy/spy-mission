import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { cn } from "../../lib/cn";
import "./Card.css";
import { GlyphIcon } from "./glyphs";
import type { CardLang, CardRole, CardView } from "./types";
import { hintColor, validHintScore } from "../hint/score";
import { formatHintScore, HINT_MESSAGES } from "../hint/strings";

export interface WordCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  word: string;
  role: CardRole;
  view: CardView;
  revealed?: boolean;
  lang?: CardLang;
  hintScore?: number;
  hintLocale?: CardLang;
}

export function WordCard({
  word,
  role,
  view,
  revealed = false,
  lang = "ar",
  hintScore,
  hintLocale = lang,
  className,
  style,
  disabled,
  type = "button",
  "aria-label": ariaLabel,
  ...props
}: WordCardProps) {
  const isArabic = lang === "ar";
  const score =
    !revealed && view === "operative" ? validHintScore(hintScore) : undefined;
  const scoreLabel =
    score === undefined ? null : formatHintScore(score, hintLocale);
  const hintStyle: CSSProperties | undefined =
    score === undefined
      ? style
      : ({
          ...style,
          "--cn-hint-color": hintColor(score),
        } as CSSProperties);

  return (
    <button
      type={type}
      className={cn(
        "cn-card",
        isArabic && "cn-card--ar",
        revealed && "is-revealed",
        score !== undefined && "has-hint",
        className,
      )}
      data-role={role}
      data-view={view}
      dir={isArabic ? "rtl" : "ltr"}
      aria-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      {...props}
      style={hintStyle}
      aria-label={
        scoreLabel === null
          ? ariaLabel
          : `${ariaLabel ?? word}: ${HINT_MESSAGES[hintLocale].score(scoreLabel)}`
      }
    >
      <span className="cn-card__inner">
        <span className="cn-card__face cn-card__face--front">
          <GlyphIcon role={role} className="cn-card__key" />
          <span className="cn-card__word">{word}</span>
          {scoreLabel !== null ? (
            <span
              className="cn-card__hint-score"
              aria-hidden="true"
              dir={hintLocale === "ar" ? "rtl" : "ltr"}
            >
              {scoreLabel}
            </span>
          ) : null}
        </span>
        <span className="cn-card__face cn-card__face--back">
          <span className="cn-card__watermark">
            <GlyphIcon role={role} />
          </span>
          <span className="cn-card__reveal">
            <GlyphIcon role={role} />
            <span className="cn-card__word">{word}</span>
          </span>
        </span>
      </span>
    </button>
  );
}
