import {
  UI_LOCALE_STORAGE_KEY,
  dirFor,
  readStoredUiLocale,
  useUiLocale,
  type UiLocale,
} from "../locale/uiLocale";

export const LANG_STORAGE_KEY = UI_LOCALE_STORAGE_KEY;

export { dirFor };
export type Lang = UiLocale;

/** Arabic or English, depending on the shared per-browser UI locale. */
export function readStoredLang(): UiLocale {
  return readStoredUiLocale();
}

export interface UseLangResult {
  lang: UiLocale;
  dir: "rtl" | "ltr";
  isArabic: boolean;
  setLang: (next: UiLocale) => void;
}

/**
 * Page language: persisted under `sm-lang` and mirrored onto
 * `<html lang>` / `<html dir>` so the browser picks the right shaping.
 * Same store as `/play/`.
 */
export function useLang(): UseLangResult {
  const { locale, dir, isArabic, setLocale } = useUiLocale();
  return { lang: locale, dir, isArabic, setLang: setLocale };
}
