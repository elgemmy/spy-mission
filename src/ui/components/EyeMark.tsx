export interface EyeMarkProps {
  /** Edge length in px. */
  size?: number;
  /** Any CSS colour value — pass a `--cn-*` token, never a literal. */
  color?: string;
  className?: string;
}

/** The spymaster eye. Decorative: always paired with a text label. */
export function EyeMark({
  size = 16,
  color = "currentColor",
  className,
}: EyeMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.6 12C5.6 6.6 18.4 6.6 21.4 12 18.4 17.4 5.6 17.4 2.6 12Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" fill={color} />
    </svg>
  );
}
