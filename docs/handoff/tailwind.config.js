/** ============================================================
 *  Codename — Tailwind theme extension  ·  "Warm Sand"
 *  Maps tokens.css variables to semantic utilities so the tokens
 *  stay the single source of truth (change a var → everything moves).
 *
 *  Usage:  bg-surface  text-ink  border-line  rounded-card
 *          bg-red text-red-on  /  bg-red-tint text-red-ink
 *          font-ar  font-mono  shadow-tile  ease-flip
 *  ============================================================ */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'var(--cn-bg)',
        surface:   'var(--cn-surface)',
        'surface-2':'var(--cn-surface-2)',
        ink:       'var(--cn-ink)',
        'ink-soft':'var(--cn-ink-soft)',
        line:      'var(--cn-line)',
        primary:   'var(--cn-primary)',
        'primary-on':'var(--cn-primary-on)',
        red:       { DEFAULT: 'var(--cn-red)', ink: 'var(--cn-red-ink)', tint: 'var(--cn-red-tint)', on: 'var(--cn-red-on)' },
        blue:      { DEFAULT: 'var(--cn-blue)', ink: 'var(--cn-blue-ink)', tint: 'var(--cn-blue-tint)', on: 'var(--cn-blue-on)' },
        neutral:   { DEFAULT: 'var(--cn-neutral)', ink: 'var(--cn-neutral-ink)', tint: 'var(--cn-neutral-tint)', on: 'var(--cn-neutral-on)' },
        assassin:  { DEFAULT: 'var(--cn-assassin)', ink: 'var(--cn-assassin-ink)', tint: 'var(--cn-assassin-tint)', on: 'var(--cn-assassin-on)' },
      },
      fontFamily: {
        ui:   ['Rubik', 'system-ui', 'sans-serif'],
        ar:   ['Cairo', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: 'var(--cn-r-card)',
        chip: 'var(--cn-r-chip)',
        bar:  'var(--cn-r-bar)',
        sm:   'var(--cn-r-sm)',
      },
      boxShadow: {
        tile: 'var(--cn-shadow-tile)',
        bar:  'var(--cn-shadow-bar)',
        cta:  'var(--cn-shadow-cta)',
      },
      transitionTimingFunction: {
        flip: 'cubic-bezier(.34, 1.2, .46, 1)',
      },
      transitionDuration: {
        flip: '190ms',
      },
      maxWidth: {
        shell: '480px',
      },
    },
  },
  plugins: [],
};
