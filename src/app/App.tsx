import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  isIllegalMove,
  type Lang,
  type PartnerFieldAgentView,
  type PartnerMissionLeadView,
  type Role,
  type Team,
} from "../engine";
import {
  getRoomProvider,
  RoomError,
  type ClueLogEntry,
  type PartnerRoomSnapshot,
  type RoomCommand,
  type RoomMutationResult,
  type RoomVisibility,
  type SharedRoomSnapshot,
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
import {
  PARTNER_MESSAGES,
  PartnerFieldAgent,
  PartnerFieldAgentOnboarding,
  PartnerMissionLead,
  type FieldAgentCard,
  type MissionLeadCard,
  type PartnerPreviousTurn,
  type PartnerRevealPresentation,
  type WebMcpCapability,
} from "../ui/partner";
import {
  PartnerMissionWebMcpAdapter,
  WebMcpToolError,
  type FieldAgentMissionSnapshot,
  type PartnerMissionWebMcpHandlers,
} from "../webmcp";
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
  | { type: "partnerCreateName" }
  | { type: "partnerInvite"; code: string }
  | { type: "joinCode" }
  | { type: "joinName"; code: string; source: JoinSource };

interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

const roomProvider = getRoomProvider();
const webMcpHandlersCell: {
  current: PartnerMissionWebMcpHandlers | null;
} = { current: null };
const partnerWebMcpAdapter = new PartnerMissionWebMcpAdapter({
  getCurrentHandlers: () => {
    if (!webMcpHandlersCell.current) {
      throw new WebMcpToolError(
        "The Field Agent mission is no longer active. Open the current invitation again.",
      );
    }
    return webMcpHandlersCell.current;
  },
});

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
  const [room, setRoom] = useState<SharedRoomSnapshot | null>(null);
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
  const [briefingCopied, setBriefingCopied] = useState(false);
  const [webMcpStatus, setWebMcpStatus] = useState<WebMcpCapability>({
    state: "checking",
    toolCount: 0,
  });
  const [revealPresentation, setRevealPresentation] =
    useState<PartnerRevealPresentation>();
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingRoomAction, setPendingRoomAction] = useState<string | null>(
    null,
  );
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const [webMcpAttempt, setWebMcpAttempt] = useState(0);
  const [installOpen, setInstallOpen] = useState(
    () => initialPlayParams.install,
  );
  const { needRefresh } = useServiceWorkerStatus();
  const activeRoomRef = useRef<string | null>(null);
  const roomRef = useRef<SharedRoomSnapshot | null>(null);
  const lifecycleGenerationRef = useRef(0);
  const pendingActionRef = useRef<{ key: string } | null>(null);
  const pendingPartnerResolutionRef = useRef<{
    roomId: string;
    promise: Promise<void>;
  } | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const briefingCopiedTimerRef = useRef<number | null>(null);
  const waitersRef = useRef(
    new Set<{ afterVersion: number; resolve: () => void }>(),
  );
  const publishRoom = useCallback((next: SharedRoomSnapshot | null) => {
    const current = roomRef.current;
    if (
      current &&
      next &&
      current.id === next.id &&
      next.version <= current.version
    ) {
      return;
    }
    if (
      next?.mode === "partner" &&
      next.view.viewerRole !== null &&
      next.view.phase !== "locked" &&
      next.view.previousTurn &&
      partnerTurnKey(next) !== partnerTurnKey(current)
    ) {
      const sequenceCardIds = next.view.previousTurn.reveals.map(
        (reveal) => reveal.cardId,
      );
      if (sequenceCardIds.length > 0) {
        setRevealPresentation({
          sequenceCardIds,
          visibleRevealCount: 0,
          activeCardId: sequenceCardIds[0],
          step: { current: 1, total: sequenceCardIds.length },
        });
      }
    }
    roomRef.current = next;
    setRoom(next);
    if (next) {
      for (const waiter of waitersRef.current) {
        if (next.version > waiter.afterVersion) {
          waitersRef.current.delete(waiter);
          waiter.resolve();
        }
      }
    }
  }, []);

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
      publishRoom(null);
      setStep({ type: "landing" });
      setResumeAttempt(0);
      setError(nextError);
      setConfirmRequest(null);
      setRenameOpen(false);
      setCopied(false);
      setBriefingCopied(false);
      setRevealPresentation(undefined);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
      if (briefingCopiedTimerRef.current !== null) {
        window.clearTimeout(briefingCopiedTimerRef.current);
        briefingCopiedTimerRef.current = null;
      }
      pendingActionRef.current = null;
      setPendingRoomAction(null);
      return true;
    },
    [publishRoom],
  );

  const enterRoom = useCallback(
    (next: SharedRoomSnapshot) => {
      lifecycleGenerationRef.current += 1;
      activeRoomRef.current = next.id;
      replacePlayLocation(next.code);
      setRouteRoomCode(next.code);
      setPendingInviteToken(null);
      publishRoom(next);
      setError(null);
    },
    [publishRoom],
  );

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
          setStep(
            result.mode === "partner"
              ? { type: "partnerInvite", code: result.code }
              : { type: "joinName", code: result.code, source: "link" },
          );
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
      if (
        next &&
        (next.mode === "partner"
          ? next.view.viewerRole !== null
          : next.view.me !== null)
      ) {
        publishRoom(next);
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
  }, [activeRoomId, publishRoom, teardownRoomContext]);

  const classicRoom = room?.mode === "partner" ? null : room;
  const view = classicRoom?.view ?? null;
  const playerId = view?.me?.id ?? "";
  const isHost = Boolean(classicRoom && classicRoom.hostId === playerId);
  const selectedCardIndex = classicRoom?.ui.votes[playerId] ?? null;
  const clueToast: ClueLogEntry | null =
    classicRoom?.ui.clueLog[classicRoom.ui.clueLog.length - 1] ?? null;

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
      publishRoom(result);
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

  const createPartnerMission = async (name: string, lang: Lang = "en") => {
    const generation = lifecycleGenerationRef.current;
    try {
      const next = await runPending("createPartner", () =>
        roomProvider.create({
          name,
          lang,
          mode: "partner",
          visibility: "private",
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

  const giveSignal = async (word: string, count: number) => {
    if (room?.mode !== "partner") {
      return;
    }
    try {
      await commit({ type: "giveSignal", word, count });
    } catch (caught) {
      handleError(caught);
    }
  };

  const resolveLockedGuesses = useCallback(() => {
    const current = roomRef.current;
    if (
      current?.mode !== "partner" ||
      current.view.viewerRole !== "mission_lead" ||
      current.view.phase !== "locked"
    ) {
      return Promise.resolve();
    }
    if (pendingPartnerResolutionRef.current?.roomId === current.id) {
      return pendingPartnerResolutionRef.current.promise;
    }

    const pending = (async () => {
      try {
        const result = await roomProvider.mutate(current.id, current.version, {
          type: "resolveLockedGuesses",
        });
        if ("id" in result && activeRoomRef.current === current.id) {
          publishRoom(result);
          setError(null);
        }
      } catch (caught) {
        if (
          caught instanceof Error &&
          caught.message === "ROOM_VERSION_CONFLICT"
        ) {
          try {
            const latest = await roomProvider.load(current.id);
            if (activeRoomRef.current !== current.id) {
              return;
            }
            if (latest) {
              publishRoom(latest);
              setError(null);
              return;
            }
            setError(
              messageForError(new Error("ROOM_NOT_FOUND"), messagesRef.current),
            );
          } catch (refreshError) {
            setError(messageForError(refreshError, messagesRef.current));
          }
          return;
        }
        setError(messageForError(caught, messagesRef.current));
      }
    })();
    const pendingEntry = { roomId: current.id, promise: pending };
    pendingPartnerResolutionRef.current = pendingEntry;
    void pending.finally(() => {
      if (pendingPartnerResolutionRef.current === pendingEntry) {
        pendingPartnerResolutionRef.current = null;
      }
    });
    return pending;
  }, [publishRoom]);

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
    if (!classicRoom || classicRoom.ui.votes[playerId] !== cardIndex) {
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

  const copyPartnerBriefing = async () => {
    const current = roomRef.current;
    if (current?.mode !== "partner") {
      return;
    }
    try {
      const inviteUrl = roomInviteUrl(current);
      const briefing = [
        "You are the Field Agent in an AI Partner Mission.",
        `Open ${inviteUrl}`,
        "Use choose_name to claim the seat, inspect_mission to read public state, and submit_guesses with ordered stable card IDs when a Signal is active.",
        "Never request or infer the secret mission map.",
      ].join("\n");
      await navigator.clipboard.writeText(briefing);
      setBriefingCopied(true);
      if (briefingCopiedTimerRef.current !== null) {
        window.clearTimeout(briefingCopiedTimerRef.current);
      }
      briefingCopiedTimerRef.current = window.setTimeout(() => {
        briefingCopiedTimerRef.current = null;
        setBriefingCopied(false);
      }, 1600);
    } catch (caught) {
      handleError(caught);
    }
  };

  const deleteRoom = async () => {
    if (!classicRoom || !isHost) {
      return;
    }
    try {
      const result = await commit({ type: "deleteRoom" });
      if (result && "deleted" in result) {
        teardownRoomContext({
          expectedRoomId: classicRoom.id,
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
    if (!classicRoom || isHost || classicRoom.view.phase !== "lobby") {
      return;
    }
    try {
      const result = await commit({ type: "leaveRoom" });
      if (result && "left" in result) {
        teardownRoomContext({
          expectedRoomId: classicRoom.id,
          clearInvite: true,
        });
      }
    } catch (caught) {
      handleError(caught);
    }
  };

  const renameSelf = async (name: string) => {
    if (!classicRoom) {
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
      classicRoom?.view.players.find((player) => player.id === nextHostId)
        ?.name ?? t.playerFallback;
    requestConfirm({
      title: t.confirmHostTitle,
      body: t.confirmHostBody(name),
      confirmLabel: t.confirmHostAction,
      onConfirm: () => changeHost(nextHostId),
    });
  };

  const confirmBanPlayer = (targetPlayerId: string) => {
    const name =
      classicRoom?.view.players.find((player) => player.id === targetPlayerId)
        ?.name ?? t.playerFallback;
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

  useEffect(() => {
    webMcpHandlersCell.current = {
      chooseName: async ({ name }) => {
        const currentStep = step;
        const inviteToken = pendingInviteToken;
        if (currentStep.type !== "partnerInvite" || !inviteToken) {
          throw new WebMcpToolError(
            "This Field Agent invitation is no longer active. Ask the Mission Lead for a fresh invitation.",
          );
        }
        try {
          const next = await roomProvider.claimPartnerSeat({
            code: currentStep.code,
            name,
            inviteToken,
          });
          if (
            next.mode !== "partner" ||
            next.view.viewerRole !== "field_agent"
          ) {
            throw new WebMcpToolError(
              "The Field Agent seat could not be claimed. Ask the Mission Lead for a fresh invitation.",
            );
          }
          enterRoom(next);
          return { name: next.view.fieldAgentName ?? name };
        } catch (caught) {
          throw webMcpError(caught, "choose_name");
        }
      },
      getLatestMission: () => {
        const current = roomRef.current;
        if (
          current?.mode !== "partner" ||
          current.view.viewerRole !== "field_agent"
        ) {
          throw new WebMcpToolError(
            "The Field Agent mission is no longer active. Open the current invitation again.",
          );
        }
        return toFieldAgentMissionSnapshot(current, current.view);
      },
      waitForMissionChange: ({ afterVersion, signal }) =>
        new Promise<void>((resolve) => {
          if (
            (roomRef.current?.version ?? 0) > afterVersion ||
            signal.aborted
          ) {
            resolve();
            return;
          }
          const waiter = { afterVersion, resolve };
          const finish = () => {
            waitersRef.current.delete(waiter);
            signal.removeEventListener("abort", finish);
            resolve();
          };
          waiter.resolve = finish;
          waitersRef.current.add(waiter);
          signal.addEventListener("abort", finish, { once: true });
        }),
      submitGuesses: async ({ cardIds, fieldNote }, latest) => {
        const current = roomRef.current;
        if (
          current?.mode !== "partner" ||
          current.view.viewerRole !== "field_agent" ||
          current.version !== latest.version
        ) {
          throw new WebMcpToolError(
            "The mission changed. Call inspect_mission again before submitting.",
          );
        }
        try {
          const result = await roomProvider.mutate(
            current.id,
            current.version,
            {
              type: "lockGuesses",
              cardIds: [...cardIds],
              ...(fieldNote === undefined ? {} : { fieldNote }),
            },
          );
          if (
            !("id" in result) ||
            result.mode !== "partner" ||
            result.view.viewerRole !== "field_agent"
          ) {
            throw new WebMcpToolError(
              "The guesses could not be locked. Inspect the mission and submit a fresh ordered selection.",
            );
          }
          publishRoom(result);
          return { lockedCount: result.view.lockedCardIds.length };
        } catch (caught) {
          throw webMcpError(caught, "submit_guesses");
        }
      },
    };
  });

  const partnerInviteActive =
    step.type === "partnerInvite" && Boolean(pendingInviteToken);
  const fieldAgentPhase =
    room?.mode === "partner" && room.view.viewerRole === "field_agent"
      ? room.view.phase
      : null;
  const fieldAgentMaxGuesses =
    room?.mode === "partner" && room.view.viewerRole === "field_agent"
      ? room.view.maxGuesses
      : null;

  useEffect(() => {
    let current = true;
    const capability = partnerInviteActive
      ? ({ kind: "pre_join" } as const)
      : fieldAgentPhase
        ? ({
            kind: "joined",
            phase: fieldAgentPhase,
            ...(fieldAgentMaxGuesses
              ? { maxGuesses: fieldAgentMaxGuesses }
              : {}),
          } as const)
        : ({ kind: "inactive" } as const);
    void Promise.resolve()
      .then(() => {
        if (current) {
          setWebMcpStatus({ state: "checking", toolCount: 0 });
        }
        return partnerWebMcpAdapter.setCapability(capability);
      })
      .then((status) => {
        if (!current) {
          return;
        }
        setWebMcpStatus(
          status.state === "ready"
            ? { state: "ready", toolCount: status.toolCount }
            : status.state === "registration_error"
              ? { state: "error", toolCount: 0 }
              : { state: "unavailable", toolCount: 0 },
        );
      });
    return () => {
      current = false;
    };
  }, [
    fieldAgentMaxGuesses,
    fieldAgentPhase,
    partnerInviteActive,
    webMcpAttempt,
  ]);

  useEffect(
    () => () => {
      webMcpHandlersCell.current = null;
      partnerWebMcpAdapter.dispose();
    },
    [],
  );

  const lockedMissionKey =
    room?.mode === "partner" &&
    room.view.viewerRole === "mission_lead" &&
    room.view.phase === "locked"
      ? `${room.id}:${room.version}`
      : null;
  useEffect(() => {
    if (!lockedMissionKey) {
      return undefined;
    }
    let seconds = 3;
    void Promise.resolve().then(() =>
      setRevealPresentation({ countdownSeconds: seconds }),
    );
    const timer = window.setInterval(() => {
      seconds -= 1;
      if (seconds > 0) {
        setRevealPresentation({ countdownSeconds: seconds });
        return;
      }
      window.clearInterval(timer);
      void resolveLockedGuesses();
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [lockedMissionKey, resolveLockedGuesses]);

  const previousPartnerTurn =
    room?.mode === "partner" && room.view.viewerRole !== null
      ? room.view.previousTurn
      : null;
  const previousPartnerTurnKey = previousPartnerTurn
    ? `${room?.id}:${previousPartnerTurn.turnNumber}`
    : null;
  const revealAnimationKey =
    previousPartnerTurnKey &&
    previousPartnerTurn &&
    room?.mode === "partner" &&
    room.view.viewerRole !== null &&
    room.view.phase !== "locked"
      ? JSON.stringify({
          turnKey: previousPartnerTurnKey,
          sequenceCardIds: previousPartnerTurn.reveals.map(
            (reveal) => reveal.cardId,
          ),
        })
      : null;
  const animatedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!revealAnimationKey) {
      return undefined;
    }
    if (animatedTurnRef.current === revealAnimationKey) {
      return undefined;
    }
    animatedTurnRef.current = revealAnimationKey;
    const { sequenceCardIds } = JSON.parse(revealAnimationKey) as {
      sequenceCardIds: string[];
    };
    if (sequenceCardIds.length === 0) {
      return undefined;
    }
    let visibleRevealCount = 0;
    void Promise.resolve().then(() =>
      setRevealPresentation({
        sequenceCardIds,
        visibleRevealCount,
        activeCardId: sequenceCardIds[0],
        step: { current: 1, total: sequenceCardIds.length },
      }),
    );
    const timer = window.setInterval(() => {
      visibleRevealCount += 1;
      if (visibleRevealCount >= sequenceCardIds.length) {
        window.clearInterval(timer);
        setRevealPresentation(undefined);
        return;
      }
      setRevealPresentation({
        sequenceCardIds,
        visibleRevealCount,
        activeCardId: sequenceCardIds[visibleRevealCount],
        step: {
          current: visibleRevealCount + 1,
          total: sequenceCardIds.length,
        },
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [revealAnimationKey]);

  return (
    <div
      className={`cn-shell text-ink ${locale === "ar" ? "font-ar" : "font-ui"}`}
      data-lang={locale}
      dir={dir}
    >
      <GlyphDefs />
      <main className="cn-app">
        {room?.mode === "partner" && room.view.viewerRole !== null ? (
          <>
            <LocaleToggle />
            {room.view.viewerRole === "mission_lead" ? (
              <PartnerMissionLead
                locale={locale}
                boardLang={room.view.lang}
                phase={visiblePartnerPhase(room.view, revealPresentation)}
                cards={toMissionLeadCards(room.view)}
                targetsRemaining={visibleTargetsRemaining(
                  room.view,
                  revealPresentation,
                )}
                fieldAgentName={room.view.fieldAgentName}
                signal={visiblePartnerSignal(room.view, revealPresentation)}
                lockedCardIds={visibleLockedCardIds(
                  room.view,
                  revealPresentation,
                )}
                previousTurn={visiblePreviousTurn(
                  room.view,
                  revealPresentation,
                )}
                presentation={revealPresentation}
                inviteUrl={roomInviteUrlOrEmpty(room)}
                inviteCopied={copied}
                briefingCopied={briefingCopied}
                onCopyAgentInvite={copyInvite}
                onCopyAgentBriefing={copyPartnerBriefing}
                onSendSignal={giveSignal}
                onResolveLockedGuesses={resolveLockedGuesses}
              />
            ) : (
              <PartnerFieldAgent
                locale={locale}
                boardLang={room.view.lang}
                phase={visiblePartnerPhase(room.view, revealPresentation)}
                cards={toFieldAgentCards(room.view)}
                targetsRemaining={visibleTargetsRemaining(
                  room.view,
                  revealPresentation,
                )}
                fieldAgentName={room.view.fieldAgentName}
                signal={visiblePartnerSignal(room.view, revealPresentation)}
                lockedCardIds={visibleLockedCardIds(
                  room.view,
                  revealPresentation,
                )}
                previousTurn={visiblePreviousTurn(
                  room.view,
                  revealPresentation,
                )}
                presentation={revealPresentation}
                capability={webMcpStatus}
                onRetryWebMcp={() => setWebMcpAttempt((attempt) => attempt + 1)}
              />
            )}
            <Button variant="secondary" onClick={confirmExitToHome}>
              {t.exitScreen}
            </Button>
          </>
        ) : classicRoom && view ? (
          <>
            <PlayerBar
              name={
                classicRoom.view.players.find(
                  (player) => player.id === playerId,
                )?.name ?? ""
              }
              onRename={() => setRenameOpen(true)}
            />
            {classicRoom.view.phase === "lobby" ? (
              <Lobby
                room={classicRoom}
                view={view}
                playerId={playerId}
                copied={copied}
                canCopyInvite={
                  classicRoom.visibility === "public" ||
                  Boolean(roomProvider.getInviteToken(classicRoom.id))
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
                room={classicRoom}
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
            locale={locale}
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
            onCreatePartnerMission={createPartnerMission}
            onJoinRoom={joinRoom}
            onInstall={() => setInstallOpen(true)}
            partnerCapability={webMcpStatus}
            onRetryWebMcp={() => setWebMcpAttempt((attempt) => attempt + 1)}
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
        {renameOpen && classicRoom ? (
          <RenameDialog
            currentName={
              classicRoom.view.players.find((player) => player.id === playerId)
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
  locale,
  step,
  onStep,
  pending,
  onCancelRoomLink,
  onRetryRoom,
  onCreateRoom,
  onCreatePartnerMission,
  onJoinRoom,
  onInstall,
  partnerCapability,
  onRetryWebMcp,
}: {
  locale: "en" | "ar";
  step: OnboardingStep;
  onStep: (step: OnboardingStep) => void;
  pending: boolean;
  onCancelRoomLink: () => void;
  onRetryRoom: () => void;
  onCreateRoom: (name: string) => void;
  onCreatePartnerMission: (name: string, lang: Lang) => void;
  onJoinRoom: (code: string, name: string, source: JoinSource) => void;
  onInstall: () => void;
  partnerCapability: WebMcpCapability;
  onRetryWebMcp: () => void;
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

  if (step.type === "partnerCreateName") {
    return (
      <PartnerCreateStep
        title={PARTNER_MESSAGES[locale].partnerMission}
        description={PARTNER_MESSAGES[locale].createHint}
        submitLabel={pending ? t.createPending : t.createSubmit}
        nameLabel={t.nameLabel}
        namePlaceholder={t.namePlaceholder}
        boardLanguageLabel={t.boardLanguage}
        englishLabel={t.boardLanguageEn}
        arabicLabel={t.boardLanguageAr}
        backLabel={t.back}
        pending={pending}
        onBack={() => onStep({ type: "landing" })}
        onSubmit={onCreatePartnerMission}
      />
    );
  }

  if (step.type === "partnerInvite") {
    return (
      <>
        <LocaleToggle />
        <PartnerFieldAgentOnboarding
          locale={locale}
          capability={partnerCapability}
          onRetryWebMcp={onRetryWebMcp}
        />
        <Button variant="secondary" onClick={onCancelRoomLink}>
          {t.back}
        </Button>
      </>
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
      locale={locale}
      onCreate={() => onStep({ type: "createName" })}
      onCreatePartner={() => onStep({ type: "partnerCreateName" })}
      onJoin={() => onStep({ type: "joinCode" })}
      onInstall={onInstall}
    />
  );
}

function PartnerCreateStep({
  boardLanguageLabel,
  englishLabel,
  arabicLabel,
  onSubmit,
  ...nameProps
}: Omit<UsernameStepProps, "onSubmit" | "children" | "inputId"> & {
  boardLanguageLabel: string;
  englishLabel: string;
  arabicLabel: string;
  onSubmit: (name: string, lang: Lang) => void;
}) {
  const [boardLang, setBoardLang] = useState<Lang>("en");

  return (
    <UsernameStep
      {...nameProps}
      inputId="lead-name"
      onSubmit={(name) => onSubmit(name, boardLang)}
    >
      <fieldset className="gap-cn-2 flex flex-col" disabled={nameProps.pending}>
        <legend className="text-ink text-sm font-semibold">
          {boardLanguageLabel}
        </legend>
        <div className="cn-segmented" dir="ltr">
          <button
            type="button"
            aria-pressed={boardLang === "en"}
            onClick={() => setBoardLang("en")}
          >
            {englishLabel}
          </button>
          <button
            type="button"
            aria-pressed={boardLang === "ar"}
            onClick={() => setBoardLang("ar")}
          >
            {arabicLabel}
          </button>
        </div>
      </fieldset>
    </UsernameStep>
  );
}

function Landing({
  locale,
  onCreate,
  onCreatePartner,
  onJoin,
  onInstall,
}: {
  locale: "en" | "ar";
  onCreate: () => void;
  onCreatePartner: () => void;
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
        <Button onClick={onCreatePartner}>
          {PARTNER_MESSAGES[locale].partnerMission}
        </Button>
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

interface UsernameStepProps {
  title: string;
  description: string;
  submitLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  backLabel: string;
  pending: boolean;
  onBack: () => void;
  onSubmit: (name: string) => void;
  inputId?: string;
  children?: ReactNode;
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
  inputId = "player-name",
  children,
}: UsernameStepProps) {
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
      <label className="text-ink text-sm font-semibold" htmlFor={inputId}>
        {nameLabel}
      </label>
      <input
        id={inputId}
        className="cn-field"
        value={name}
        disabled={pending}
        onChange={(event) => setName(event.target.value)}
        placeholder={namePlaceholder}
      />
      {children}
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

function roomInviteUrl(room: SharedRoomSnapshot): string {
  const invitation = new URL(
    absolutePlayUrl(window.location.origin, { room: room.code }),
  );
  const token = roomProvider.getInviteToken(room.id);
  if (room.visibility === "private") {
    if (!token) {
      throw new Error("ROOM_INVITE_UNAVAILABLE");
    }
    invitation.hash = new URLSearchParams({ invite: token }).toString();
  }
  return invitation.toString();
}

function roomInviteUrlOrEmpty(room: SharedRoomSnapshot): string {
  try {
    return roomInviteUrl(room);
  } catch {
    return "";
  }
}

function toMissionLeadCards(view: PartnerMissionLeadView): MissionLeadCard[] {
  return view.board.map((card) => ({
    id: card.id,
    word: card.concept[view.lang],
    kind: card.kind,
    revealed: card.revealed,
  }));
}

function toFieldAgentCards(view: PartnerFieldAgentView): FieldAgentCard[] {
  return view.board.map(
    (card): FieldAgentCard =>
      card.revealed
        ? {
            id: card.id,
            word: card.concept[view.lang],
            revealed: true,
            result: card.result,
          }
        : {
            id: card.id,
            word: card.concept[view.lang],
            revealed: false,
          },
  );
}

function toPartnerPreviousTurn(
  view: PartnerMissionLeadView | PartnerFieldAgentView,
): PartnerPreviousTurn | null {
  if (!view.previousTurn) {
    return null;
  }
  const words = new Map(
    view.board.map((card) => [card.id, card.concept[view.lang]]),
  );
  return {
    signal: view.previousTurn.signal,
    reveals: view.previousTurn.reveals.map((reveal) => ({
      cardId: reveal.cardId,
      word: words.get(reveal.cardId) ?? reveal.cardId,
      result: reveal.result,
    })),
    ...(view.previousTurn.fieldNote
      ? { fieldNote: view.previousTurn.fieldNote }
      : {}),
  };
}

function visiblePreviousTurn(
  view: PartnerMissionLeadView | PartnerFieldAgentView,
  presentation: PartnerRevealPresentation | undefined,
): PartnerPreviousTurn | null {
  return presentation?.sequenceCardIds ? null : toPartnerPreviousTurn(view);
}

function visibleLockedCardIds(
  view: PartnerMissionLeadView | PartnerFieldAgentView,
  presentation: PartnerRevealPresentation | undefined,
): readonly string[] {
  if (presentation?.sequenceCardIds && view.previousTurn) {
    return view.previousTurn.lockedCardIds;
  }
  return view.lockedCardIds;
}

function visiblePartnerPhase(
  view: PartnerMissionLeadView | PartnerFieldAgentView,
  presentation: PartnerRevealPresentation | undefined,
): PartnerMissionLeadView["phase"] {
  return presentation?.sequenceCardIds ? "locked" : view.phase;
}

function visibleTargetsRemaining(
  view: PartnerMissionLeadView | PartnerFieldAgentView,
  presentation: PartnerRevealPresentation | undefined,
): number {
  if (!presentation?.sequenceCardIds || !view.previousTurn) {
    return view.targetsRemaining;
  }
  const visibleCount = presentation.visibleRevealCount ?? 0;
  const pendingTargets = view.previousTurn.reveals
    .slice(visibleCount)
    .filter((reveal) => reveal.result === "target").length;
  return view.targetsRemaining + pendingTargets;
}

function visiblePartnerSignal(
  view: PartnerMissionLeadView | PartnerFieldAgentView,
  presentation: PartnerRevealPresentation | undefined,
) {
  return presentation?.sequenceCardIds && view.previousTurn
    ? view.previousTurn.signal
    : view.signal;
}

function partnerTurnKey(room: SharedRoomSnapshot | null): string | null {
  if (
    room?.mode !== "partner" ||
    room.view.viewerRole === null ||
    !room.view.previousTurn
  ) {
    return null;
  }
  return `${room.id}:${room.view.previousTurn.turnNumber}`;
}

function toFieldAgentMissionSnapshot(
  room: PartnerRoomSnapshot,
  view: PartnerFieldAgentView,
): FieldAgentMissionSnapshot {
  return {
    version: room.version,
    phase: view.phase,
    agentName: view.fieldAgentName ?? "Field Agent",
    signal: view.signal,
    maxGuesses: view.maxGuesses,
    targetsRemaining: view.targetsRemaining,
    cards: toFieldAgentCards(view),
    lockedCardIds: view.lockedCardIds,
  };
}

function webMcpError(
  caught: unknown,
  tool: "choose_name" | "submit_guesses",
): WebMcpToolError {
  if (caught instanceof WebMcpToolError) {
    return caught;
  }
  const code =
    isIllegalMove(caught) || caught instanceof RoomError
      ? caught.code
      : caught instanceof Error
        ? caught.message
        : "";
  if (code === "ROOM_VERSION_CONFLICT" || code === "WRONG_PHASE") {
    return new WebMcpToolError(
      "The mission changed. Call inspect_mission again before submitting.",
    );
  }
  if (
    ["CARD_ALREADY_REVEALED", "CARD_NOT_FOUND", "DUPLICATE_CARD"].includes(code)
  ) {
    return new WebMcpToolError(
      "One selected card is no longer available. Inspect the mission and submit a fresh ordered selection.",
    );
  }
  if (code === "FIELD_AGENT_SEAT_TAKEN") {
    return new WebMcpToolError(
      "The Field Agent seat has already been claimed by another identity.",
    );
  }
  return new WebMcpToolError(
    tool === "choose_name"
      ? "Unable to claim the Field Agent seat. Ask the Mission Lead for a fresh invitation."
      : "Unable to lock these guesses. Call inspect_mission and submit a fresh ordered selection.",
  );
}
