/**
 * Landing copy. Arabic is canonical (see `docs/handoff/landing/cn-landing.jsx`);
 * both locales must share the exact same key set — enforced by the
 * `LandingStrings` annotations below and by `strings.test.ts`.
 */

export type Lang = "ar" | "en";

export type FeatureKey = "noapp" | "free" | "bi" | "cb";

export interface LandingStep {
  t: string;
  b: string;
}

export interface LandingFeature {
  k: FeatureKey;
  t: string;
  b: string;
}

export interface LandingOperative {
  name: string;
  you?: boolean;
}

export interface LandingTeamStrings {
  title: string;
  spymaster: string;
  operatives: readonly LandingOperative[];
  join: string;
}

export interface LandingLobbyStrings {
  title: string;
  subtitle: string;
  online: string;
  codeLabel: string;
  copy: string;
  copied: string;
  shareHint: string;
  boardLangLabel: string;
  boardLangAr: string;
  boardLangEn: string;
  boardLangGroup: string;
  spymasterLabel: string;
  you: string;
  start: string;
  red: LandingTeamStrings;
  blue: LandingTeamStrings;
}

export interface LandingBoardStrings {
  nowPlaying: string;
  turn: string;
  endTurn: string;
}

export interface LandingStrings {
  tag: string;
  h1Before: string;
  h1Highlight: string;
  h1After: string;
  sub: string;
  play: string;
  how: string;
  tryMe: string;
  reset: string;
  howTitle: string;
  steps: readonly LandingStep[];
  featTitle: string;
  feats: readonly LandingFeature[];
  screensTitle: string;
  screens: readonly [string, string];
  ctaTitle: string;
  ctaSub: string;
  credit: string;
  clue: string;
  clueWord: string;
  install: string;
  nav: string;
  langGroup: string;
  lobby: LandingLobbyStrings;
  board: LandingBoardStrings;
}

const ar: LandingStrings = {
  tag: "لعبة كلمات وجواسيس للعائلة",
  h1Before: "تلميح واحد.",
  h1Highlight: "٢٥ كلمة.",
  h1After: "فريقان.",
  sub: "اجمع العائلة: سيّد التجسس يعطي تلميحًا من كلمة واحدة، وفريقك يكشف البطاقات الصحيحة — واحذروا القاتل.",
  play: "ابدأ غرفة الآن",
  how: "كيف تُلعب؟",
  tryMe: "جرّبها — المس البطاقات",
  reset: "أعد البطاقات",
  howTitle: "كيف تُلعب",
  steps: [
    {
      t: "أنشئ غرفة وشارك الرمز",
      b: "رابط واحد يجمع الجميع — كل لاعب يدخل من متصفح هاتفه.",
    },
    {
      t: "السيّد يلمّح بكلمة واحدة",
      b: "سيّدا التجسس وحدهما يريان المفتاح، وكل منهما يعطي تلميحًا: كلمة ورقم.",
    },
    {
      t: "الفريق يكشف البطاقات",
      b: "خمّنوا كلمات فريقكم وتجنّبوا المارّة… ولا تلمسوا القاتل أبدًا.",
    },
  ],
  featTitle: "صُنعت للعب العائلي",
  feats: [
    { k: "noapp", t: "بدون تطبيق", b: "تعمل في المتصفح على أي هاتف." },
    { k: "free", t: "مجانية", b: "بدون حسابات وبدون إعلانات." },
    { k: "bi", t: "عربي وإنجليزي", b: "لوحة الكلمات والواجهة باللغتين." },
    {
      k: "cb",
      t: "تُقرأ بدون ألوان",
      b: "لكل فريق شكل مميز — واضحة لعمى الألوان وتحت الشمس.",
    },
  ],
  screensTitle: "من داخل اللعبة",
  screens: ["الردهة — الفرق والأدوار", "أثناء اللعب — شاشة اللاعب"],
  ctaTitle: "جاهزون؟",
  ctaSub: "غرفة جديدة في ثوانٍ — بدون تسجيل.",
  credit: "لعبة عائلية صُنعت بحب",
  clue: "التلميح",
  clueWord: "ماء",
  install: "تثبيت التطبيق",
  nav: "التنقل الرئيسي",
  langGroup: "لغة الصفحة",
  lobby: {
    title: "اسم الرمز",
    subtitle: "غرفة العائلة",
    online: "٥ متصلون",
    codeLabel: "رمز الغرفة",
    copy: "نسخ",
    copied: "تم النسخ",
    shareHint: "شارك الرمز لينضمّ اللاعبون من أجهزتهم.",
    boardLangLabel: "لغة اللوح",
    boardLangAr: "العربية",
    boardLangEn: "English",
    boardLangGroup: "لغة اللوح",
    spymasterLabel: "سيّد التجسس",
    you: "أنت",
    start: "ابدأ اللعب",
    red: {
      title: "الفريق الأحمر",
      spymaster: "سارة",
      operatives: [{ name: "خالد", you: true }, { name: "ريم" }],
      join: "+ انضمّ كعميل",
    },
    blue: {
      title: "الفريق الأزرق",
      spymaster: "عمر",
      operatives: [{ name: "نورا" }, { name: "يوسف" }],
      join: "+ انضمّ كعميل",
    },
  },
  board: {
    nowPlaying: "الدور الآن",
    turn: "دور الأحمر",
    endTurn: "إنهاء الدور",
  },
};

