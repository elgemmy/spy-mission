# Word pack

The shipped board content lives in the [JSON word-pack file](codenames.json)
in this directory.

Spy Mission is an independent word-association game project.

Provenance: [`ASSET_PROVENANCE.md`](../../../ASSET_PROVENANCE.md).
License status: [`NOTICE.md`](NOTICE.md).

## Bilingual structure

The file is an array of categories. Each category has a `category` slug and a
`concepts` array. Every concept is:

```ts
{
  id: string;
  en: string;
  ar: string;
}
```

Both labels always travel with the card. The room’s `lang` field chooses which
label to render. Switching language in the lobby re-renders the other label
without re-dealing.

Current pack (inspected, not modified):

- 23 categories
- 597 concepts
- 597 unique `id` values
- 597 unique Arabic labels
- 585 unique English labels (after the normalization below)

Categories: `animals`, `food`, `countries_and_landmarks`, `professions`,
`famous_people`, `names`, `ingredients_vegetables_fruits`, `capitals`,
`tools_and_devices`, `colors`, `interests`, `languages`, `sports`, `places`,
`cartoon_characters`, `plants`, `fish_and_seafood`, `objects`, `body_parts`,
`drinks`, `vehicles`, `nature`, `people`.

## How the pack is used

`sampleConceptsForBoard` in [`sampler.ts`](sampler.ts):

1. Loads this JSON as `WORD_CATEGORIES`
2. Shuffles categories with the deal `seed`
3. Shuffles each category’s concepts with a derived seed
4. Round-robins across categories until it has 25 concepts
5. Shuffles the selected 25 again

The engine then deals kinds (9 / 8 / 7 / 1) onto those concepts. Sampling is
deterministic for a given seed. Production uses the default pack and a
25-card board.

Uniqueness is by **concept id**, not by rendered label. Two concepts with the
same English string can both appear on one board.

## Provenance

Known facts:

- The pack entered git in `316dfc37c8733aa688cc889213189e9cc36482be`
  (30 May 2026).
- Arabic labels match an author-owned working document created that day.
- English strings are paired in the same JSON.

English-list lineage is unresolved. This README does not claim a third-party
source or clearance, and does not place the pack under the repository MIT
grant. Word-list entries reproduced below are also outside that grant. See
[`ASSET_PROVENANCE.md`](../../../ASSET_PROVENANCE.md).

## Normalization rules (documentation only)

The runtime pack is stored as authored. There is **no** runtime normalizer
that merges labels before deal.

For inspection and for house-rule “word on the board” discussion, treat a
rendered English label as:

1. Unicode NFC
2. Trim leading/trailing whitespace
3. Collapse internal whitespace to a single space
4. Case-fold with `toLowerCase()`

Arabic inspection used NFC + trim + whitespace collapse only (no letter-shape
folding). Under that rule, Arabic labels are unique.

The engine’s Signal check is structural (`trim`, non-empty, count 0–9). It does
not reject a Signal that matches a board label. Semantic “must not say a word
on the board” is a house rule. The hidden other-language label does not count
as on the board ([engine contract](../../../docs/planning/engine-contract.md)).

## Duplicate rendered English labels

These pairs share the same normalized English string and **different** Arabic
(or a gendered/synonym pair). The JSON was not edited. If a content pass is
needed, that belongs to the runtime/content owner.

| English (normalized) | Concept ids                                        | Categories                             | Arabic           |
| -------------------- | -------------------------------------------------- | -------------------------------------- | ---------------- |
| `cat`                | `animals-029`, `animals-037`                       | animals, animals                       | قط / قطة         |
| `mouse`              | `animals-031`, `tools-and-devices-018`             | animals, tools_and_devices             | فأر / ماوس       |
| `fish`               | `animals-034`, `ingredients-vegetables-fruits-018` | animals, ingredients_vegetables_fruits | سمكة / سمك       |
| `pasta`              | `food-011`, `ingredients-vegetables-fruits-002`    | food, ingredients_vegetables_fruits    | باستا / مكرونة   |
| `dates`              | `food-042`, `ingredients-vegetables-fruits-072`    | food, ingredients_vegetables_fruits    | تمر / بلح        |
| `rice`               | `food-043`, `ingredients-vegetables-fruits-001`    | food, ingredients_vegetables_fruits    | رز / أرز         |
| `cheese`             | `food-044`, `ingredients-vegetables-fruits-013`    | food, ingredients_vegetables_fruits    | جبن / جبنة       |
| `orange`             | `ingredients-vegetables-fruits-054`, `colors-005`  | ingredients_vegetables_fruits, colors  | برتقال / برتقالي |
| `hammer`             | `tools-and-devices-001`, `tools-and-devices-006`   | tools_and_devices, tools_and_devices   | مطرقة / شاكوش    |
| `burgundy`           | `colors-019`, `colors-025`                         | colors, colors                         | نبيتي / عنابي    |
| `copper`             | `colors-023`, `objects-009`                        | colors, objects                        | نحاسي / نحاس     |
| `grouper`            | `fish-and-seafood-008`, `fish-and-seafood-014`     | fish_and_seafood, fish_and_seafood     | الهامور / وقار   |

Most of these are real bilingual homographs or synonym pairs (animal vs
ingredient, fruit vs color, tool vs material). A few are near-duplicate
English glosses of distinct Arabic words (`hammer`, `burgundy`, `grouper`).
