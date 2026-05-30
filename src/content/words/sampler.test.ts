import { describe, expect, it } from "vitest";
import { sampleConceptsForBoard, WORD_CATEGORIES } from "./sampler";

describe("word sampler", () => {
  it("samples 25 deterministic unique concepts", () => {
    const first = sampleConceptsForBoard(123);
    const second = sampleConceptsForBoard(123);
    const other = sampleConceptsForBoard(124);

    expect(first).toHaveLength(25);
    expect(first.map((concept) => concept.id)).toEqual(
      second.map((concept) => concept.id),
    );
    expect(first.map((concept) => concept.id)).not.toEqual(
      other.map((concept) => concept.id),
    );
    expect(new Set(first.map((concept) => concept.id)).size).toBe(25);
  });

  it("spreads sampled concepts across categories", () => {
    const concepts = sampleConceptsForBoard(321);
    const prefixes = new Set(
      concepts.map((concept) => concept.id.split("-")[0]),
    );
    expect(prefixes.size).toBeGreaterThanOrEqual(5);
  });

  it("rejects datasets that cannot fill a board", () => {
    expect(() =>
      sampleConceptsForBoard(1, [
        {
          category: "tiny",
          concepts: WORD_CATEGORIES[0]!.concepts.slice(0, 2),
        },
      ]),
    ).toThrow("Need at least 25 concepts");
  });
});
