import { useEffect, useState, type FormEvent } from "react";
import { isIllegalMove, type Lang, type Role, type Team } from "../engine";
import {
  getRoomProvider,
  RoomError,
  type ClueLogEntry,
  type RoomCommand,
  type RoomSnapshot,
  type RoomVisibility,
} from "../room";
import { GlyphDefs } from "../ui/card";
import { Button } from "../ui/components/Button";
import { Lobby, PlayScreen } from "../ui/game";
import "../ui/game/Game.css";
import { initTheme } from "./theme";

const ROOM_ID_KEY = "codenames.roomId";

type JoinSource = "code" | "link";
type OnboardingStep =
  | { type: "landing" }
  | { type: "createName" }
  | { type: "joinCode" }
  | { type: "joinName"; code: string; source: JoinSource };

interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

const roomProvider = getRoomProvider();

export function App() {
  const inviteCode = readInviteCode();
  const inviteToken = readInviteToken();
  const [roomId, setRoomId] = useState(() => localStorageSafe.get(ROOM_ID_KEY));
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [step, setStep] = useState<OnboardingStep>(() =>
    inviteCode
      ? { type: "joinName", code: inviteCode, source: "link" }
      : { type: "landing" },
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    initTheme("default");
  }, []);

  useEffect(() => {
    if (!roomId) {
      return undefined;
    }

    let mounted = true;
    const acceptRoom = (next: RoomSnapshot | null) => {
      if (!next) {
        localStorageSafe.remove(ROOM_ID_KEY);
        setRoomId(null);
        setRoom(null);
        if (inviteCode) {
          setStep({ type: "joinName", code: inviteCode, source: "link" });
        }
        return;
      }

      if (inviteCode && next.code !== inviteCode) {
        localStorageSafe.remove(ROOM_ID_KEY);
        setRoomId(null);
        setRoom(null);
        setStep({ type: "joinName", code: inviteCode, source: "link" });
        return;
      }

      if (!next.view.me) {
        localStorageSafe.remove(ROOM_ID_KEY);
        setRoomId(null);
        setRoom(null);
        setStep({ type: "joinName", code: next.code, source: "link" });
        setError("تم حذف جلستك من الغرفة. أدخل اسمك للعودة.");
        return;
      }

      setRoom(next);
    };

    void roomProvider
      .load(roomId)
      .then((loaded) => {
        if (!mounted) {
          return;
        }
        acceptRoom(loaded);
      })
      .catch((caught: unknown) => {
        if (mounted) {
          setError(messageForError(caught));
        }
      });

    const unsubscribe = roomProvider.subscribe(roomId, (next) => {
      acceptRoom(next);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [inviteCode, roomId]);

  const view = room?.view ?? null;
  const playerId = view?.me?.id ?? "";
  const isHost = Boolean(room && room.hostId === playerId);
  const selectedCardIndex = room?.ui.votes[playerId] ?? null;
  const clueToast: ClueLogEntry | null =
    room?.ui.clueLog[room.ui.clueLog.length - 1] ?? null;

  const commit = async (command: RoomCommand) => {
    if (!room) {
      return;
    }
    const next = await roomProvider.mutate(room.id, room.version, command);
    setRoom(next);
    setError(null);
  };

  const handleError = (caught: unknown) => {
    setError(messageForError(caught));
  };

  const createRoom = async (name: string) => {
    try {
      const next = await roomProvider.create({
        name,
        lang: "ar",
      });
      enterRoom(next);
    } catch (caught) {
      handleError(caught);
    }
  };

  const joinRoom = async (code: string, name: string, source: JoinSource) => {
    try {
      const next = await roomProvider.join({
        code,
        name,
        ...(source === "link" && inviteToken ? { inviteToken } : {}),
      });
      enterRoom(next);
    } catch (caught) {
      handleError(caught);
    }
  };

  const enterRoom = (next: RoomSnapshot) => {
    localStorageSafe.set(ROOM_ID_KEY, next.id);
    setRoomId(next.id);
    setRoom(next);
    setError(null);
  };

  const assignSelf = async (team: Team, role: Role) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "assignSelf", team, role });
    } catch (caught) {
      handleError(caught);
    }
  };

  const setLang = async (lang: Lang) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "setLang", lang });
    } catch (caught) {
      handleError(caught);
    }
  };

  const setVisibility = async (visibility: RoomVisibility) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "setVisibility", visibility });
    } catch (caught) {
      handleError(caught);
    }
  };

  const startGame = async () => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "startGame" });
    } catch (caught) {
      handleError(caught);
    }
  };

  const giveClue = async (word: string, count: number) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "giveClue", word, count });
    } catch (caught) {
      handleError(caught);
    }
  };

  const vote = async (cardIndex: number) => {
    if (!room || !view?.can.guess) {
      return;
    }
    try {
      await commit(
        selectedCardIndex === cardIndex
          ? { type: "clearVote" }
          : { type: "vote", cardIndex },
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const confirmCard = async (cardIndex: number) => {
    if (!room || room.ui.votes[playerId] !== cardIndex) {
      return;
    }
    try {
      await commit({ type: "confirmGuess", cardIndex });
    } catch (caught) {
      handleError(caught);
    }
  };

  const endTurn = async () => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "endTurn" });
    } catch (caught) {
      handleError(caught);
    }
  };

  const backToLobby = async () => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "returnToLobby" });
    } catch (caught) {
      handleError(caught);
    }
  };

  const copyInvite = async () => {
    if (!room) {
      return;
    }
    try {
      const invitation = new URL(
        window.location.pathname,
        window.location.origin,
      );
      invitation.searchParams.set("room", room.code);
      if (room.visibility === "private") {
        const token = await roomProvider.ensureInvite(room.id, room.version);
        invitation.hash = new URLSearchParams({ invite: token }).toString();
      }
      const url = invitation.toString();
      if ("clipboard" in navigator) {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (caught) {
      handleError(caught);
    }
  };

  const deleteRoom = async () => {
    if (!room || !isHost) {
      return;
    }
    try {
      await roomProvider.delete(room.id);
      leaveRoom();
    } catch (caught) {
      handleError(caught);
    }
  };

  const changeHost = async (nextHostId: string) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "transferHost", nextHostId });
    } catch (caught) {
      handleError(caught);
    }
  };

  const kickPlayer = async (targetPlayerId: string) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "removePlayer", targetPlayerId });
    } catch (caught) {
      handleError(caught);
    }
  };

  const renameSelf = async (name: string) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "renamePlayer", name });
      setRenameOpen(false);
    } catch (caught) {
      handleError(caught);
    }
  };

  const requestConfirm = (request: ConfirmRequest) => {
    setConfirmRequest(request);
  };

  const confirmPendingAction = async () => {
    if (!confirmRequest) {
      return;
    }
    const action = confirmRequest.onConfirm;
    setConfirmRequest(null);
    try {
      await action();
    } catch (caught) {
      handleError(caught);
    }
  };

  const confirmStartGame = () => {
    requestConfirm({
      title: "بدء الجولة؟",
      body: "سيتم تثبيت الفرق وفتح لوحة جديدة.",
      confirmLabel: "بدء",
      onConfirm: startGame,
    });
  };

  const confirmRegenerate = () => {
    requestConfirm({
      title: "لوحة جديدة؟",
      body: "سيتم استبدال اللوحة الحالية وتصفير التلميحات والتصويتات.",
      confirmLabel: "تجديد",
      onConfirm: startGame,
    });
  };

  const confirmReturnToLobby = () => {
    requestConfirm({
      title: "العودة للردهة؟",
      body: "ستنتهي الجولة الحالية وسيعود اللاعبون لاختيار الفرق.",
      confirmLabel: "عودة",
      onConfirm: backToLobby,
    });
  };

  const confirmDeleteRoom = () => {
    requestConfirm({
      title: "حذف الغرفة؟",
      body: "سيتم حذف الغرفة وإخراج اللاعبين منها.",
      confirmLabel: "حذف",
      onConfirm: deleteRoom,
    });
  };

  const confirmChangeHost = (nextHostId: string) => {
    const name =
      room?.view.players.find((player) => player.id === nextHostId)?.name ??
      "اللاعب";
    requestConfirm({
      title: "نقل الاستضافة؟",
      body: `سيصبح ${name} مضيف الغرفة.`,
      confirmLabel: "نقل",
      onConfirm: () => changeHost(nextHostId),
    });
  };

  const confirmKickPlayer = (targetPlayerId: string) => {
    const name =
      room?.view.players.find((player) => player.id === targetPlayerId)?.name ??
      "اللاعب";
    requestConfirm({
      title: "حذف اللاعب؟",
      body: `سيتم حذف ${name} من الغرفة.`,
      confirmLabel: "حذف",
      onConfirm: () => kickPlayer(targetPlayerId),
    });
  };

  const confirmLeaveRoom = () => {
    requestConfirm({
      title: "الخروج من الغرفة؟",
      body: "ستغادر هذه الشاشة وستحتاج للرابط أو رمز الغرفة للدخول مرة أخرى.",
      confirmLabel: "خروج",
      onConfirm: leaveRoom,
    });
  };

  const leaveRoom = () => {
    localStorageSafe.remove(ROOM_ID_KEY);
    setRoomId(null);
    setRoom(null);
    setStep({ type: "landing" });
    setError(null);
  };

  return (
    <div className="cn-shell font-ui text-ink">
      <GlyphDefs />
      <main className="cn-app">
        {room && view ? (
          <>
            <PlayerBar
              name={
                room.view.players.find((player) => player.id === playerId)
                  ?.name ?? ""
              }
              onRename={() => setRenameOpen(true)}
            />
            {room.view.phase === "lobby" ? (
              <Lobby
                room={room}
                view={view}
                playerId={playerId}
                copied={copied}
                onCopyInvite={copyInvite}
                onSetLang={setLang}
                onSetVisibility={setVisibility}
                onAssignSelf={assignSelf}
                onStartGame={confirmStartGame}
                onDeleteRoom={confirmDeleteRoom}
                onTransferHost={confirmChangeHost}
                onRemovePlayer={confirmKickPlayer}
              />
            ) : (
              <PlayScreen
                room={room}
                view={view}
                selectedCardIndex={selectedCardIndex}
                isHost={isHost}
                clueToast={clueToast}
                onVote={vote}
                onGiveClue={giveClue}
                onConfirmGuess={confirmCard}
                onEndTurn={endTurn}
                onReturnToLobby={confirmReturnToLobby}
                onRegenerate={confirmRegenerate}
              />
            )}
            <Button variant="secondary" onClick={confirmLeaveRoom}>
              الخروج من هذه الشاشة
            </Button>
          </>
        ) : (
          <Onboarding
            step={step}
            onStep={setStep}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
          />
        )}
        {error ? (
          <p className="cn-card-panel p-cn-3 text-ink m-0 text-center text-sm font-semibold">
            {error}
          </p>
        ) : null}
        {confirmRequest ? (
          <ConfirmDialog
            request={confirmRequest}
            onCancel={() => setConfirmRequest(null)}
            onConfirm={confirmPendingAction}
          />
        ) : null}
        {renameOpen && room ? (
          <RenameDialog
            currentName={
              room.view.players.find((player) => player.id === playerId)
                ?.name ?? ""
            }
            onCancel={() => setRenameOpen(false)}
            onSubmit={renameSelf}
          />
        ) : null}
      </main>
    </div>
  );
}

