import type { PartnerCardKind, PartnerMissionPhase } from "./types";

export interface PartnerMissionMessages {
  partnerMission: string;
  createHint: string;
  missionLead: string;
  fieldAgent: string;
  target: string;
  decoy: string;
  trap: string;
  targetCount: string;
  fieldAgentSeat: string;
  seatOpen: string;
  agentInvite: string;
  copyAgentInvite: string;
  inviteCopied: string;
  copyAgentBriefing: string;
  briefingCopied: string;
  whatAgentSees: string;
  publicWords: string;
  revealedResults: string;
  currentSignal: string;
  secretMap: string;
  unrevealedClassifications: string;
  activity: string;
  waitingForPartner: string;
  joined: (name: string) => string;
  waitingForSignal: (name: string) => string;
  signalTransmitted: string;
  guessesLocked: (name: string, count: number) => string;
  revealingGuesses: (name: string) => string;
  waitingForNextSignal: (name: string) => string;
  missionComplete: string;
  trapRevealed: string;
  targetsRemaining: string;
  signal: string;
  noSignal: string;
  signalWord: string;
  guessCount: string;
  sendSignal: string;
  orderedGuesses: string;
  noGuesses: string;
  guessOrder: (order: number) => string;
  revealCountdown: (seconds: number) => string;
  revealProgress: (current: number, total: number) => string;
  revealNow: string;
  previousTurn: string;
  noCardsRevealed: string;
  fieldNote: string;
  newMission: string;
  missionMap: string;
  publicMissionBoard: string;
  webMcpReady: string;
  toolsAvailable: (count: number) => string;
  webMcpChecking: string;
  webMcpUnavailable: string;
  webMcpError: string;
  webMcpRequired: string;
  retry: string;
  chooseNamePrompt: string;
  waitingForAgentTool: string;
  lockedWatchReveal: string;
  resultLabel: (kind: PartnerCardKind) => string;
  phaseLabel: (phase: PartnerMissionPhase) => string;
}

const en: PartnerMissionMessages = {
  partnerMission: "AI Partner Mission",
  createHint: "You will be Mission Lead and invite one private AI Field Agent.",
  missionLead: "Mission Lead",
  fieldAgent: "Field Agent",
  target: "Target",
  decoy: "Decoy",
  trap: "Trap",
  targetCount: "Targets remaining",
  fieldAgentSeat: "Field Agent seat",
  seatOpen: "Waiting for your AI partner…",
  agentInvite: "Field Agent invitation",
  copyAgentInvite: "Copy agent invitation",
  inviteCopied: "Invitation copied",
  copyAgentBriefing: "Copy agent briefing",
  briefingCopied: "Briefing copied",
  whatAgentSees: "What your Field Agent can see",
  publicWords: "public words",
  revealedResults: "revealed card results",
  currentSignal: "current Signal and count",
  secretMap: "secret mission map",
  unrevealedClassifications: "unrevealed classifications",
  activity: "Mission activity",
  waitingForPartner: "Waiting for your AI partner…",
  joined: (name) => `${name} joined the mission`,
  waitingForSignal: (name) => `${name} is waiting for your Signal`,
  signalTransmitted: "Signal transmitted",
  guessesLocked: (name, count) => `${name} locked ${count} guesses`,
  revealingGuesses: (name) => `Revealing ${name}'s guesses…`,
  waitingForNextSignal: (name) => `${name} is waiting for your next Signal`,
  missionComplete: "Mission complete",
  trapRevealed: "Trap revealed",
  targetsRemaining: "Targets remaining",
  signal: "Signal",
  noSignal: "No Signal active",
  signalWord: "One-word Signal",
  guessCount: "Target count",
  sendSignal: "Transmit Signal",
  orderedGuesses: "Locked guess order",
  noGuesses: "No guesses locked",
  guessOrder: (order) => `Guess ${order}`,
  revealCountdown: (seconds) => `Reveal begins in ${seconds}`,
  revealProgress: (current, total) => `Revealing ${current} of ${total}`,
  revealNow: "Reveal now",
  previousTurn: "Previous turn",
  noCardsRevealed: "No cards were revealed.",
  fieldNote: "Field note",
  newMission: "New mission",
  missionMap: "Secret mission map",
  publicMissionBoard: "Public mission board",
  webMcpReady: "WebMCP ready",
  toolsAvailable: (count) =>
    `${count} mission ${count === 1 ? "tool" : "tools"} available`,
  webMcpChecking: "Checking WebMCP…",
  webMcpUnavailable: "WebMCP unavailable",
  webMcpError: "WebMCP tools could not be registered",
  webMcpRequired:
    "The AI Field Agent requires a WebMCP-capable client. The rest of Spy Mission still works without WebMCP.",
  retry: "Try again",
  chooseNamePrompt: "Your AI Field Agent chooses its own call sign.",
  waitingForAgentTool: "Waiting for the Field Agent to use choose_name…",
  lockedWatchReveal: "Your guesses are locked. Watch the mission reveal.",
  resultLabel: (kind) =>
    ({ target: "Target", decoy: "Decoy", trap: "Trap" })[kind],
  phaseLabel: (phase) =>
    ({
      waiting_for_agent: "Waiting for Field Agent",
      waiting_for_signal: "Waiting for Signal",
      field_agent_turn: "Field Agent turn",
      locked: "Guesses locked",
      won: "Mission won",
      lost: "Mission lost",
    })[phase],
};

