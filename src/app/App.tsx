import { useEffect, useMemo, useState, type FormEvent } from "react";
import { sampleConceptsForBoard } from "../content/words/sampler";
import {
  isIllegalMove,
  viewFor,
  type Lang,
  type Role,
  type Team,
} from "../engine";
import {
  clearVote,
  confirmGuess,
  createRoomRecord,
  dispatchRoomAction,
  getRoomProvider,
  joinRoomRecord,
  removePlayer,
  returnToLobby,
  RoomError,
  startNewGame,
  transferHost,
  updateRoomSettings,
  voteCard,
  type ClueLogEntry,
  type RoomRecord,
  type RoomVisibility,
} from "../room";
import {
  createClientId,
  createRoomCode,
  createRoomId,
  createSeed,
} from "../room/ids";
import { GlyphDefs } from "../ui/card";
import { Button } from "../ui/components/Button";
import { Lobby, PlayScreen } from "../ui/game";
import "../ui/game/Game.css";
import { initTheme } from "./theme";

const PLAYER_ID_KEY = "codenames.playerId";
const ROOM_ID_KEY = "codenames.roomId";

type JoinSource = "code" | "link";
type OnboardingStep =
  | { type: "landing" }
  | { type: "createName" }
  | { type: "joinCode" }
  | { type: "joinName"; code: string; source: JoinSource };

const roomProvider = getRoomProvider();

