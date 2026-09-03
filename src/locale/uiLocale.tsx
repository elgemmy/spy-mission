import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UiLocale = "en" | "ar";

export const UI_LOCALE_STORAGE_KEY = "sm-lang";
export const DEFAULT_UI_LOCALE: UiLocale = "en";

export function isUiLocale(value: string | null): value is UiLocale {
  return value === "ar" || value === "en";
}

/** English unless a valid preference was stored by a previous visit. */
export function readStoredUiLocale(): UiLocale {
  try {
    const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    return isUiLocale(stored) ? stored : DEFAULT_UI_LOCALE;
  } catch {
    return DEFAULT_UI_LOCALE;
  }
}

export function dirFor(locale: UiLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function applyDocumentLocale(locale: UiLocale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirFor(locale);
}

export function persistUiLocale(locale: UiLocale): void {
  try {
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
  } catch {
    // A private-mode browser without storage still gets the right page.
  }
  applyDocumentLocale(locale);
}

export interface UseUiLocaleResult {
  locale: UiLocale;
  dir: "rtl" | "ltr";
  isArabic: boolean;
  setLocale: (next: UiLocale) => void;
}

const UiLocaleContext = createContext<UseUiLocaleResult | null>(null);

function useUiLocaleState(): UseUiLocaleResult {
  const [locale, setLocaleState] = useState<UiLocale>(readStoredUiLocale);

  useEffect(() => {
    persistUiLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
  }, []);

  return {
    locale,
    dir: dirFor(locale),
    isArabic: locale === "ar",
    setLocale,
  };
}

/**
 * Shared UI locale for landing and `/play/`. Persisted per browser under
 * `sm-lang`. Independent of a room's board language.
 */
export function UiLocaleProvider({ children }: { children: ReactNode }) {
  const value = useUiLocaleState();
  return (
    <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>
  );
}

export function useUiLocale(): UseUiLocaleResult {
  const context = useContext(UiLocaleContext);
  return useMemo(() => context ?? fallbackUiLocale(), [context]);
}

function fallbackUiLocale(): UseUiLocaleResult {
  const locale = readStoredUiLocale();
  return {
    locale,
    dir: dirFor(locale),
    isArabic: locale === "ar",
    setLocale: persistUiLocale,
  };
}