const en: LandingStrings = {
  tag: "A word-spy party game for the family",
  h1Before: "One clue.",
  h1Highlight: "25 words.",
  h1After: "Two teams.",
  sub: "Gather the family: the spymaster gives a one-word clue, your team reveals the right tiles — and everyone avoids the assassin.",
  play: "Create a room",
  how: "How to play",
  tryMe: "Try it — tap the tiles",
  reset: "Reset tiles",
  howTitle: "How to play",
  steps: [
    {
      t: "Create a room, share the code",
      b: "One link brings everyone in — each player joins from their phone’s browser.",
    },
    {
      t: "The spymaster gives one word",
      b: "Only the spymasters see the key; each gives a clue: one word plus a number.",
    },
    {
      t: "Your team flips the tiles",
      b: "Guess your team’s words, dodge the bystanders… and never touch the assassin.",
    },
  ],
  featTitle: "Made for family play",
  feats: [
    { k: "noapp", t: "No app", b: "Runs in the browser on any phone." },
    { k: "free", t: "Free", b: "No accounts, no ads." },
    {
      k: "bi",
      t: "Arabic & English",
      b: "Board and interface ship in both languages.",
    },
    {
      k: "cb",
      t: "Reads without colour",
      b: "Every team has its own glyph — clear for colour-blind players and in sunlight.",
    },
  ],
  screensTitle: "Inside the game",
  screens: ["Lobby — teams & roles", "In-game — operative view"],
  ctaTitle: "Ready?",
  ctaSub: "A fresh room in seconds — no sign-up.",
  credit: "A family game, made with love",
  clue: "CLUE",
  clueWord: "WATER",
  install: "Install the app",
  nav: "Main navigation",
  langGroup: "Page language",
  lobby: {
    title: "Codename",
    subtitle: "Family room",
    online: "5 online",
    codeLabel: "ROOM CODE",
    copy: "Copy",
    copied: "Copied",
    shareHint: "Share the code so players can join from their own phones.",
    boardLangLabel: "BOARD LANGUAGE",
    boardLangAr: "العربية",
    boardLangEn: "English",
    boardLangGroup: "Board language",
    spymasterLabel: "SPYMASTER",
    you: "you",
    start: "Start game",
    red: {
      title: "Red team",
      spymaster: "Sara",
      operatives: [{ name: "Khaled", you: true }, { name: "Reem" }],
      join: "+ Join as operative",
    },
    blue: {
      title: "Blue team",
      spymaster: "Omar",
      operatives: [{ name: "Noura" }, { name: "Yousef" }],
      join: "+ Join as operative",
    },
  },
  board: {
    nowPlaying: "NOW PLAYING",
    turn: "Red's turn",
    endTurn: "End turn",
  },
};

export const STR: Record<Lang, LandingStrings> = { ar, en };

/** The room code shown in every preview surface. */
export const DEMO_ROOM_CODE = "QMR-72K";