const ar: PartnerMissionMessages = {
  partnerMission: "مهمة الشريك الذكي",
  createHint: "ستكون قائد المهمة وتدعو عميلاً ميدانياً ذكياً خاصاً.",
  missionLead: "قائد المهمة",
  fieldAgent: "العميل الميداني",
  target: "هدف",
  decoy: "تمويه",
  trap: "فخ",
  targetCount: "الأهداف المتبقية",
  fieldAgentSeat: "مقعد العميل الميداني",
  seatOpen: "بانتظار شريكك الذكي…",
  agentInvite: "دعوة العميل الميداني",
  copyAgentInvite: "نسخ دعوة العميل",
  inviteCopied: "تم نسخ الدعوة",
  copyAgentBriefing: "نسخ موجز العميل",
  briefingCopied: "تم نسخ الموجز",
  whatAgentSees: "ما يستطيع العميل الميداني رؤيته",
  publicWords: "الكلمات العامة",
  revealedResults: "نتائج البطاقات المكشوفة",
  currentSignal: "الإشارة الحالية والعدد",
  secretMap: "خريطة المهمة السرية",
  unrevealedClassifications: "تصنيفات البطاقات غير المكشوفة",
  activity: "نشاط المهمة",
  waitingForPartner: "بانتظار شريكك الذكي…",
  joined: (name) => `انضم ${name} إلى المهمة`,
  waitingForSignal: (name) => `${name} بانتظار إشارتك`,
  signalTransmitted: "تم إرسال الإشارة",
  guessesLocked: (name, count) => `ثبّت ${name} ${count} تخمينات`,
  revealingGuesses: (name) => `جارٍ كشف تخمينات ${name}…`,
  waitingForNextSignal: (name) => `${name} بانتظار إشارتك التالية`,
  missionComplete: "اكتملت المهمة",
  trapRevealed: "تم كشف الفخ",
  targetsRemaining: "الأهداف المتبقية",
  signal: "الإشارة",
  noSignal: "لا توجد إشارة نشطة",
  signalWord: "إشارة من كلمة واحدة",
  guessCount: "عدد الأهداف",
  sendSignal: "إرسال الإشارة",
  orderedGuesses: "ترتيب التخمينات المثبّتة",
  noGuesses: "لا توجد تخمينات مثبّتة",
  guessOrder: (order) => `التخمين ${order}`,
  revealCountdown: (seconds) => `يبدأ الكشف خلال ${seconds}`,
  revealProgress: (current, total) => `كشف ${current} من ${total}`,
  revealNow: "اكشف الآن",
  previousTurn: "الدور السابق",
  noCardsRevealed: "لم تُكشف أي بطاقة.",
  fieldNote: "ملاحظة ميدانية",
  newMission: "مهمة جديدة",
  missionMap: "خريطة المهمة السرية",
  publicMissionBoard: "لوحة المهمة العامة",
  webMcpReady: "WebMCP جاهز",
  toolsAvailable: (count) => `${count} من أدوات المهمة متاحة`,
  webMcpChecking: "جارٍ التحقق من WebMCP…",
  webMcpUnavailable: "WebMCP غير متاح",
  webMcpError: "تعذّر تسجيل أدوات WebMCP",
  webMcpRequired:
    "يتطلب العميل الميداني الذكي متصفحًا يدعم WebMCP. تبقى بقية Spy Mission قابلة للاستخدام بدونه.",
  retry: "حاول مجددًا",
  chooseNamePrompt: "يختار العميل الميداني الذكي اسم النداء الخاص به.",
  waitingForAgentTool: "بانتظار استخدام العميل الميداني لأداة choose_name…",
  lockedWatchReveal: "تم تثبيت تخميناتك. تابع كشف المهمة.",
  resultLabel: (kind) => ({ target: "هدف", decoy: "تمويه", trap: "فخ" })[kind],
  phaseLabel: (phase) =>
    ({
      waiting_for_agent: "بانتظار العميل الميداني",
      waiting_for_signal: "بانتظار الإشارة",
      field_agent_turn: "دور العميل الميداني",
      locked: "تم تثبيت التخمينات",
      won: "نجحت المهمة",
      lost: "فشلت المهمة",
    })[phase],
};

export const PARTNER_MESSAGES: Readonly<
  Record<"en" | "ar", PartnerMissionMessages>
> = { en, ar };
