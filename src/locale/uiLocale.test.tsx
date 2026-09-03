import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { UiLocaleProvider } from "./UiLocaleProvider";
import {
  DEFAULT_UI_LOCALE,
  UI_LOCALE_STORAGE_KEY,
  dirFor,
  readStoredUiLocale,
  useUiLocale,
} from "./uiLocale";

function wrapper({ children }: { children: ReactNode }) {
  return <UiLocaleProvider>{children}</UiLocaleProvider>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
  document.documentElement.dir = "";
});

afterEach(() => {
  localStorage.clear();
});

describe("uiLocale", () => {
  it("defaults a fresh visitor to English and LTR", () => {
    expect(DEFAULT_UI_LOCALE).toBe("en");
    expect(readStoredUiLocale()).toBe("en");
    expect(dirFor("en")).toBe("ltr");
    expect(dirFor("ar")).toBe("rtl");

    const { result } = renderHook(() => useUiLocale(), { wrapper });

    expect(result.current.locale).toBe("en");
    expect(result.current.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("reads a stored Arabic preference", () => {
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, "ar");

    const { result } = renderHook(() => useUiLocale(), { wrapper });

    expect(result.current.locale).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("ignores an invalid stored value", () => {
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, "fr");

    expect(readStoredUiLocale()).toBe("en");
    expect(
      renderHook(() => useUiLocale(), { wrapper }).result.current.locale,
    ).toBe("en");
  });

  it("persists a change and updates the document", () => {
    const { result } = renderHook(() => useUiLocale(), { wrapper });

    act(() => {
      result.current.setLocale("ar");
    });

    expect(result.current.locale).toBe("ar");
    expect(result.current.isArabic).toBe(true);
    expect(localStorage.getItem(UI_LOCALE_STORAGE_KEY)).toBe("ar");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });
});
