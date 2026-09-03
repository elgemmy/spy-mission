import { useCallback, useEffect, useState } from "react";
import type { Lang } from "./strings";

export const LANG_STORAGE_KEY = "sm-lang";
export const DEFAULT_LANG: Lang = "ar";

function isLang(value: string | null): value is Lang {
  return value === "ar" || value === "en";
}

/** Arabic unless a valid preference was stored by a previous visit. */
export function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

export interface UseLangResult {
  lang: Lang;
  dir: "rtl" | "ltr";
  isArabic: boolean;
  setLang: (next: Lang) => void;
}

/**
 * Page language: persisted under `sm-lang` and mirrored onto
 * `<html lang>` / `<html dir>` so the browser picks the right shaping.
 */
export function useLang(): UseLangResult {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // A private-mode browser without storage still gets the right page.
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
  }, []);

  return { lang, dir: dirFor(lang), isArabic: lang === "ar", setLang };
}
