import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { isIllegalMove, type Lang, type Role, type Team } from "../engine";
import {
  getRoomProvider,
  RoomError,
  type ClueLogEntry,
  type RoomCommand,
  type RoomMutationResult,
  type RoomSnapshot,
  type RoomVisibility,
} from "../room";
import { absolutePlayUrl, playUrl, readPlayParams } from "../config/routes";
import { useInstallPrompt } from "../lib/pwa/installPrompt";
import { useServiceWorkerStatus } from "../lib/pwa/serviceWorker";
import type { PlayMessages } from "../locale/messages";
import { UiLocaleProvider } from "../locale/UiLocaleProvider";
import { useUiLocale } from "../locale/uiLocale";
import { useMessages } from "../locale/useMessages";
import { GlyphDefs } from "../ui/card";
import { AppDialog } from "../ui/components/AppDialog";
import { Button } from "../ui/components/Button";
import { InstallSheet } from "../ui/components/InstallSheet";
import { LocaleToggle } from "../ui/components/LocaleToggle";
import { UpdateToast } from "../ui/components/UpdateToast";
import { Lobby, PlayScreen } from "../ui/game";
import "../ui/game/Game.css";
import { initTheme } from "./theme";

const ROOM_ID_KEY = "codenames.roomId";
const LEGACY_LOCAL_ROOM_KEY = "codenames.localRooms.v1";
const LEGACY_LOCAL_PLAYER_KEY = "codenames.localPlayerId.v2";

type JoinSource = "code" | "link";
type OnboardingStep =
  | { type: "landing" }
  | { type: "loadingRoom" }
  | { type: "roomRetry"; code: string }
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
  return (
    <UiLocaleProvider>
      <AppShell />
    </UiLocaleProvider>
  );
}

