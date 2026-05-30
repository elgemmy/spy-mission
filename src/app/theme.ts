export type ThemeName = "default" | "future-dark";

const THEME_ATTRIBUTE = "data-theme";

export function getTheme(): ThemeName {
  const value = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  if (value === "future-dark") return "future-dark";
  return "default";
}

export function setTheme(theme: ThemeName): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

export function initTheme(theme: ThemeName = "default"): void {
  setTheme(theme);
}
