export type ThemeName = "default" | "future-dark";

const THEME_ATTRIBUTE = "data-theme";

export function setTheme(theme: ThemeName): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

export function initTheme(theme: ThemeName = "default"): void {
  setTheme(theme);
}
