import type { CardRole } from "./types";

export function GlyphDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="g-red" viewBox="0 0 24 24">
        <path
          d="M12 4.2 L20.2 19 H3.8 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="g-blue" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="7.4" fill="currentColor" />
      </symbol>
      <symbol id="g-neutral" viewBox="0 0 24 24">
        <rect
          x="5.2"
          y="5.2"
          width="13.6"
          height="13.6"
          rx="4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
        />
      </symbol>
      <symbol id="g-assassin" viewBox="0 0 24 24">
        <path
          d="M8.3 3.6 h7.4 L20.4 8.3 v7.4 L15.7 20.4 h-7.4 L3.6 15.7 v-7.4 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path
          d="M9.2 9.2 L14.8 14.8 M14.8 9.2 L9.2 14.8"
          stroke="currentColor"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      </symbol>
    </svg>
  );
}

export function GlyphIcon({
  role,
  className,
}: {
  role: CardRole;
  className?: string;
}) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#g-${role}`} />
    </svg>
  );
}
