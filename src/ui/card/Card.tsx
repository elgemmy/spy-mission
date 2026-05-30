import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import "./Card.css";
import { GlyphIcon } from "./glyphs";
import type { CardLang, CardRole, CardView } from "./types";

export interface WordCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  word: string;
  role: CardRole;
  view: CardView;
  revealed?: boolean;
  lang?: CardLang;
}

export function WordCard({
  word,
  role,
  view,
  revealed = false,
  lang = "ar",
  className,
  disabled,
  type = "button",
  ...props
}: WordCardProps) {
  const isArabic = lang === "ar";

  return (
    <button
      type={type}
      className={cn(
        "cn-card",
        isArabic && "cn-card--ar",
        revealed && "is-revealed",
        className,
      )}
      data-role={role}
      data-view={view}
      dir={isArabic ? "rtl" : "ltr"}
      aria-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      {...props}
    >
      <span className="cn-card__inner">
        <span className="cn-card__face cn-card__face--front">
          <GlyphIcon role={role} className="cn-card__key" />
          <span className="cn-card__word">{word}</span>
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
