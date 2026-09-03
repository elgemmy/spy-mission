import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { UiLocaleProvider } from "../locale/UiLocaleProvider";
import { LANG_STORAGE_KEY, readStoredLang, useLang } from "./useLang";

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

describe("useLang", () => {
  it("defaults to English and sets lang/dir on the document", () => {
    const { result } = renderHook(() => useLang(), { wrapper });

    expect(result.current.lang).toBe("en");
    expect(result.current.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("reads a stored preference", () => {
    localStorage.setItem(LANG_STORAGE_KEY, "ar");

    const { result } = renderHook(() => useLang(), { wrapper });

    expect(result.current.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("ignores an invalid stored value", () => {
    localStorage.setItem(LANG_STORAGE_KEY, "fr");

    expect(readStoredLang()).toBe("en");
    expect(renderHook(() => useLang(), { wrapper }).result.current.lang).toBe(
      "en",
    );
  });

  it("persists a change and updates the document", () => {
    const { result } = renderHook(() => useLang(), { wrapper });

    act(() => {
      result.current.setLang("ar");
    });

    expect(result.current.lang).toBe("ar");
    expect(result.current.isArabic).toBe(true);
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("ar");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });
});
