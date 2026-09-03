import type { Role, Team } from "../engine";
import type { UiLocale } from "./uiLocale";

export const PRODUCT_NAME = "Spy Mission";
export const CREDIT_NAME = "Ahmed Gamal — elgemmy";

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

export interface LandingMessages {
  productName: string;
  tag: string;
  h1Before: string;
  h1Highlight: string;
  h1After: string;
  sub: string;
  play: string;
  join: string;
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

export interface PlayMessages {
  productName: string;
  documentTitle: string;
  subtitle: string;
  createRoom: string;
  joinByCode: string;
  installApp: string;
  openingRoom: string;
  retry: string;
  back: string;
  continue: string;
  chooseName: string;
  nameCreateHint: string;
  nameJoinHint: (code: string) => string;
  nameLabel: string;
  namePlaceholder: string;
  createSubmit: string;
  createPending: string;
  joinSubmit: string;
  joinPending: string;
  roomCodeLabel: string;
  roomCodePlaceholder: string;
  credit: string;
  playerBar: string;
  rename: string;
  renameTitle: string;
  newNameLabel: string;
  save: string;
  cancel: string;
  exitScreen: string;
  inRoom: (count: number) => string;
  hostBadge: string;
  playerBadge: string;
  roomCodeEyebrow: string;
  copyLink: string;
  copied: string;
  publicRoomHint: string;
  privateRoomHint: string;
  inviteUnavailable: string;
  interfaceLanguage: string;
  boardLanguage: string;
  boardLanguageAr: string;
  boardLanguageEn: string;
  publicVisibility: string;
  privateVisibility: string;
  teams: string;
  roomVisibility: string;
  missionLead: string;
  fieldAgent: string;
  joinMissionLead: string;
  joinFieldAgent: string;
  hostSuffix: string;
  makeHost: string;
  ban: string;
  startRound: string;
  deleteRoom: string;
  leaveRoom: string;
  startNeedHost: string;
  startNeedSeats: string;
  missingSeat: (team: string, role: string) => string;
  teamRed: string;
  teamBlue: string;
  giveSignal: string;
  yourTeamTurn: string;
  waitTeamTurn: string;
  signalText: string;
  guessCount: string;
  send: string;
  signal: string;
  waitingSignal: string;
  endTurn: string;
  lobby: string;
  newBoard: string;
  hostControls: string;
  trap: string;
  roundOver: string;
  nowPlaying: string;
  teamLost: (team: string) => string;
  teamWon: (team: string) => string;
  teamTurn: (team: string) => string;
  winnerLine: (team: string) => string;
  signalLog: string;
  signalLogItem: (team: string, word: string) => string;
  teamLists: string;
  wordBoard: string;
  revealCard: string;
  turnStatus: string;
  playerFallback: string;
  confirmStartTitle: string;
  confirmStartBody: string;
  confirmStartAction: string;
  confirmRegenTitle: string;
  confirmRegenBody: string;
  confirmRegenAction: string;
  confirmLobbyTitle: string;
  confirmLobbyBody: string;
  confirmLobbyAction: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirmDeleteAction: string;
  confirmHostTitle: string;
  confirmHostBody: (name: string) => string;
  confirmHostAction: string;
  confirmBanTitle: string;
  confirmBanBody: (name: string) => string;
  confirmBanAction: string;
  confirmExitTitle: string;
  confirmExitBody: string;
  confirmExitAction: string;
  confirmLeaveTitle: string;
  confirmLeaveBody: string;
  confirmLeaveAction: string;
  unexpectedError: string;
  unknownError: string;
  errors: Record<string, string>;
  installTitle: string;
  installAlready: string;
  installNow: string;
  installClose: string;
  installBody: string;
  installLaterHint: string;
  installIos: string;
  installAndroid: string;
  installDesktop: string;
  updateReady: string;
  updateNow: string;
  updateLater: string;
}

export interface Messages {
  landing: LandingMessages;
  play: PlayMessages;
}

const landingAr: LandingMessages = {
  productName: PRODUCT_NAME,
  tag: "لعبة كلمات وجواسيس للعائلة",
  h1Before: "إشارة واحدة.",
  h1Highlight: "٢٥ كلمة.",
  h1After: "فريقان.",
  sub: "اجمع العائلة: قائد المهمة يعطي إشارة من كلمة واحدة، وفريقك يكشف البطاقات الصحيحة — واحذروا الفخ.",
  play: "أنشئ غرفة",
  join: "انضم للعبة",
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
      t: "قائد المهمة يلمّح بكلمة واحدة",
      b: "قائدا المهمة وحدهما يريان المفتاح، وكل منهما يعطي إشارة: كلمة ورقم.",
    },
    {
      t: "الفريق يكشف البطاقات",
      b: "خمّنوا كلمات فريقكم وتجنّبوا المارّة… ولا تلمسوا الفخ أبدًا.",
    },
  ],
  featTitle: "صُنعت للعب العائلي",
  feats: [
    { k: "noapp", t: "بدون تطبيق", b: "تعمل في المتصفح على أي هاتف." },
    { k: "free", t: "مجانية", b: "بدون حسابات وبدون إعلانات." },
    {
      k: "bi",
      t: "عربي وإنجليزي",
      b: "اختر لغة الواجهة. المضيف يختار لغة لوحة الكلمات.",
    },
    {
      k: "cb",
      t: "تُقرأ بدون ألوان",
      b: "لكل فريق شكل مميز — واضحة لعمى الألوان وتحت الشمس.",
    },
  ],
  screensTitle: "من داخل اللعبة",
  screens: ["الردهة — الفرق والأدوار", "أثناء اللعب — شاشة العميل الميداني"],
  ctaTitle: "جاهزون؟",
  ctaSub: "غرفة جديدة في ثوانٍ — بدون تسجيل.",
  credit: CREDIT_NAME,
  clue: "الإشارة",
  clueWord: "ماء",
  install: "تثبيت التطبيق",
  nav: "التنقل الرئيسي",
  langGroup: "لغة الواجهة",
  lobby: {
    title: PRODUCT_NAME,
    subtitle: "غرفة العائلة",
    online: "٥ متصلون",
    codeLabel: "رمز الغرفة",
    copy: "نسخ",
    copied: "تم النسخ",
    shareHint: "شارك الرمز لينضمّ اللاعبون من أجهزتهم.",
    boardLangLabel: "لغة اللوحة",
    boardLangAr: "العربية",
    boardLangEn: "English",
    boardLangGroup: "لغة اللوحة",
    spymasterLabel: "قائد المهمة",
    you: "أنت",
    start: "ابدأ اللعب",
    red: {
      title: "الفريق الأحمر",
      spymaster: "سارة",
      operatives: [{ name: "خالد", you: true }, { name: "ريم" }],
      join: "+ انضم كعميل ميداني",
    },
    blue: {
      title: "الفريق الأزرق",
      spymaster: "عمر",
      operatives: [{ name: "نورا" }, { name: "يوسف" }],
      join: "+ انضم كعميل ميداني",
    },
  },
  board: {
    nowPlaying: "الدور الآن",
    turn: "دور الأحمر",
    endTurn: "إنهاء الدور",
  },
};

