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
  inMemoryRoomProvider,
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
const LOCAL_PLAYER_IDS_KEY = "codenames.localPlayerIds";

export function App() {
  const [playerId, setPlayerId] = useState(() => loadOrCreatePlayerId());
  const [localPlayerIds, setLocalPlayerIds] = useState(() =>
    loadLocalPlayerIds(playerId),
  );
  const [roomId, setRoomId] = useState(() => localStorageSafe.get(ROOM_ID_KEY));
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("room") ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    initTheme("default");
  }, []);

  useEffect(() => {
    localStorageSafe.set(PLAYER_ID_KEY, playerId);
  }, [playerId]);

  useEffect(() => {
    saveLocalPlayerIds(localPlayerIds);
  }, [localPlayerIds]);

  useEffect(() => {
    if (!roomId) {
      return undefined;
    }

    let mounted = true;
    void inMemoryRoomProvider.load(roomId).then((loaded) => {
      if (!mounted) {
        return;
      }
      setRoom(loaded);
      if (!loaded) {
        localStorageSafe.remove(ROOM_ID_KEY);
      }
    });

    const unsubscribe = inMemoryRoomProvider.subscribe(roomId, (next) => {
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
    await inMemoryRoomProvider.save(next, expectedVersion);
    setRoom(next);
    setError(null);
  };

  const registerLocalPlayerId = (id: string) => {
    setLocalPlayerIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
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
    setError("حدث خطأ غير متوقع.");
  };

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hostName = createName.trim();
    if (hostName.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    const next = createRoomRecord({
      id: createRoomId(),
      code: createRoomCode(),
      hostId: playerId,
      hostName,
      lang: "ar",
      now,
    });
    await inMemoryRoomProvider.create(next);
    localStorageSafe.set(ROOM_ID_KEY, next.id);
    setRoomId(next.id);
    setRoom(next);
    setError(null);
  };

  const joinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = joinName.trim();
    const code = joinCode.trim().toUpperCase();
    if (name.length === 0 || code.length === 0) {
      return;
    }
    try {
      const found = await inMemoryRoomProvider.loadByCode(code);
      if (!found) {
        setError("لم يتم العثور على الغرفة.");
        return;
      }
      const next = joinRoomRecord(
        found,
        playerId,
        name,
        new Date().toISOString(),
      );
      await commit(next);
      localStorageSafe.set(ROOM_ID_KEY, next.id);
      setRoomId(next.id);
    } catch (caught) {
      handleError(caught);
    }
  };

  const addLocalPlayer = async (name: string) => {
    if (!room) {
      return;
    }
    try {
      const nextPlayerId = createClientId();
      const next = joinRoomRecord(
        room,
        nextPlayerId,
        name,
        new Date().toISOString(),
      );
      await commit(next);
      registerLocalPlayerId(nextPlayerId);
      setPlayerId(nextPlayerId);
    } catch (caught) {
      handleError(caught);
    }
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
    await inMemoryRoomProvider.delete(room.id);
    localStorageSafe.remove(ROOM_ID_KEY);
    setRoomId(null);
    setRoom(null);
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

  const switchPlayer = (nextPlayerId: string) => {
    if (!localPlayerIds.includes(nextPlayerId)) {
      setError("هذا اللاعب ليس محفوظا على هذا الجهاز.");
      return;
    }
    setPlayerId(nextPlayerId);
    setError(null);
  };

  const leaveLocalRoom = () => {
    localStorageSafe.remove(ROOM_ID_KEY);
    setRoomId(null);
    setRoom(null);
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
                localPlayerIds={localPlayerIds}
                copied={copied}
                onCopyInvite={copyInvite}
                onSetLang={setLang}
                onSetVisibility={setVisibility}
                onAssignSelf={assignSelf}
                onStartGame={startGame}
                onDeleteRoom={deleteRoom}
                onTransferHost={changeHost}
                onRemovePlayer={kickPlayer}
                onSwitchPlayer={switchPlayer}
                onAddLocalPlayer={addLocalPlayer}
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
            <Button variant="secondary" onClick={leaveLocalRoom}>
              الخروج من هذه الشاشة
            </Button>
          </>
        ) : (
          <Landing
            createName={createName}
            joinName={joinName}
            joinCode={joinCode}
            onCreateName={setCreateName}
            onJoinName={setJoinName}
            onJoinCode={setJoinCode}
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

function Landing({
  createName,
  joinName,
  joinCode,
  onCreateName,
  onJoinName,
  onJoinCode,
  onCreateRoom,
  onJoinRoom,
}: {
  createName: string;
  joinName: string;
  joinCode: string;
  onCreateName: (value: string) => void;
  onJoinName: (value: string) => void;
  onJoinCode: (value: string) => void;
  onCreateRoom: (event: FormEvent<HTMLFormElement>) => void;
  onJoinRoom: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <header className="gap-cn-3 flex items-center">
        <div className="cn-wordmark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div>
          <h1 className="text-ink m-0 text-xl font-bold">كودنيمز</h1>
          <p className="text-ink-soft m-0 text-sm">لعبة كلمات عربية أولا</p>
        </div>
      </header>

      <form
        className="cn-card-panel gap-cn-3 p-cn-4 flex flex-col"
        onSubmit={onCreateRoom}
      >
        <label className="text-ink text-sm font-semibold" htmlFor="create-name">
          إنشاء غرفة
        </label>
        <input
          id="create-name"
          className="cn-field"
          value={createName}
          onChange={(event) => onCreateName(event.target.value)}
          placeholder="اسمك"
        />
        <Button type="submit" disabled={createName.trim().length === 0}>
          إنشاء غرفة جديدة
        </Button>
      </form>

      <form
        className="cn-card-panel gap-cn-3 p-cn-4 flex flex-col"
        onSubmit={onJoinRoom}
      >
        <label className="text-ink text-sm font-semibold" htmlFor="join-code">
          الانضمام لغرفة
        </label>
        <input
          className="cn-field"
          value={joinName}
          onChange={(event) => onJoinName(event.target.value)}
          placeholder="اسمك"
        />
        <input
          id="join-code"
          className="cn-field font-mono"
          value={joinCode}
          onChange={(event) => onJoinCode(event.target.value)}
          placeholder="ROOM CODE"
          dir="ltr"
        />
        <Button
          type="submit"
          disabled={
            joinName.trim().length === 0 || joinCode.trim().length === 0
          }
        >
          انضمام
        </Button>
      </form>
    </>
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

function loadOrCreatePlayerId(): string {
  const existing = localStorageSafe.get(PLAYER_ID_KEY);
  return existing ?? createClientId();
}

function loadLocalPlayerIds(playerId: string): string[] {
  const raw = localStorageSafe.get(LOCAL_PLAYER_IDS_KEY);
  if (!raw) {
    return [playerId];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [playerId];
    }
    const ids = parsed.filter((id): id is string => typeof id === "string");
    return ids.includes(playerId) ? ids : [...ids, playerId];
  } catch {
    return [playerId];
  }
}

function saveLocalPlayerIds(ids: string[]): void {
  localStorageSafe.set(LOCAL_PLAYER_IDS_KEY, JSON.stringify(ids));
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
  };
  return messages[code] ?? "حدث خطأ.";
}
