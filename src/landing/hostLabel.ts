import { playHostLabel } from "../config/routes";

/**
 * The visible text for links into the game, e.g. `spymaster.example.com/play`.
 * Safe during SSR/prerender, where there is no `window`.
 */
export function useHostLabel(): string {
  if (typeof window === "undefined") {
    return playHostLabel("");
  }
  return playHostLabel(window.location.host);
}
