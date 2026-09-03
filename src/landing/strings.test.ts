import { describe, expect, it } from "vitest";
import { CREDIT_NAME, PRODUCT_NAME } from "../locale/messages";
import { STR, type LandingStrings } from "./strings";

/** Type-level parity: both locales must satisfy the same contract. */
const _ar: LandingStrings = STR.ar;
const _en: LandingStrings = STR.en;
void _ar;
void _en;

type PlainValue = string | boolean | undefined;

function keyShape(value: unknown): unknown {
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

describe("landing strings", () => {
  it("exposes exactly the same top-level keys in both languages", () => {
    expect(Object.keys(STR.ar).sort()).toEqual(Object.keys(STR.en).sort());
  });

  it("has the same nested key shape in both languages", () => {
    expect(keyShape(STR.ar)).toEqual(keyShape(STR.en));
  });

  it("uses Spy Mission public terminology", () => {
    expect(STR.en.productName).toBe(PRODUCT_NAME);
    expect(STR.ar.productName).toBe(PRODUCT_NAME);
    expect(STR.en.h1Before).toBe("One signal.");
    expect(STR.ar.h1Highlight).toBe("٢٥ كلمة.");
    expect(STR.ar.lobby.spymasterLabel).toBe("قائد المهمة");
    expect(STR.en.lobby.spymasterLabel).toBe("MISSION LEAD");
    expect(STR.ar.lobby.red.join).toBe("+ انضم كعميل ميداني");
    expect(STR.en.credit).toBe(CREDIT_NAME);
    expect(STR.ar.credit).toBe(CREDIT_NAME);
  });

  it("has no empty strings", () => {
    const walk = (value: unknown): void => {
      if (typeof value === "string") {
        expect(value.length).toBeGreaterThan(0);
        return;
      }
      if (value && typeof value === "object") {
        Object.values(value).forEach(walk);
      }
    };
    walk(STR.ar);
    walk(STR.en);
  });
});
