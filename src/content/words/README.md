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

Current pack:

- 19 categories, 22–28 concepts each
- 444 concepts, all with unique `id`, unique normalized English, and unique
  normalized Arabic labels (enforced by [`pack.test.ts`](pack.test.ts))

Categories: `animals`, `fruits_and_vegetables`, `food_and_drink`, `home`,
`objects_and_tools`, `nature`, `sky_and_weather`, `transport`, `places`,
`people`, `body`, `clothing`, `technology`, `sports_and_games`, `adventure`,
`arts_and_school`, `materials`, `time_and_celebration`, `ideas`.

## Curation rules

Every concept is a common, highly recognizable noun that a group of friends
would know in both languages and could connect to several unrelated concepts.
The pack deliberately excludes celebrities, fictional characters, brands,
personal names, nationalities and languages, obscure species or dishes,
technical jargon, gerunds where a plain noun exists, and near-duplicate
concepts (including same-root pairs such as _farm_ / _farmer_).

English labels are lowercase and at most two words. Arabic labels are
idiomatic everyday Arabic, at most two words, with no diacritics. Two-word
labels are used only when they are the normal name of the thing
(`ice cream`, `rainbow` / `قوس قزح`, `birthday` / `عيد ميلاد`,
`passport` / `جواز سفر`).

## How the pack is used

`sampleConceptsForBoard` in [`sampler.ts`](sampler.ts):

1. Loads this JSON as `WORD_CATEGORIES`
2. Shuffles categories with the deal `seed`
3. Shuffles each category’s concepts with a derived seed
4. Round-robins across categories until it has 25 concepts
5. Shuffles the selected 25 again

The engine then deals kinds (9 / 8 / 7 / 1) onto those concepts. Sampling is
deterministic for a given seed. Because categories are close in size, every
concept appears on roughly 4.5–6 % of boards.

## Provenance

This pack was authored from scratch for this repository in September 2026 as
first-party content. It was not copied from the previous pack or from any
published game or card list. The earlier pack (added in
`316dfc37c8733aa688cc889213189e9cc36482be`, whose English-list lineage was
never resolved) is no longer shipped and survives only in git history.