const landingEn: LandingMessages = {
  productName: PRODUCT_NAME,
  tag: "A word-spy party game for the family",
  h1Before: "One signal.",
  h1Highlight: "25 words.",
  h1After: "Two teams.",
  sub: "Gather the family: the Mission Lead gives a one-word signal, your team reveals the right tiles — and everyone avoids the trap.",
  play: "Create a room",
  join: "Join game",
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
      t: "The Mission Lead gives one word",
      b: "Only the Mission Leads see the key; each gives a signal: one word plus a number.",
    },
    {
      t: "Your team flips the tiles",
      b: "Guess your team’s words, dodge the bystanders… and never touch the trap.",
    },
  ],
  featTitle: "Made for family play",
  feats: [
    { k: "noapp", t: "No app", b: "Runs in the browser on any phone." },
    { k: "free", t: "Free", b: "No accounts, no ads." },
    {
      k: "bi",
      t: "English & Arabic",
      b: "Choose your interface language. The host picks the board language.",
    },
    {
      k: "cb",
      t: "Reads without colour",
      b: "Every team has its own glyph — clear for colour-blind players and in sunlight.",
    },
  ],
  screensTitle: "Inside the game",
  screens: ["Lobby — teams & roles", "In-game — Field Agent view"],
  ctaTitle: "Ready?",
  ctaSub: "A fresh room in seconds — no sign-up.",
  credit: CREDIT_NAME,
  clue: "SIGNAL",
  clueWord: "WATER",
  install: "Install the app",
  nav: "Main navigation",
  langGroup: "Interface language",
  lobby: {
    title: PRODUCT_NAME,
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
    spymasterLabel: "MISSION LEAD",
    you: "you",
    start: "Start game",
    red: {
      title: "Red team",
      spymaster: "Sara",
      operatives: [{ name: "Khaled", you: true }, { name: "Reem" }],
      join: "+ Join as Field Agent",
    },
    blue: {
      title: "Blue team",
      spymaster: "Omar",
      operatives: [{ name: "Noura" }, { name: "Yousef" }],
      join: "+ Join as Field Agent",
    },
  },
  board: {
    nowPlaying: "NOW PLAYING",
    turn: "Red's turn",
    endTurn: "End turn",
  },
};

