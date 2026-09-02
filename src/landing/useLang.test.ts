import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LANG_STORAGE_KEY, readStoredLang, useLang } from "./useLang";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
  document.documentElement.dir = "";
});

afterEach(() => {
  localStorage.clear();
});

describe("useLang", () => {
  it("defaults to Arabic and sets lang/dir on the document", () => {
    const { result } = renderHook(() => useLang());

    expect(result.current.lang).toBe("ar");
    expect(result.current.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("reads a stored preference", () => {
    localStorage.setItem(LANG_STORAGE_KEY, "en");

    const { result } = renderHook(() => useLang());

    expect(result.current.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("ignores an invalid stored value", () => {
    localStorage.setItem(LANG_STORAGE_KEY, "fr");

    expect(readStoredLang()).toBe("ar");
    expect(renderHook(() => useLang()).result.current.lang).toBe("ar");
  });

  it("persists a change and updates the document", () => {
    const { result } = renderHook(() => useLang());

    act(() => {
      result.current.setLang("en");
    });

    expect(result.current.lang).toBe("en");
    expect(result.current.isArabic).toBe(false);
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
});