function AppShell() {
  const { locale, dir } = useUiLocale();
  const t = useMessages().play;
  const messagesRef = useRef(t);
  useEffect(() => {
    messagesRef.current = t;
  }, [t]);
  const [initialPlayParams] = useState(() =>
    readPlayParams(window.location.search),
  );
  const [routeRoomCode, setRouteRoomCode] = useState(initialPlayParams.room);
  const [pendingInviteToken, setPendingInviteToken] = useState(readInviteToken);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [step, setStep] = useState<OnboardingStep>(() => {
    if (initialPlayParams.room) {
      return { type: "loadingRoom" };
    }
    return initialPlayParams.create
      ? { type: "createName" }
      : { type: "landing" };
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingRoomAction, setPendingRoomAction] = useState<string | null>(
    null,
  );
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const [installOpen, setInstallOpen] = useState(
    () => initialPlayParams.install,
  );
  const { needRefresh } = useServiceWorkerStatus();
  const activeRoomRef = useRef<string | null>(null);
  const lifecycleGenerationRef = useRef(0);
  const pendingActionRef = useRef<{ key: string } | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const teardownRoomContext = useCallback(
    ({
      expectedRoomId,
      clearInvite,
      clearUrl = true,
      nextError = null,
    }: {
      expectedRoomId?: string | null;
      clearInvite: boolean;
      clearUrl?: boolean;
      nextError?: string | null;
    }): boolean => {
      if (
        expectedRoomId &&
        activeRoomRef.current &&
        activeRoomRef.current !== expectedRoomId
      ) {
        return false;
      }
      lifecycleGenerationRef.current += 1;
      if (clearInvite && expectedRoomId) {
        roomProvider.clearRoomStorage(expectedRoomId);
      }
      activeRoomRef.current = null;
      if (clearUrl) {
        replacePlayLocation();
        setRouteRoomCode(null);
      }
      setPendingInviteToken(null);
      setRoom(null);
      setStep({ type: "landing" });
      setResumeAttempt(0);
      setError(nextError);
      setConfirmRequest(null);
      setRenameOpen(false);
      setCopied(false);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
      pendingActionRef.current = null;
      setPendingRoomAction(null);
      return true;
    },
    [],
  );

  const enterRoom = useCallback((next: RoomSnapshot) => {
    lifecycleGenerationRef.current += 1;
    activeRoomRef.current = next.id;
    replacePlayLocation(next.code);
    setRouteRoomCode(next.code);
    setPendingInviteToken(null);
    setRoom(next);
    setError(null);
  }, []);

  const runPending = useCallback(
    async <T,>(
      key: string,
      action: () => Promise<T>,
    ): Promise<T | undefined> => {
      if (pendingActionRef.current) {
        return undefined;
      }
      const pending = { key };
      pendingActionRef.current = pending;
      setPendingRoomAction(key);
      try {
        return await action();
      } finally {
        if (pendingActionRef.current === pending) {
          pendingActionRef.current = null;
          setPendingRoomAction(null);
        }
      }
    },
    [],
  );

  useEffect(() => {
    initTheme("default");
    document.title = t.documentTitle;
    localStorageSafe.remove(ROOM_ID_KEY);
    localStorageSafe.remove(LEGACY_LOCAL_ROOM_KEY);
    localStorageSafe.remove(LEGACY_LOCAL_PLAYER_KEY);
  }, [t.documentTitle]);

  useEffect(() => {
    if (!readPlayParams(window.location.search).install) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("install");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  useEffect(() => {
    const syncFromLocation = () => {
      const params = readPlayParams(window.location.search);
      teardownRoomContext({
        expectedRoomId: activeRoomRef.current,
        clearInvite: false,
        clearUrl: false,
      });
      setRouteRoomCode(params.room);
      setPendingInviteToken(readInviteToken());
      if (params.room) {
        setStep({ type: "loadingRoom" });
      } else {
        setStep(params.create ? { type: "createName" } : { type: "landing" });
      }
    };
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [teardownRoomContext]);

  useEffect(() => {
    if (!routeRoomCode || room?.code === routeRoomCode) {
      return undefined;
    }

    let mounted = true;
    const requestedCode = routeRoomCode;
    void roomProvider
      .resume(requestedCode)
      .then((result) => {
        if (
          !mounted ||
          readPlayParams(window.location.search).room !== requestedCode
        ) {
          return;
        }
        if (result.status === "active") {
          enterRoom(result.room);
          return;
        }
        if (result.status === "join") {
          setStep({ type: "joinName", code: result.code, source: "link" });
          setError(null);
          return;
        }
        teardownRoomContext({
          clearInvite: true,
          nextError: messageForError(
            new Error("ROOM_NOT_FOUND"),
            messagesRef.current,
          ),
        });
      })
      .catch((caught: unknown) => {
        if (
          !mounted ||
          readPlayParams(window.location.search).room !== requestedCode
        ) {
          return;
        }
        if (isTerminalRoomError(caught)) {
          teardownRoomContext({
            clearInvite: true,
            nextError: messageForError(caught, messagesRef.current),
          });
        } else {
          setStep({ type: "roomRetry", code: requestedCode });
          setError(messageForError(caught, messagesRef.current));
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    enterRoom,
    resumeAttempt,
    room?.code,
    routeRoomCode,
    teardownRoomContext,
  ]);

  const activeRoomId = room?.id ?? null;
  useEffect(() => {
    if (!activeRoomId) {
      return undefined;
    }
    const generation = lifecycleGenerationRef.current;
    return roomProvider.subscribe(activeRoomId, (next) => {
      if (
        activeRoomRef.current !== activeRoomId ||
        lifecycleGenerationRef.current !== generation ||
        (next && next.id !== activeRoomId)
      ) {
        return;
      }
      if (next?.view.me) {
        setRoom(next);
        return;
      }
      teardownRoomContext({
        expectedRoomId: activeRoomId,
        clearInvite: true,
        nextError: messageForError(
          new Error("ROOM_ACCESS_REVOKED"),
          messagesRef.current,
        ),
      });
    });
  }, [activeRoomId, teardownRoomContext]);

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
    const sourceRoom = room;
    const generation = lifecycleGenerationRef.current;
    let result: RoomMutationResult | undefined;
    try {
      result = await runPending(command.type, () =>
        roomProvider.mutate(sourceRoom.id, sourceRoom.version, command),
      );
    } catch (caught) {
      if (
        activeRoomRef.current === sourceRoom.id &&
        lifecycleGenerationRef.current === generation
      ) {
        throw caught;
      }
      return undefined;
    }
    if (
      !result ||
      activeRoomRef.current !== sourceRoom.id ||
      lifecycleGenerationRef.current !== generation
    ) {
      return result;
    }
    if ("id" in result) {
      setRoom(result);
    }
    setError(null);
    return result;
  };

  const handleError = (caught: unknown) => {
    if (isTerminalRoomError(caught) && (room || routeRoomCode)) {
      teardownRoomContext({
        expectedRoomId: room?.id,
        clearInvite: true,
        nextError: messageForError(caught, t),
      });
      return;
    }
    setError(messageForError(caught, t));
  };

  const createRoom = async (name: string) => {
    const generation = lifecycleGenerationRef.current;
    try {
      const next = await runPending("create", () =>
        roomProvider.create({
          name,
          lang: "en",
        }),
      );
      if (next && lifecycleGenerationRef.current === generation) {
        enterRoom(next);
      }
    } catch (caught) {
      if (lifecycleGenerationRef.current === generation) {
        handleError(caught);
      }
    }
  };

  const joinRoom = async (code: string, name: string, source: JoinSource) => {
    const generation = lifecycleGenerationRef.current;
    try {
      const next = await runPending("join", () =>
        roomProvider.join({
          code,
          name,
          ...(source === "link" && pendingInviteToken
            ? { inviteToken: pendingInviteToken }
            : {}),
        }),
      );
      if (next && lifecycleGenerationRef.current === generation) {
        enterRoom(next);
      }
    } catch (caught) {
      if (lifecycleGenerationRef.current === generation) {
        handleError(caught);
      }
    }
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
    const sourceRoomId = room.id;
    const generation = lifecycleGenerationRef.current;
    const isCurrentRoom = () =>
      activeRoomRef.current === sourceRoomId &&
      lifecycleGenerationRef.current === generation;
    try {
      const invitation = new URL(
        absolutePlayUrl(window.location.origin, { room: room.code }),
      );
      if (room.visibility === "private") {
        const token = roomProvider.getInviteToken(room.id);
        if (!token) {
          throw new Error("ROOM_INVITE_UNAVAILABLE");
        }
        invitation.hash = new URLSearchParams({ invite: token }).toString();
      }
      const url = invitation.toString();
      if ("clipboard" in navigator) {
        await navigator.clipboard.writeText(url);
      }
      if (!isCurrentRoom()) {
        return;
      }
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        if (!isCurrentRoom()) {
          return;
        }
        setCopied(false);
      }, 1600);
    } catch (caught) {
      if (isCurrentRoom()) {
        handleError(caught);
      }
    }
  };

  const deleteRoom = async () => {
    if (!room || !isHost) {
      return;
    }
    try {
      const result = await commit({ type: "deleteRoom" });
      if (result && "deleted" in result) {
        teardownRoomContext({
          expectedRoomId: room.id,
          clearInvite: true,
        });
      }
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

  const banPlayer = async (targetPlayerId: string) => {
    if (!room) {
      return;
    }
    try {
      await commit({ type: "banPlayer", targetPlayerId });
    } catch (caught) {
      handleError(caught);
    }
  };

  const permanentlyLeaveRoom = async () => {
    if (!room || isHost || room.view.phase !== "lobby") {
      return;
    }
    try {
      const result = await commit({ type: "leaveRoom" });
      if (result && "left" in result) {
        teardownRoomContext({
          expectedRoomId: room.id,
          clearInvite: true,
        });
      }
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
      title: t.confirmStartTitle,
      body: t.confirmStartBody,
      confirmLabel: t.confirmStartAction,
      onConfirm: startGame,
    });
  };

  const confirmRegenerate = () => {
    requestConfirm({
      title: t.confirmRegenTitle,
      body: t.confirmRegenBody,
      confirmLabel: t.confirmRegenAction,
      onConfirm: startGame,
    });
  };

  const confirmReturnToLobby = () => {
    requestConfirm({
      title: t.confirmLobbyTitle,
      body: t.confirmLobbyBody,
      confirmLabel: t.confirmLobbyAction,
      onConfirm: backToLobby,
    });
  };

  const confirmDeleteRoom = () => {
    requestConfirm({
      title: t.confirmDeleteTitle,
      body: t.confirmDeleteBody,
      confirmLabel: t.confirmDeleteAction,
      onConfirm: deleteRoom,
    });
  };

  const confirmChangeHost = (nextHostId: string) => {
    const name =
      room?.view.players.find((player) => player.id === nextHostId)?.name ??
      t.playerFallback;
    requestConfirm({
      title: t.confirmHostTitle,
      body: t.confirmHostBody(name),
      confirmLabel: t.confirmHostAction,
      onConfirm: () => changeHost(nextHostId),
    });
  };

  const confirmBanPlayer = (targetPlayerId: string) => {
    const name =
      room?.view.players.find((player) => player.id === targetPlayerId)?.name ??
      t.playerFallback;
    requestConfirm({
      title: t.confirmBanTitle,
      body: t.confirmBanBody(name),
      confirmLabel: t.confirmBanAction,
      onConfirm: () => banPlayer(targetPlayerId),
    });
  };

  const confirmExitToHome = () => {
    requestConfirm({
      title: t.confirmExitTitle,
      body: t.confirmExitBody,
      confirmLabel: t.confirmExitAction,
      onConfirm: () => {
        teardownRoomContext({
          expectedRoomId: room?.id,
          clearInvite: false,
        });
      },
    });
  };

  const confirmPermanentLeave = () => {
    requestConfirm({
      title: t.confirmLeaveTitle,
      body: t.confirmLeaveBody,
      confirmLabel: t.confirmLeaveAction,
      onConfirm: permanentlyLeaveRoom,
    });
  };

  return (
    <div
      className={`cn-shell text-ink ${locale === "ar" ? "font-ar" : "font-ui"}`}
      data-lang={locale}
      dir={dir}
    >
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
                canCopyInvite={
                  room.visibility === "public" ||
                  Boolean(roomProvider.getInviteToken(room.id))
                }
                onCopyInvite={copyInvite}
                onSetLang={setLang}
                onSetVisibility={setVisibility}
                onAssignSelf={assignSelf}
                onStartGame={confirmStartGame}
                onDeleteRoom={confirmDeleteRoom}
                onLeaveRoom={confirmPermanentLeave}
                onTransferHost={confirmChangeHost}
                onBanPlayer={confirmBanPlayer}
              />
            ) : (
              <PlayScreen
                room={room}
                view={view}
                selectedCardIndex={selectedCardIndex}
                isHost={isHost}
                playerId={playerId}
                clueToast={clueToast}
                onVote={vote}
                onGiveClue={giveClue}
                onConfirmGuess={confirmCard}
                onEndTurn={endTurn}
                onReturnToLobby={confirmReturnToLobby}
                onRegenerate={confirmRegenerate}
                onBanPlayer={confirmBanPlayer}
              />
            )}
            <Button variant="secondary" onClick={confirmExitToHome}>
              {t.exitScreen}
            </Button>
          </>
        ) : (
          <Onboarding
            step={step}
            onStep={setStep}
            pending={pendingRoomAction !== null}
            onCancelRoomLink={() => teardownRoomContext({ clearInvite: false })}
            onRetryRoom={() => {
              setError(null);
              setStep({ type: "loadingRoom" });
              setResumeAttempt((attempt) => attempt + 1);
            }}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onInstall={() => setInstallOpen(true)}
          />
        )}
        {error ? (
          <p
            className="cn-card-panel p-cn-3 text-ink m-0 text-center text-sm font-semibold"
            role="alert"
          >
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
        {installOpen ? (
          <InstallSheet onClose={() => setInstallOpen(false)} />
        ) : null}
        {needRefresh ? <UpdateToast /> : null}
      </main>
    </div>
  );
}

function PlayerBar({ name, onRename }: { name: string; onRename: () => void }) {
  const t = useMessages().play;
  return (
    <section className="cn-player-bar" aria-label={t.playerBar}>
      <span className="cn-player-bar__name">{name}</span>
      <Button
        className="cn-player-bar__button"
        variant="secondary"
        onClick={onRename}
      >
        {t.rename}
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
  const t = useMessages().play;
  const [name, setName] = useState(currentName);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  return (
    <AppDialog titleId="rename-title" onClose={onCancel}>
      <form className="gap-cn-4 flex flex-col" onSubmit={submit}>
        <h2 id="rename-title" className="text-ink m-0 text-lg font-bold">
          {t.renameTitle}
        </h2>
        <label className="text-ink text-sm font-semibold" htmlFor="rename-name">
          {t.newNameLabel}
        </label>
        <input
          id="rename-name"
          className="cn-field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={t.newNameLabel}
        />
        <div className="gap-cn-2 grid grid-cols-2">
          <Button variant="secondary" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={name.trim().length === 0}>
            {t.save}
          </Button>
        </div>
      </form>
    </AppDialog>
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
  const t = useMessages().play;
  return (
    <AppDialog
      role="alertdialog"
      titleId="confirm-title"
      describedBy="confirm-body"
      onClose={onCancel}
    >
      <h2 id="confirm-title" className="text-ink m-0 text-lg font-bold">
        {request.title}
      </h2>
      <p id="confirm-body" className="text-ink-soft m-0 text-sm">
        {request.body}
      </p>
      <div className="gap-cn-2 grid grid-cols-2">
        <Button variant="secondary" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button onClick={onConfirm}>{request.confirmLabel}</Button>
      </div>
    </AppDialog>
  );
}

function Onboarding({
  step,
  onStep,
  pending,
  onCancelRoomLink,
  onRetryRoom,
  onCreateRoom,
  onJoinRoom,
  onInstall,
}: {
  step: OnboardingStep;
  onStep: (step: OnboardingStep) => void;
  pending: boolean;
  onCancelRoomLink: () => void;
  onRetryRoom: () => void;
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string, source: JoinSource) => void;
  onInstall: () => void;
}) {
  const t = useMessages().play;

  if (step.type === "loadingRoom") {
    return (
      <section className="cn-card-panel p-cn-4 text-center" aria-live="polite">
        <p className="text-ink m-0 text-sm font-semibold">{t.openingRoom}</p>
      </section>
    );
  }

  if (step.type === "roomRetry") {
    return (
      <section className="cn-card-panel gap-cn-3 p-cn-4 flex flex-col">
        <Button onClick={onRetryRoom}>{t.retry}</Button>
        <Button variant="secondary" onClick={onCancelRoomLink}>
          {t.back}
        </Button>
      </section>
    );
  }

  if (step.type === "createName") {
    return (
      <UsernameStep
        title={t.chooseName}
        description={t.nameCreateHint}
        submitLabel={pending ? t.createPending : t.createSubmit}
        nameLabel={t.nameLabel}
        namePlaceholder={t.namePlaceholder}
        backLabel={t.back}
        pending={pending}
        onBack={() => onStep({ type: "landing" })}
        onSubmit={onCreateRoom}
      />
    );
  }

  if (step.type === "joinName") {
    return (
      <UsernameStep
        title={t.chooseName}
        description={t.nameJoinHint(step.code)}
        submitLabel={pending ? t.joinPending : t.joinSubmit}
        nameLabel={t.nameLabel}
        namePlaceholder={t.namePlaceholder}
        backLabel={t.back}
        pending={pending}
        onBack={() =>
          step.source === "link"
            ? onCancelRoomLink()
            : onStep({ type: "joinCode" })
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
      onInstall={onInstall}
    />
  );
}

function Landing({
  onCreate,
  onJoin,
  onInstall,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onInstall: () => void;
}) {
  const t = useMessages().play;
  const { isStandalone } = useInstallPrompt();

  return (
    <>
      <header className="cn-landing-hero">
        <img
          className="cn-landing-logo"
          src="/pwa-icon.svg"
          alt={t.productName}
        />
        <h1 className="text-ink m-0 text-xl font-bold">{t.productName}</h1>
        <p className="text-ink-soft m-0 text-sm">{t.subtitle}</p>
      </header>

      <LocaleToggle />

      <div className="gap-cn-3 flex flex-col">
        <Button onClick={onCreate}>{t.createRoom}</Button>
        <Button variant="secondary" onClick={onJoin}>
          {t.joinByCode}
        </Button>
        {isStandalone ? null : (
          <Button variant="secondary" onClick={onInstall}>
            {t.installApp}
          </Button>
        )}
      </div>
      <p className="text-ink-soft m-0 text-center text-xs">{t.credit}</p>
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
  const t = useMessages().play;
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
        {t.roomCodeLabel}
      </label>
      <input
        id="join-code"
        className="cn-field font-mono"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder={t.roomCodePlaceholder}
        dir="ltr"
      />
      <Button type="submit" disabled={code.trim().length === 0}>
        {t.continue}
      </Button>
      <Button variant="secondary" onClick={onBack}>
        {t.back}
      </Button>
    </form>
  );
}

function UsernameStep({
  title,
  description,
  submitLabel,
  nameLabel,
  namePlaceholder,
  backLabel,
  pending,
  onBack,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  backLabel: string;
  pending: boolean;
  onBack: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!pending) {
      submittedRef.current = false;
    }
  }, [pending]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || submittedRef.current) {
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      submittedRef.current = true;
      onSubmit(trimmed);
    }
  };

  return (
    <form
      className="cn-card-panel gap-cn-3 p-cn-4 flex flex-col"
      onSubmit={submit}
      aria-busy={pending}
    >
      <div>
        <h1 className="text-ink m-0 text-lg font-bold">{title}</h1>
        <p className="text-ink-soft mt-cn-1 m-0 text-sm">{description}</p>
      </div>
      <label className="text-ink text-sm font-semibold" htmlFor="player-name">
        {nameLabel}
      </label>
      <input
        id="player-name"
        className="cn-field"
        value={name}
        disabled={pending}
        onChange={(event) => setName(event.target.value)}
        placeholder={namePlaceholder}
      />
      <Button type="submit" disabled={pending || name.trim().length === 0}>
        {submitLabel}
      </Button>
      <Button variant="secondary" onClick={onBack} disabled={pending}>
        {backLabel}
      </Button>
    </form>
  );
}

const localStorageSafe = {
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return;
    }
  },
};

function replacePlayLocation(room?: string): void {
  window.history.replaceState(null, "", playUrl(room ? { room } : {}));
}

function readInviteToken(): string | null {
  try {
    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    return new URLSearchParams(fragment).get("invite");
  } catch {
    return null;
  }
}

function messageForError(caught: unknown, t: PlayMessages): string {
  if (isIllegalMove(caught) || caught instanceof RoomError) {
    return errorMessage(caught.code, t);
  }
  if (caught instanceof Error) {
    if (
      caught.message.includes("Failed to fetch") ||
      caught.message.includes("NetworkError")
    ) {
      return errorMessage("NETWORK_ERROR", t);
    }
    return errorMessage(caught.message, t);
  }
  return t.unexpectedError;
}

function errorMessage(code: string, t: PlayMessages): string {
  return t.errors[code] ?? t.unknownError;
}

function isTerminalRoomError(caught: unknown): boolean {
  return (
    caught instanceof Error &&
    ["ROOM_BANNED", "ROOM_NOT_FOUND", "ROOM_NOT_MEMBER"].includes(
      caught.message,
    )
  );
}
