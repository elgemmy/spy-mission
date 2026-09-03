import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  UiLocaleContext,
  dirFor,
  persistUiLocale,
  readStoredUiLocale,
  type UiLocale,
  type UseUiLocaleResult,
} from "./uiLocale";

/**
 * Shared UI locale for landing and `/play/`. Persisted per browser under
 * `sm-lang`. Independent of a room's board language.
 */
export function UiLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(readStoredUiLocale);

  useEffect(() => {
    persistUiLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
  }, []);

  const value: UseUiLocaleResult = {
    locale,
    dir: dirFor(locale),
    isArabic: locale === "ar",
    setLocale,
  };

  return (
    <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>
  );
}
