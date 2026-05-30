import { shuffleWithSeed } from "../../engine/codenames/seeded";
import type { Concept } from "../../engine";
import wordCategories from "./codenames.json";
import type { WordCategory } from "./types";

export const WORD_CATEGORIES = wordCategories satisfies WordCategory[];

export function sampleConceptsForBoard(
  seed: number,
  categories: WordCategory[] = WORD_CATEGORIES,
  size = 25,
) {
  const available = categories.reduce(
    (count, category) => count + category.concepts.length,
    0,
  );
  if (available < size) {
    throw new Error(`Need at least ${size} concepts, received ${available}.`);
  }

  const buckets = shuffleWithSeed(
    categories.filter((category) => category.concepts.length > 0),
    seed,
  ).map((category, index) => ({
    category: category.category,
    concepts: shuffleWithSeed(category.concepts, seed + index + 1),
    cursor: 0,
  }));

  const selected: Concept[] = [];
  let bucketCursor = 0;
  while (selected.length < size) {
    const bucket = buckets[bucketCursor % buckets.length]!;
    const concept = bucket.concepts[bucket.cursor];
    if (concept) {
      selected.push(concept);
      bucket.cursor += 1;
    }
    bucketCursor += 1;
  }

  return shuffleWithSeed(selected, seed + 101);
}