const playAr: PlayMessages = {
  productName: PRODUCT_NAME,
  documentTitle: PRODUCT_NAME,
  subtitle: "لعبة كلمات وجواسيس للعائلة",
  createRoom: "إنشاء غرفة جديدة",
  joinByCode: "الانضمام برمز",
  installApp: "تثبيت التطبيق",
  openingRoom: "جار فتح الغرفة…",
  retry: "متابعة",
  back: "رجوع",
  continue: "متابعة",
  chooseName: "اختر اسمك",
  nameCreateHint: "سيظهر هذا الاسم في الغرفة.",
  nameJoinHint: (code) => `الغرفة ${code}`,
  nameLabel: "اسمك",
  namePlaceholder: "اسمك",
  createSubmit: "إنشاء الغرفة",
  createPending: "جار إنشاء الغرفة…",
  joinSubmit: "الدخول للغرفة",
  joinPending: "جار الدخول…",
  roomCodeLabel: "رمز الغرفة",
  roomCodePlaceholder: "ROOM CODE",
  credit: CREDIT_NAME,
  playerBar: "بيانات اللاعب",
  rename: "تغيير الاسم",
  renameTitle: "تغيير الاسم",
  newNameLabel: "الاسم الجديد",
  save: "حفظ",
  cancel: "إلغاء",
  exitScreen: "الخروج من هذه الشاشة",
  inRoom: (count) => `${count} في الغرفة`,
  hostBadge: "المضيف",
  playerBadge: "لاعب",
  roomCodeEyebrow: "رمز الغرفة",
  copyLink: "نسخ الرابط",
  copied: "تم النسخ",
  publicRoomHint: "غرفة عامة بالرابط",
  privateRoomHint: "غرفة خاصة",
  inviteUnavailable: "رابط الدعوة الخاص غير متاح في هذا المتصفح.",
  interfaceLanguage: "لغة الواجهة",
  boardLanguage: "لغة اللوحة",
  boardLanguageAr: "العربية",
  boardLanguageEn: "English",
  publicVisibility: "عامة",
  privateVisibility: "خاصة",
  teams: "الفرق",
  roomVisibility: "ظهور الغرفة",
  missionLead: "قائد المهمة",
  fieldAgent: "عميل ميداني",
  joinMissionLead: "انضم كقائد مهمة",
  joinFieldAgent: "انضم كعميل ميداني",
  hostSuffix: " · مضيف",
  makeHost: "جعله المضيف",
  ban: "حظر",
  startRound: "بدء الجولة",
  deleteRoom: "حذف الغرفة",
  leaveRoom: "مغادرة الغرفة نهائيا",
  startNeedHost: "بدء الجولة متاح لمضيف الغرفة فقط.",
  startNeedSeats: "كل فريق يحتاج قائد مهمة وعميلا ميدانيا.",
  missingSeat: (team, role) => `${team}: ${role}`,
  teamRed: "الأحمر",
  teamBlue: "الأزرق",
  giveSignal: "أعط إشارة",
  yourTeamTurn: "دور فريقك",
  waitTeamTurn: "انتظر دور فريقك",
  signalText: "نص الإشارة",
  guessCount: "عدد التخمينات",
  send: "إرسال",
  signal: "الإشارة",
  waitingSignal: "بانتظار الإشارة",
  endTurn: "إنهاء الدور",
  lobby: "الردهة",
  newBoard: "لوحة جديدة",
  hostControls: "إدارة الجولة",
  trap: "الفخ",
  roundOver: "انتهت الجولة",
  nowPlaying: "الدور الآن",
  teamLost: (team) => `${team} خسر`,
  teamWon: (team) => `${team} فاز`,
  teamTurn: (team) => `دور ${team}`,
  winnerLine: (team) => `فاز الفريق ${team}`,
  signalLog: "سجل الإشارات",
  signalLogItem: (team, word) => `${team} · ${word}`,
  teamLists: "قوائم الفرق",
  wordBoard: "لوحة الكلمات",
  revealCard: "كشف البطاقة",
  turnStatus: "حالة الدور",
  playerFallback: "اللاعب",
  confirmStartTitle: "بدء الجولة؟",
  confirmStartBody: "سيتم تثبيت الفرق وفتح لوحة جديدة.",
  confirmStartAction: "بدء",
  confirmRegenTitle: "لوحة جديدة؟",
  confirmRegenBody: "سيتم استبدال اللوحة الحالية وتصفير الإشارات والتصويتات.",
  confirmRegenAction: "تجديد",
  confirmLobbyTitle: "العودة للردهة؟",
  confirmLobbyBody: "ستنتهي الجولة الحالية وسيعود اللاعبون لاختيار الفرق.",
  confirmLobbyAction: "عودة",
  confirmDeleteTitle: "حذف الغرفة؟",
  confirmDeleteBody: "سيتم حذف الغرفة وإخراج اللاعبين منها.",
  confirmDeleteAction: "حذف",
  confirmHostTitle: "نقل الاستضافة؟",
  confirmHostBody: (name) => `سيصبح ${name} مضيف الغرفة.`,
  confirmHostAction: "نقل",
  confirmBanTitle: "حظر اللاعب؟",
  confirmBanBody: (name) => `سيتم إخراج ${name} ومنعه من العودة بهذه الهوية.`,
  confirmBanAction: "حظر",
  confirmExitTitle: "العودة للرئيسية؟",
  confirmExitBody: "ستغادر هذه الشاشة فقط، وستبقى عضوا في الغرفة.",
  confirmExitAction: "خروج",
  confirmLeaveTitle: "مغادرة الغرفة نهائيا؟",
  confirmLeaveBody:
    "سيتم حذف مقعدك من الغرفة. يمكنك الانضمام من جديد ما دامت الغرفة مفتوحة.",
  confirmLeaveAction: "مغادرة",
  unexpectedError: "حدث خطأ غير متوقع.",
  unknownError: "حدث خطأ.",
  errors: {
    WRONG_PHASE: "هذه الحركة غير متاحة الآن.",
    NOT_YOUR_TURN: "ليس دور فريقك.",
    WRONG_ROLE: "هذا الدور لا يملك هذا الخيار.",
    NOT_A_PLAYER: "انضم للغرفة أولا.",
    ALREADY_JOINED: "أنت موجود في الغرفة.",
    CARD_ALREADY_REVEALED: "هذه البطاقة مكشوفة.",
    CARD_OUT_OF_RANGE: "البطاقة غير موجودة.",
    INVALID_CLUE: "الإشارة لا يمكن أن تكون فارغة وتحتاج رقما صحيحا.",
    MUST_GUESS_ONCE: "يجب كشف بطاقة واحدة قبل إنهاء الدور.",
    LANG_LOCKED: "تغيير لغة اللوحة متاح في الردهة فقط.",
    ALREADY_STARTED: "الجولة بدأت بالفعل.",
    NOT_ENOUGH_PLAYERS: "كل فريق يحتاج قائد مهمة وعميلا ميدانيا.",
    BAD_DEAL: "قائمة الكلمات غير كافية.",
    NOT_HOST: "هذا الخيار لمضيف الغرفة فقط.",
    ROOM_PRIVATE: "هذه الغرفة خاصة.",
    PLAYER_NOT_FOUND: "اللاعب غير موجود.",
    HOST_REMOVE_FORBIDDEN: "انقل الاستضافة قبل حذف المضيف.",
    INVALID_NAME: "اكتب اسما صالحا.",
    ROOM_NOT_FOUND: "لم يتم العثور على الغرفة أو لم تعد عضوا فيها.",
    ROOM_INVITE_INVALID: "رابط الدعوة غير صالح.",
    ROOM_INVITE_UNAVAILABLE: "رابط الدعوة الخاص غير متاح في هذا المتصفح.",
    ROOM_FULL: "الغرفة ممتلئة.",
    ROOM_BANNED: "تم حظر هذه الهوية من الغرفة.",
    ROOM_ACCESS_REVOKED: "لم تعد عضوا في الغرفة.",
    ROOM_MEMBERSHIP_INVALID: "تعذر التحقق من عضوية الغرفة.",
    HOST_LEAVE_FORBIDDEN: "انقل الاستضافة أو احذف الغرفة أولا.",
    LEAVE_LOBBY_ONLY: "المغادرة النهائية متاحة في الردهة فقط.",
    ANONYMOUS_AUTH_DISABLED: "تعذر بدء الجلسة الآن. حاول مرة أخرى بعد قليل.",
    ROOM_SESSION_EXPIRED: "انتهت جلسة اللاعب. ادخل إلى الغرفة من جديد.",
    ROOM_API_ERROR: "تعذر تنفيذ الطلب. حاول مرة أخرى.",
    SUPABASE_ENV_MISSING: "خدمة الغرف غير متاحة الآن. حاول لاحقا.",
    ROOM_VERSION_CONFLICT: "تغيرت الغرفة للتو. أعد المحاولة.",
    NETWORK_ERROR:
      "تعذر الاتصال بخادم الغرف. تحقق من اتصال الإنترنت وحاول مرة أخرى.",
  },
  installTitle: "ثبّت اللعبة على جهازك",
  installAlready: "التطبيق مثبّت بالفعل ✓",
  installNow: "تثبيت الآن",
  installClose: "إغلاق",
  installBody: "تعمل اللعبة كتطبيق بلا متجر: تفتح بلمسة واحدة وتعمل بسرعة.",
  installLaterHint: "يمكنك التثبيت لاحقا من هذه القائمة.",
  installIos:
    "افتح قائمة المشاركة في Safari ثم اختر «إضافة إلى الشاشة الرئيسية»",
  installAndroid:
    "من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»",
  installDesktop: `اضغط أيقونة التثبيت في شريط العنوان، أو من قائمة المتصفح اختر «تثبيت ${PRODUCT_NAME}»`,
  updateReady: "يتوفر تحديث جديد للعبة",
  updateNow: "تحديث",
  updateLater: "لاحقًا",
};

