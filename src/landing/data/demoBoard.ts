import type { CardRole } from "../../ui/card/types";
import type { Lang } from "../strings";

export interface DemoCell {
  role: CardRole;
  /** Pre-revealed in the in-game screenshot preview. */
  r: boolean;
}

/** 5×5 key: red 9, blue 8, neutral 7, assassin 1. */
export const LAYOUT: readonly DemoCell[] = [
  { role: "red", r: true },
  { role: "blue", r: false },
  { role: "neutral", r: false },
  { role: "red", r: true },
  { role: "blue", r: false },
  { role: "neutral", r: false },
  { role: "red", r: false },
  { role: "blue", r: true },
  { role: "neutral", r: false },
  { role: "red", r: false },
  { role: "blue", r: false },
  { role: "neutral", r: true },
  { role: "assassin", r: false },
  { role: "red", r: false },
  { role: "blue", r: false },
  { role: "neutral", r: false },
  { role: "red", r: false },
  { role: "blue", r: false },
  { role: "neutral", r: false },
  { role: "red", r: false },
  { role: "blue", r: false },
  { role: "neutral", r: false },
  { role: "red", r: false },
  { role: "blue", r: false },
  { role: "red", r: false },
];

export const RED_TOTAL = 9;
export const BLUE_TOTAL = 8;

export const WORDS_AR: readonly string[] = [
  "قطار",
  "بحر",
  "نجمة",
  "قمر",
  "كتاب",
  "باب",
  "شمس",
  "ملك",
  "جبل",
  "نهر",
  "وردة",
  "حصان",
  "سيف",
  "ذهب",
  "طائر",
  "سمكة",
  "بيت",
  "شجرة",
  "غابة",
  "مفتاح",
  "ساعة",
  "قلب",
  "ثعلب",
  "جسر",
  "نار",
];

export const WORDS_EN: readonly string[] = [
  "TRAIN",
  "OCEAN",
  "STAR",
  "MOON",
  "BOOK",
  "DOOR",
  "SUN",
  "KING",
  "MOUNT",
  "RIVER",
  "ROSE",
  "HORSE",
  "SWORD",
  "GOLD",
  "BIRD",
  "FISH",
  "HOUSE",
  "TREE",
  "FOREST",
  "KEY",
  "CLOCK",
  "HEART",
  "FOX",
  "BRIDGE",
  "FIRE",
];

export function wordsFor(lang: Lang): readonly string[] {
  return lang === "ar" ? WORDS_AR : WORDS_EN;
}

export interface DemoWord {
  ar: string;
  en: string;
  role: CardRole;
}

/** The scattered hover-to-flip row under the hero. */
export const ROW: readonly DemoWord[] = [
  { ar: "وردة", en: "ROSE", role: "red" },
  { ar: "مفتاح", en: "KEY", role: "blue" },
  { ar: "قمر", en: "MOON", role: "neutral" },
  { ar: "جسر", en: "BRIDGE", role: "red" },
  { ar: "ثعلب", en: "FOX", role: "assassin" },
  { ar: "بحر", en: "OCEAN", role: "blue" },
  { ar: "نار", en: "FIRE", role: "red" },
  { ar: "ساعة", en: "CLOCK", role: "blue" },
];

/** Per-tile tilt (deg) for `ROW`. */
export const ROT: readonly number[] = [-2, 1.5, -1, 2, -1.5, 1, -2, 1.5];

/** The three static tiles in step 03 of "How to play". */
export const STEP_TILES: readonly (DemoWord & { revealed: boolean })[] = [
  { ar: "باب", en: "DOOR", role: "neutral", revealed: false },
  { ar: "نار", en: "FIRE", role: "red", revealed: true },
  { ar: "سيف", en: "SWORD", role: "assassin", revealed: true },
];