function PlayerBar({ name, onRename }: { name: string; onRename: () => void }) {
  return (
    <section className="cn-player-bar" aria-label="بيانات اللاعب">
      <span className="cn-player-bar__name">{name}</span>
      <Button
        className="cn-player-bar__button"
        variant="secondary"
        onClick={onRename}
      >
        تغيير الاسم
      </Button>
    </section>
  );
}

function RenameDialog({
  currentName,
  onCancel,
  onSubmit,
}: {
  currentName: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  return (
    <div className="cn-dialog-backdrop" role="presentation">
      <form
        className="cn-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        onSubmit={submit}
      >
        <h2 id="rename-title" className="text-ink m-0 text-lg font-bold">
          تغيير الاسم
        </h2>
        <input
          className="cn-field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="الاسم الجديد"
        />
        <div className="gap-cn-2 grid grid-cols-2">
          <Button variant="secondary" onClick={onCancel}>
            إلغاء
          </Button>
          <Button type="submit" disabled={name.trim().length === 0}>
            حفظ
          </Button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="cn-dialog-backdrop" role="presentation">
      <section
        className="cn-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
      >
        <h2 id="confirm-title" className="text-ink m-0 text-lg font-bold">
          {request.title}
        </h2>
        <p id="confirm-body" className="text-ink-soft m-0 text-sm">
          {request.body}
        </p>
        <div className="gap-cn-2 grid grid-cols-2">
          <Button variant="secondary" onClick={onCancel}>
            إلغاء
          </Button>
          <Button onClick={onConfirm}>{request.confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}

function Onboarding({
  step,
  onStep,
  onCreateRoom,
  onJoinRoom,
}: {
  step: OnboardingStep;
  onStep: (step: OnboardingStep) => void;
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string, source: JoinSource) => void;
}) {
  if (step.type === "createName") {
    return (
      <UsernameStep
        title="اختر اسمك"
        description="سيظهر هذا الاسم في الغرفة."
        submitLabel="إنشاء الغرفة"
        onBack={() => onStep({ type: "landing" })}
        onSubmit={onCreateRoom}
      />
    );
  }

  if (step.type === "joinName") {
    return (
      <UsernameStep
        title="اختر اسمك"
        description={`الغرفة ${step.code}`}
        submitLabel="الدخول للغرفة"
        onBack={() =>
          onStep(
            step.source === "link" ? { type: "landing" } : { type: "joinCode" },
          )
        }
        onSubmit={(name) => onJoinRoom(step.code, name, step.source)}
      />
    );
  }

  if (step.type === "joinCode") {
    return (
      <JoinCodeStep
        onBack={() => onStep({ type: "landing" })}
        onSubmit={(code) => onStep({ type: "joinName", code, source: "code" })}
      />
    );
  }

  return (
    <Landing
      onCreate={() => onStep({ type: "createName" })}
      onJoin={() => onStep({ type: "joinCode" })}
    />
  );
}

function Landing({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <>
      <header className="cn-landing-hero">
        <img className="cn-landing-logo" src="/pwa-icon.svg" alt="كودنيمز" />
        <h1 className="text-ink m-0 text-xl font-bold">كودنيمز</h1>
        <p className="text-ink-soft m-0 text-sm">لعبة كلمات عربية أولا</p>
      </header>

      <div className="gap-cn-3 flex flex-col">
        <Button onClick={onCreate}>إنشاء غرفة جديدة</Button>
        <Button variant="secondary" onClick={onJoin}>
          الانضمام برمز
        </Button>
      </div>
    </>
  );
}

function JoinCodeStep({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  return (
    <form
      className="cn-card-panel gap-cn-3 p-cn-4 flex flex-col"
      onSubmit={submit}
    >
      <label className="text-ink text-sm font-semibold" htmlFor="join-code">
        رمز الغرفة
      </label>
      <input
        id="join-code"
        className="cn-field font-mono"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="ROOM CODE"
        dir="ltr"
      />
      <Button type="submit" disabled={code.trim().length === 0}>
        متابعة
      </Button>
      <Button variant="secondary" onClick={onBack}>
        رجوع
      </Button>
    </form>
  );
}

function UsernameStep({
  title,
  description,
  submitLabel,
  onBack,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  onBack: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  return (
    <form
      className="cn-card-panel gap-cn-3 p-cn-4 flex flex-col"
      onSubmit={submit}
    >
      <div>
        <h1 className="text-ink m-0 text-lg font-bold">{title}</h1>
        <p className="text-ink-soft mt-cn-1 m-0 text-sm">{description}</p>
      </div>
      <input
        className="cn-field"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="اسمك"
      />
      <Button type="submit" disabled={name.trim().length === 0}>
        {submitLabel}
      </Button>
      <Button variant="secondary" onClick={onBack}>
        رجوع
      </Button>
    </form>
  );
}

const localStorageSafe = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return;
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return;
    }
  },
};

function readInviteCode(): string | null {
  try {
    const code = new URLSearchParams(window.location.search).get("room");
    return code?.trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

function readInviteToken(): string | null {
  try {
    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    return (
      new URLSearchParams(fragment).get("invite") ??
      new URLSearchParams(window.location.search).get("invite")
    );
  } catch {
    return null;
  }
}

function messageForError(caught: unknown): string {
  if (isIllegalMove(caught) || caught instanceof RoomError) {
    return errorMessage(caught.code);
  }
  if (caught instanceof Error) {
    if (
      caught.message.includes("Failed to fetch") ||
      caught.message.includes("NetworkError")
    ) {
      return errorMessage("NETWORK_ERROR");
    }
    return errorMessage(caught.message);
  }
  return "حدث خطأ غير متوقع.";
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    WRONG_PHASE: "هذه الحركة غير متاحة الآن.",
    NOT_YOUR_TURN: "ليس دور فريقك.",
    WRONG_ROLE: "هذا الدور لا يملك هذا الخيار.",
    NOT_A_PLAYER: "انضم للغرفة أولا.",
    ALREADY_JOINED: "أنت موجود في الغرفة.",
    CARD_ALREADY_REVEALED: "هذه البطاقة مكشوفة.",
    CARD_OUT_OF_RANGE: "البطاقة غير موجودة.",
    INVALID_CLUE: "التلميح لا يمكن أن يكون فارغا ويحتاج رقما صحيحا.",
    MUST_GUESS_ONCE: "يجب كشف بطاقة واحدة قبل إنهاء الدور.",
    LANG_LOCKED: "تغيير اللغة متاح في الردهة فقط.",
    ALREADY_STARTED: "الجولة بدأت بالفعل.",
    NOT_ENOUGH_PLAYERS: "كل فريق يحتاج قائدا ولاعبا.",
    BAD_DEAL: "قائمة الكلمات غير كافية.",
    NOT_HOST: "هذا الخيار للمضيف فقط.",
    ROOM_PRIVATE: "هذه الغرفة خاصة.",
    PLAYER_NOT_FOUND: "اللاعب غير موجود.",
    HOST_REMOVE_FORBIDDEN: "انقل الاستضافة قبل حذف المضيف.",
    INVALID_NAME: "اكتب اسما صالحا.",
    ROOM_NOT_FOUND: "لم يتم العثور على الغرفة أو لم تعد عضوا فيها.",
    ROOM_INVITE_INVALID: "رابط الدعوة غير صالح أو تم استبداله.",
    ROOM_INVITE_UNAVAILABLE: "تعذر إنشاء رابط دعوة خاص.",
    ANONYMOUS_AUTH_DISABLED:
      "الدخول كضيف غير مفعل في Supabase. فعّل Anonymous Sign-Ins ثم أعد المحاولة.",
    ROOM_SESSION_EXPIRED: "انتهت جلسة اللاعب. ادخل إلى الغرفة من جديد.",
    ROOM_API_ERROR: "تعذر تنفيذ الطلب على خادم الغرف.",
    SUPABASE_ENV_MISSING:
      "إعدادات Supabase غير موجودة في هذا النشر. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Vercel ثم أعد النشر.",
    ROOM_VERSION_CONFLICT: "تغيرت الغرفة للتو. أعد المحاولة.",
    NETWORK_ERROR:
      "تعذر الاتصال بخادم الغرف. تحقق من اتصال الإنترنت وحاول مرة أخرى.",
  };
  return messages[code] ?? "حدث خطأ.";
}
