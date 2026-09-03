import { describe, expect, it } from "vitest";
import { MESSAGES, type Messages } from "./messages";

const _ar: Messages = MESSAGES.ar;
const _en: Messages = MESSAGES.en;
void _ar;
void _en;

type PlainValue = string | boolean | undefined;

function keyShape(value: unknown): unknown {
  if (typeof value === "function") {
    return "function";
  }
  if (Array.isArray(value)) {
    return value.map(keyShape);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          keyShape((value as Record<string, PlainValue>)[key]),
        ]),
    );
  }
  return typeof value;
}

function walkStrings(
  value: unknown,
  visit: (text: string, path: string) => void,
  path = "",
): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (typeof value === "function") {
    const sample = value("NAME", "ROLE", "WORD");
    if (typeof sample === "string") {
      visit(sample, `${path}()`);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, visit, path ? `${path}.${key}` : key);
    }
  }
}

describe("locale catalog", () => {
  it("exposes exactly the same key shape in both languages", () => {
    expect(keyShape(MESSAGES.en)).toEqual(keyShape(MESSAGES.ar));
  });

  it("has no empty strings in either language", () => {
    for (const locale of ["en", "ar"] as const) {
      walkStrings(MESSAGES[locale], (text, path) => {
        expect(text.length, path).toBeGreaterThan(0);
      });
    }
  });

  it("keeps error code keys identical", () => {
    expect(Object.keys(MESSAGES.en.play.errors).sort()).toEqual(
      Object.keys(MESSAGES.ar.play.errors).sort(),
    );
  });

  it("does not expose infrastructure remediation to players", () => {
    walkStrings(MESSAGES.en.play.errors, (text) => {
      expect(text).not.toMatch(/Supabase|Vercel|VITE_|environment variable/i);
    });
    walkStrings(MESSAGES.ar.play.errors, (text) => {
      expect(text).not.toMatch(/Supabase|Vercel|VITE_/i);
    });
  });
});