const playEn: PlayMessages = {
  productName: PRODUCT_NAME,
  documentTitle: PRODUCT_NAME,
  subtitle: "A word-spy party game for the family",
  createRoom: "Create a new room",
  joinByCode: "Join with a code",
  installApp: "Install the app",
  openingRoom: "Opening the room…",
  retry: "Try again",
  back: "Back",
  continue: "Continue",
  chooseName: "Choose your name",
  nameCreateHint: "This name will appear in the room.",
  nameJoinHint: (code) => `Room ${code}`,
  nameLabel: "Your name",
  namePlaceholder: "Your name",
  createSubmit: "Create room",
  createPending: "Creating room…",
  joinSubmit: "Join room",
  joinPending: "Joining…",
  roomCodeLabel: "Room code",
  roomCodePlaceholder: "ROOM CODE",
  credit: CREDIT_NAME,
  playerBar: "Player details",
  rename: "Rename",
  renameTitle: "Rename",
  newNameLabel: "New name",
  save: "Save",
  cancel: "Cancel",
  exitScreen: "Exit this screen",
  inRoom: (count) => `${count} in the room`,
  hostBadge: "Room Host",
  playerBadge: "Player",
  roomCodeEyebrow: "ROOM CODE",
  copyLink: "Copy link",
  copied: "Copied",
  publicRoomHint: "Public room via link",
  privateRoomHint: "Private room",
  inviteUnavailable: "The private invite link is not available in this browser.",
  interfaceLanguage: "Interface language",
  boardLanguage: "Board language",
  boardLanguageAr: "العربية",
  boardLanguageEn: "English",
  publicVisibility: "Public",
  privateVisibility: "Private",
  teams: "Teams",
  roomVisibility: "Room visibility",
  missionLead: "Mission Lead",
  fieldAgent: "Field Agent",
  joinMissionLead: "Join as Mission Lead",
  joinFieldAgent: "Join as Field Agent",
  hostSuffix: " · Host",
  makeHost: "Make host",
  ban: "Ban",
  startRound: "Start round",
  deleteRoom: "Delete room",
  leaveRoom: "Leave room permanently",
  startNeedHost: "Only the room host can start.",
  startNeedSeats:
    "Each team needs one Mission Lead and one Field Agent.",
  missingSeat: (team, role) => `${team}: ${role}`,
  teamRed: "Red",
  teamBlue: "Blue",
  giveSignal: "Give a signal",
  yourTeamTurn: "Your team's turn",
  waitTeamTurn: "Wait for your team's turn",
  signalText: "Signal text",
  guessCount: "Guess count",
  send: "Send",
  signal: "SIGNAL",
  waitingSignal: "Waiting for a signal",
  endTurn: "End turn",
  lobby: "Lobby",
  newBoard: "New board",
  hostControls: "Round controls",
  trap: "Trap",
  roundOver: "Round over",
  nowPlaying: "Now playing",
  teamLost: (team) => `${team} lost`,
  teamWon: (team) => `${team} won`,
  teamTurn: (team) => `${team}'s turn`,
  winnerLine: (team) => `${team} team won`,
  signalLog: "Signal log",
  signalLogItem: (team, word) => `${team} · ${word}`,
  teamLists: "Team rosters",
  wordBoard: "Word board",
  revealCard: "Reveal card",
  turnStatus: "Turn status",
  playerFallback: "the player",
  confirmStartTitle: "Start the round?",
  confirmStartBody: "Teams will lock and a new board will open.",
  confirmStartAction: "Start",
  confirmRegenTitle: "New board?",
  confirmRegenBody:
    "This replaces the current board and clears signals and votes.",
  confirmRegenAction: "Deal again",
  confirmLobbyTitle: "Return to the lobby?",
  confirmLobbyBody: "This round will end and players can pick teams again.",
  confirmLobbyAction: "Return",
  confirmDeleteTitle: "Delete the room?",
  confirmDeleteBody: "The room will be deleted and players will be removed.",
  confirmDeleteAction: "Delete",
  confirmHostTitle: "Transfer host?",
  confirmHostBody: (name) => `${name} will become the room host.`,
  confirmHostAction: "Transfer",
  confirmBanTitle: "Ban this player?",
  confirmBanBody: (name) =>
    `${name} will be removed and cannot return with this identity.`,
  confirmBanAction: "Ban",
  confirmExitTitle: "Leave this screen?",
  confirmExitBody: "You leave this screen only and stay a member of the room.",
  confirmExitAction: "Exit",
  confirmLeaveTitle: "Leave the room permanently?",
  confirmLeaveBody:
    "Your seat will be removed. You can join again while the room is open.",
  confirmLeaveAction: "Leave",
  unexpectedError: "Something unexpected went wrong.",
  unknownError: "Something went wrong.",
  errors: {
    WRONG_PHASE: "That move is not available right now.",
    NOT_YOUR_TURN: "It is not your team's turn.",
    WRONG_ROLE: "This role cannot do that.",
    NOT_A_PLAYER: "Join the room first.",
    ALREADY_JOINED: "You are already in the room.",
    CARD_ALREADY_REVEALED: "That card is already revealed.",
    CARD_OUT_OF_RANGE: "That card is not on the board.",
    INVALID_CLUE: "A signal needs text and a valid number.",
    MUST_GUESS_ONCE: "Reveal one card before ending the turn.",
    LANG_LOCKED: "Board language can only change in the lobby.",
    ALREADY_STARTED: "The round has already started.",
    NOT_ENOUGH_PLAYERS:
      "Each team needs one Mission Lead and one Field Agent.",
    BAD_DEAL: "There are not enough words to deal a board.",
    NOT_HOST: "Only the room host can do that.",
    ROOM_PRIVATE: "This room is private.",
    PLAYER_NOT_FOUND: "That player is not in the room.",
    HOST_REMOVE_FORBIDDEN: "Transfer the host role before removing the host.",
    INVALID_NAME: "Enter a valid name.",
    ROOM_NOT_FOUND: "This room was not found, or you are no longer a member.",
    ROOM_INVITE_INVALID: "This invite link is not valid.",
    ROOM_INVITE_UNAVAILABLE:
      "The private invite link is not available in this browser.",
    ROOM_FULL: "This room is full.",
    ROOM_BANNED: "This identity is banned from the room.",
    ROOM_ACCESS_REVOKED: "You are no longer a member of the room.",
    ROOM_MEMBERSHIP_INVALID: "Room membership could not be verified.",
    HOST_LEAVE_FORBIDDEN: "Transfer the host role or delete the room first.",
    LEAVE_LOBBY_ONLY: "Permanent leave is only available in the lobby.",
    ANONYMOUS_AUTH_DISABLED:
      "Could not start a session right now. Try again in a moment.",
    ROOM_SESSION_EXPIRED: "Your session expired. Join the room again.",
    ROOM_API_ERROR: "That request could not be completed. Try again.",
    SUPABASE_ENV_MISSING: "The room service is unavailable right now. Try later.",
    ROOM_VERSION_CONFLICT: "The room just changed. Try again.",
    NETWORK_ERROR:
      "Could not reach the room service. Check your connection and try again.",
  },
  installTitle: "Install the game on this device",
  installAlready: "The app is already installed ✓",
  installNow: "Install now",
  installClose: "Close",
  installBody:
    "The game installs as an app without a store: one tap to open, and it stays fast.",
  installLaterHint: "You can install later from this menu.",
  installIos: "Open the Safari share menu, then choose “Add to Home Screen”.",
  installAndroid:
    "From the browser menu (⋮) choose “Install app” or “Add to Home screen”.",
  installDesktop: `Use the install icon in the address bar, or choose “Install ${PRODUCT_NAME}” from the browser menu.`,
  updateReady: "A new update is ready",
  updateNow: "Update",
  updateLater: "Later",
};

export const MESSAGES: Record<UiLocale, Messages> = {
  ar: { landing: landingAr, play: playAr },
  en: { landing: landingEn, play: playEn },
};

export function messagesFor(locale: UiLocale): Messages {
  return MESSAGES[locale];
}

export function teamLabel(locale: UiLocale, team: Team): string {
  return team === "red"
    ? MESSAGES[locale].play.teamRed
    : MESSAGES[locale].play.teamBlue;
}

export function roleLabel(locale: UiLocale, role: Role): string {
  return role === "spymaster"
    ? MESSAGES[locale].play.missionLead
    : MESSAGES[locale].play.fieldAgent;
}

/** The room code shown in every preview surface. */
export const DEMO_ROOM_CODE = "QMR-72K";
