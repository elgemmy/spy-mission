import type { UiLocale } from "../../locale/uiLocale";

export const HINT_MESSAGES = {
  en: {
    title: "Clue heatmap",
    request: "Use team hint",
    loading: "Reading the clue…",
    show: "Show heatmap",
    hide: "Hide heatmap",
    available: "One hint per team, per game. It lasts for this turn.",
    waiting: "Available when your team has an active clue.",
    used: "Your team has used its hint for this game.",
    explanation: "Clue relevance, not the chance of a safe guess.",
    low: "Low",
    high: "High",
    failed: "Couldn't load the hint. Please try again.",
    notConfigured:
      "Hints aren't configured yet. Your team's hint is still available.",
    unavailable: "This hint is no longer available. Check the current turn.",
    score: (value: string) => `${value} clue relevance`,
  },
  ar: {
    title: "خريطة ارتباط الكلمات",
    request: "استخدم مساعدة الفريق",
    loading: "جارٍ تحليل التلميح…",
    show: "إظهار الخريطة",
    hide: "إخفاء الخريطة",
    available: "مساعدة واحدة لكل فريق في اللعبة، وتستمر لهذا الدور فقط.",
    waiting: "متاحة عندما يكون لفريقك تلميح في دوره.",
    used: "استخدم فريقك المساعدة المتاحة لهذه اللعبة.",
    explanation: "الارتباط بالتلميح، وليس احتمال التخمين الآمن.",
    low: "ضعيف",
    high: "قوي",
    failed: "تعذّر تحميل المساعدة. حاول مرة أخرى.",
    notConfigured: "المساعدة غير مفعّلة بعد. لم تُستخدم مساعدة فريقك.",
    unavailable: "هذه المساعدة لم تعد متاحة. تحقّق من الدور الحالي.",
    score: (value: string) => `نسبة الارتباط بالتلميح ${value}`,
  },
} satisfies Record<UiLocale, object>;

export function formatHintScore(score: number, locale: UiLocale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(score);
}
