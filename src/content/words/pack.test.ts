// @vitest-environment node

import { describe, expect, it } from "vitest";
import { sampleConceptsForBoard, WORD_CATEGORIES } from "./sampler";

const MIN_CONCEPTS = 300;
const MIN_PER_CATEGORY = 15;

const ENGLISH_LABEL = /^[a-z]+( [a-z]+)?$/;
const ARABIC_LABEL =
  /^[\u0621-\u063A\u0641-\u064A]+( [\u0621-\u063A\u0641-\u064A]+)?$/;
const CONCEPT_ID = /^[a-z]+(-[a-z]+)*-\d{3}$/;

const allConcepts = WORD_CATEGORIES.flatMap((category) =>
  category.concepts.map((concept) => ({
    ...concept,
    category: category.category,
  })),
);

function normalizeEnglish(label: string) {
  return label.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Stricter than the documentation rule: also strips tashkeel and folds the
 * letter shapes that Arabic speakers treat as the same word when reading a
 * card (alef variants, taa marbuta / haa, alef maqsura / yaa).
 */
function normalizeArabic(label: string) {
  return label
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

describe("word pack content", () => {
  it("ships enough concepts for varied boards", () => {
    expect(allConcepts.length).toBeGreaterThanOrEqual(MIN_CONCEPTS);
  });

  it("keeps every category large enough for fair round-robin sampling", () => {
    for (const category of WORD_CATEGORIES) {
      expect(
        category.concepts.length,
        `category ${category.category}`,
      ).toBeGreaterThanOrEqual(MIN_PER_CATEGORY);
    }
  });

  it("uses unique ids that match their category", () => {
    expect(duplicates(allConcepts.map((concept) => concept.id))).toEqual([]);
    for (const concept of allConcepts) {
      expect(concept.id, concept.id).toMatch(CONCEPT_ID);
      expect(
        concept.id.startsWith(`${concept.category.replaceAll("_", "-")}-`),
      ).toBe(true);
    }
  });

  it("keeps labels short, lowercase, and in the right script", () => {
    for (const concept of allConcepts) {
      expect(concept.en, concept.id).toMatch(ENGLISH_LABEL);
      expect(concept.ar, concept.id).toMatch(ARABIC_LABEL);
    }
  });

  it("has no duplicate English cards after normalization", () => {
    const labels = allConcepts.map((concept) => normalizeEnglish(concept.en));
    expect(duplicates(labels)).toEqual([]);

    // Near-duplicates that would read as the same card (e.g. "date" / "dates").
    const set = new Set(labels);
    const pluralClashes = labels.filter((label) => set.has(`${label}s`));
    expect(pluralClashes).toEqual([]);
  });

  it("has no duplicate Arabic cards after normalization", () => {
    expect(
      duplicates(allConcepts.map((concept) => normalizeArabic(concept.ar))),
    ).toEqual([]);
  });
});

describe("board sampling from the shipped pack", () => {
  it("gives every board 25 unique concepts with unique labels in both languages", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const board = sampleConceptsForBoard(seed);
      expect(board).toHaveLength(25);
      expect(new Set(board.map((concept) => concept.id)).size).toBe(25);
      expect(
        new Set(board.map((concept) => normalizeEnglish(concept.en))).size,
      ).toBe(25);
      expect(
        new Set(board.map((concept) => normalizeArabic(concept.ar))).size,
      ).toBe(25);
    }
  });

  it("spreads a board across many categories", () => {
    const categoryById = new Map(
      allConcepts.map((concept) => [concept.id, concept.category]),
    );
    for (const seed of [3, 99, 1234]) {
      const categories = new Set(
        sampleConceptsForBoard(seed).map((concept) =>
          categoryById.get(concept.id),
        ),
      );
      expect(categories.size).toBeGreaterThanOrEqual(15);
    }
  });
});