export function App() {
  const inviteCode = readInviteCode();
  const [playerId] = useState(() => loadOrCreatePlayerId());
  const [roomId, setRoomId] = useState(() =>
    inviteCode ? null : localStorageSafe.get(ROOM_ID_KEY),
  );
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [step, setStep] = useState<OnboardingStep>(() =>
    inviteCode
      ? { type: "joinName", code: inviteCode, source: "link" }
      : { type: "landing" },
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    initTheme("default");
  }, []);

  useEffect(() => {
    localStorageSafe.set(PLAYER_ID_KEY, playerId);
  }, [playerId]);

  useEffect(() => {
    if (!roomId) {
      return undefined;
    }

    let mounted = true;
    void roomProvider.load(roomId).then((loaded) => {
      if (!mounted) {
        return;
      }
      setRoom(loaded);
      if (!loaded) {
        localStorageSafe.remove(ROOM_ID_KEY);
      }
    });

    const unsubscribe = roomProvider.subscribe(roomId, (next) => {
      if (!next) {
        localStorageSafe.remove(ROOM_ID_KEY);
      }
      setRoom(next);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [roomId]);

  const view = useMemo(
    () => (room ? viewFor(room.state, playerId) : null),
    [room, playerId],
  );
  const isHost = Boolean(room && room.hostId === playerId);
  const selectedCardIndex = room?.ui.votes[playerId] ?? null;
  const clueToast: ClueLogEntry | null =
    room?.ui.clueLog[room.ui.clueLog.length - 1] ?? null;

  const commit = async (next: RoomRecord, expectedVersion = room?.version) => {
    await roomProvider.save(next, expectedVersion);
    setRoom(next);
    setError(null);
  };

  const handleError = (caught: unknown) => {
    if (isIllegalMove(caught)) {
      setError(errorMessage(caught.code));
      return;
    }
    if (caught instanceof RoomError) {
      setError(errorMessage(caught.code));
      return;
    }
    if (caught instanceof Error) {
      setError(errorMessage(caught.message));
      return;
    }
    setError("حدث خطأ غير متوقع.");
  };

  const createRoom = async (name: string) => {
    try {
      const now = new Date().toISOString();
      const next = createRoomRecord({
        id: createRoomId(),
        code: createRoomCode(),
        hostId: playerId,
        hostName: name,
        lang: "ar",
        now,
      });
      await roomProvider.create(next);
      enterRoom(next);
    } catch (caught) {
      handleError(caught);
    }
  };

  const joinRoom = async (code: string, name: string, source: JoinSource) => {
    try {
      const found = await roomProvider.loadByCode(code);
      if (!found) {
        setError(errorMessage("ROOM_NOT_FOUND"));
        return;
      }
      const next = joinRoomRecord(
        found,
        playerId,
        name,
        new Date().toISOString(),
        {
          allowPrivate: source === "link",
        },
      );
      await roomProvider.save(next, found.version);
      enterRoom(next);
    } catch (caught) {
      handleError(caught);
    }
  };

  const enterRoom = (next: RoomRecord) => {
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
      await commit(
        dispatchRoomAction(
          room,
          { type: "assignSelf", team, role },
          playerId,
          new Date().toISOString(),
        ),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const setLang = async (lang: Lang) => {
    if (!room) {
      return;
    }
    try {
      await commit(
        updateRoomSettings(room, playerId, { lang }, new Date().toISOString()),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const setVisibility = async (visibility: RoomVisibility) => {
    if (!room) {
      return;
    }
    try {
      await commit(
        updateRoomSettings(
          room,
          playerId,
          { visibility },
          new Date().toISOString(),
        ),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const startGame = async () => {
    if (!room) {
      return;
    }
    try {
      const seed = createSeed();
      await commit(
        startNewGame(
          room,
          playerId,
          sampleConceptsForBoard(seed),
          seed,
          new Date().toISOString(),
        ),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const giveClue = async (word: string, count: number) => {
    if (!room) {
      return;
    }
    try {
      await commit(
        dispatchRoomAction(
          room,
          { type: "giveClue", word, count },
          playerId,
          new Date().toISOString(),
        ),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const vote = async (cardIndex: number) => {
    if (!room || !view?.can.guess) {
      return;
    }
    try {
      const next =
        selectedCardIndex === cardIndex
          ? clearVote(room, playerId, new Date().toISOString())
          : voteCard(room, playerId, cardIndex, new Date().toISOString());
      await commit(next);
    } catch (caught) {
      handleError(caught);
    }
  };

  const confirmSelected = async () => {
    if (!room || selectedCardIndex === null) {
      return;
    }
    try {
      await commit(
        confirmGuess(
          room,
          playerId,
          selectedCardIndex,
          new Date().toISOString(),
        ),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const endTurn = async () => {
    if (!room) {
      return;
    }
    try {
      await commit(
        dispatchRoomAction(
          room,
          { type: "endTurn" },
          playerId,
          new Date().toISOString(),
        ),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const backToLobby = async () => {
    if (!room) {
      return;
    }
    try {
      await commit(returnToLobby(room, playerId, new Date().toISOString()));
    } catch (caught) {
      handleError(caught);
    }
  };

  const copyInvite = async () => {
    if (!room) {
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    if ("clipboard" in navigator) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        setError(url);
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const deleteRoom = async () => {
    if (!room || !isHost) {
      return;
    }
    await roomProvider.delete(room.id);
    leaveRoom();
  };

  const changeHost = async (nextHostId: string) => {
    if (!room) {
      return;
    }
    try {
      await commit(
        transferHost(room, playerId, nextHostId, new Date().toISOString()),
      );
    } catch (caught) {
      handleError(caught);
    }
  };

  const kickPlayer = async (targetPlayerId: string) => {
    if (!room) {
      return;
    }
    try {
      await commit(
        removePlayer(room, playerId, targetPlayerId, new Date().toISOString()),
      );
    } catch (caught) {
      handleError(caught);
    }
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
            {room.state.phase === "lobby" ? (
              <Lobby
                room={room}
                view={view}
                playerId={playerId}
                copied={copied}
                onCopyInvite={copyInvite}
                onSetLang={setLang}
                onSetVisibility={setVisibility}
                onAssignSelf={assignSelf}
                onStartGame={startGame}
                onDeleteRoom={deleteRoom}
                onTransferHost={changeHost}
                onRemovePlayer={kickPlayer}
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
                onConfirmGuess={confirmSelected}
                onEndTurn={endTurn}
                onReturnToLobby={backToLobby}
                onRegenerate={startGame}
              />
            )}
            <Button variant="secondary" onClick={leaveRoom}>
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
      </main>
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

function loadOrCreatePlayerId(): string {
  const existing = localStorageSafe.get(PLAYER_ID_KEY);
  return existing ?? createClientId();
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
    INVALID_CLUE: "التلميح يجب أن يكون كلمة واحدة ورقما صحيحا.",
    MUST_GUESS_ONCE: "يجب كشف بطاقة واحدة قبل إنهاء الدور.",
    LANG_LOCKED: "تغيير اللغة متاح في الردهة فقط.",
    ALREADY_STARTED: "الجولة بدأت بالفعل.",
    NOT_ENOUGH_PLAYERS: "كل فريق يحتاج قائدا ولاعبا.",
    BAD_DEAL: "قائمة الكلمات غير كافية.",
    NOT_HOST: "هذا الخيار للمضيف فقط.",
    ROOM_PRIVATE: "هذه الغرفة خاصة.",
    PLAYER_NOT_FOUND: "اللاعب غير موجود.",
    HOST_REMOVE_FORBIDDEN: "انقل الاستضافة قبل حذف المضيف.",
    ROOM_NOT_FOUND:
      "لم يتم العثور على الغرفة. إذا كان المضيف يرى الغرفة، فتأكد من تشغيل SQL migration وسياسات RLS في Supabase ثم أعد النشر.",
    ROOM_STORAGE_NOT_READABLE:
      "تم إنشاء الغرفة لكن Supabase لا يعيدها عند البحث. شغل SQL migration وسياسات RLS من جديد في Supabase.",
    SUPABASE_ENV_MISSING:
      "إعدادات Supabase غير موجودة في هذا النشر. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Vercel ثم أعد النشر.",
    ROOM_VERSION_CONFLICT: "تغيرت الغرفة للتو. أعد المحاولة.",
  };
  return messages[code] ?? "حدث خطأ.";
}
