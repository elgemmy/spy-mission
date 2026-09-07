import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PartnerMissionLeadView, PartnerFieldAgentView } from "../engine";
import type { PartnerRoomSnapshot, SharedRoomSnapshot } from "../room";
import { PARTNER_MESSAGES, DUO_MESSAGES } from "../ui/partner";

interface RegisteredTool {
  name: string;
  execute(input: unknown): Promise<unknown>;
}

const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  create: vi.fn(),
  join: vi.fn(),
  claimPartnerSeat: vi.fn(),
  load: vi.fn(),
  mutate: vi.fn(),
  getInviteToken: vi.fn(),
  clearRoomStorage: vi.fn(),
  subscribe: vi.fn(),
  onChange: undefined as
    | ((room: SharedRoomSnapshot | null) => void)
    | undefined,
}));

vi.mock("../room", async () => {
  const actual = await vi.importActual<typeof import("../room")>("../room");
  return {
    ...actual,
    getRoomProvider: () => ({
      resume: mocks.resume,
      create: mocks.create,
      join: mocks.join,
      claimPartnerSeat: mocks.claimPartnerSeat,
      load: mocks.load,
      mutate: mocks.mutate,
      getInviteToken: mocks.getInviteToken,
      clearRoomStorage: mocks.clearRoomStorage,
      subscribe: mocks.subscribe,
    }),
  };
});

vi.mock("../lib/pwa/installPrompt", () => ({
  useInstallPrompt: () => ({ isStandalone: true }),
}));

vi.mock("../lib/pwa/serviceWorker", () => ({
  useServiceWorkerStatus: () => ({ needRefresh: false }),
}));

import { App } from "./App";

const en = PARTNER_MESSAGES.en;

describe("human Duo Mission", () => {
  it("asks for a complete invitation when the private token is missing", async () => {
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    mocks.resume.mockResolvedValue({
      status: "join",
      mode: "partner",
      partnerType: "human",
      code: "PARTNER",
    });
    render(<App />);
    expect(
      await screen.findByText(DUO_MESSAGES.en.inviteRequired),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(mocks.claimPartnerSeat).not.toHaveBeenCalled();
  });
  it("creates a human mission with the chosen board language and a friend invitation", async () => {
    mocks.create.mockResolvedValue(leadSnapshot({ partnerType: "human" }));
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: DUO_MESSAGES.en.partnerMission }),
    );
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Lead" },
    });
    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    fireEvent.click(screen.getByRole("button", { name: "Create room" }));

    expect(await screen.findByLabelText(en.missionMap)).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Lead",
      lang: "ar",
      mode: "partner",
      partnerType: "human",
      visibility: "private",
    });
    expect(
      screen.getByRole("button", { name: DUO_MESSAGES.en.copyAgentInvite }),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.copyAgentBriefing)).not.toBeInTheDocument();
    expect(screen.queryByText(en.waitingForPartner)).not.toBeInTheDocument();
  });

  it("joins by name, edits ordered guesses, enforces the limit, and locks once without WebMCP", async () => {
    const registerTool = vi.fn();
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool },
    });
    window.history.replaceState(
      null,
      "",
      "/play/?room=PARTNER#invite=private-agent-token",
    );
    mocks.resume.mockResolvedValue({
      status: "join",
      mode: "partner",
      partnerType: "human",
      code: "PARTNER",
    });
    const waiting = fieldSnapshot({ partnerType: "human" });
    mocks.claimPartnerSeat.mockResolvedValue(waiting);
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Your name"), {
      target: { value: "Friend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(
      await screen.findByLabelText(en.publicMissionBoard),
    ).toBeInTheDocument();
    expect(mocks.claimPartnerSeat).toHaveBeenCalledWith({
      code: "PARTNER",
      name: "Friend",
      inviteToken: "private-agent-token",
    });
    expect(screen.getByRole("button", { name: "Word 1" })).toBeDisabled();
    expect(screen.queryByText(en.webMcpRequired)).not.toBeInTheDocument();

    const turn = fieldSnapshot({
      partnerType: "human",
      version: 3,
      view: {
        phase: "field_agent_turn",
        signal: { word: "orbit", count: 2 },
        maxGuesses: 3,
        turnNumber: 1,
      },
    });
    act(() => mocks.onChange?.(turn));
    const card = (n: number) =>
      screen.getByRole("button", { name: `Word ${n}` });
    const lock = screen.getByRole("button", {
      name: DUO_MESSAGES.en.lockGuesses,
    });
    expect(lock).toBeDisabled();
    fireEvent.click(card(2));
    fireEvent.click(card(1));
    fireEvent.click(card(3));
    expect(card(4)).toBeDisabled();
    expect(card(2)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(card(2));
    expect(card(4)).toBeEnabled();
    fireEvent.click(card(2));
    expect(document.querySelector('[data-card-id="c02"]')).toHaveTextContent(
      "3",
    );
    fireEvent.click(
      screen.getByRole("button", { name: DUO_MESSAGES.en.clearSelection }),
    );
    expect(lock).toBeDisabled();
    fireEvent.click(card(2));
    fireEvent.click(card(1));

    let finish!: (value: PartnerRoomSnapshot) => void;
    mocks.mutate.mockReturnValue(
      new Promise<PartnerRoomSnapshot>((resolve) => {
        finish = resolve;
      }),
    );
    fireEvent.click(lock);
    fireEvent.click(lock);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledWith(turn.id, 3, {
      type: "lockGuesses",
      cardIds: ["c02", "c01"],
    });
    expect(card(3)).toBeDisabled();
    await act(async () =>
      finish(
        fieldSnapshot({
          partnerType: "human",
          version: 4,
          view: {
            ...turn.view,
            phase: "locked",
            lockedCardIds: ["c02", "c01"],
          },
        }),
      ),
    );
    expect(screen.getByText(en.orderedGuesses)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: DUO_MESSAGES.en.lockGuesses }),
    ).not.toBeInTheDocument();
    expect(registerTool).not.toHaveBeenCalled();

    act(() =>
      mocks.onChange?.(
        fieldSnapshot({
          partnerType: "human",
          version: 6,
          view: { ...turn.view, turnNumber: 2 },
        }),
      ),
    );
    expect(
      screen.getByRole("button", { name: DUO_MESSAGES.en.lockGuesses }),
    ).toBeDisabled();
    expect(card(2)).toHaveAttribute("aria-pressed", "false");
  });

  it("resumes human controls after refresh and lets a failed lock be retried", async () => {
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    const turn = fieldSnapshot({
      partnerType: "human",
      version: 3,
      view: {
        phase: "field_agent_turn",
        signal: { word: "orbit", count: 1 },
        maxGuesses: 2,
      },
    });
    mocks.resume.mockResolvedValue({ status: "active", room: turn });
    mocks.mutate.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Word 1" }));
    fireEvent.click(
      screen.getByRole("button", { name: DUO_MESSAGES.en.lockGuesses }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Word 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: DUO_MESSAGES.en.lockGuesses }),
    ).toBeEnabled();
    mocks.mutate.mockResolvedValue(
      fieldSnapshot({
        partnerType: "human",
        version: 4,
        view: { ...turn.view, phase: "locked", lockedCardIds: ["c01"] },
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: DUO_MESSAGES.en.lockGuesses }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });
});

beforeEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/play/");
  localStorage.clear();
  mocks.resume.mockReset();
  mocks.create.mockReset();
  mocks.join.mockReset();
  mocks.claimPartnerSeat.mockReset();
  mocks.load.mockReset();
  mocks.mutate.mockReset();
  mocks.getInviteToken.mockReset().mockReturnValue("private-agent-token");
  mocks.clearRoomStorage.mockReset();
  mocks.onChange = undefined;
  mocks.subscribe.mockReset().mockImplementation((_roomId, onChange) => {
    mocks.onChange = onChange;
    return vi.fn();
  });
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContext");
});

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContext");
});

describe("AI Partner Mission App integration", () => {
  it("creates a private Partner Mission with the human as Mission Lead", async () => {
    mocks.create.mockResolvedValue(leadSnapshot());
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: en.partnerMission }));
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Lead" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create room" }));

    expect(await screen.findByLabelText(en.missionMap)).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Lead",
      lang: "en",
      mode: "partner",
      visibility: "private",
    });
    expect(screen.getByText(en.fieldAgentSeat)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-card-id]")).toHaveLength(25);
  });

  it("runs invite, dynamic WebMCP registration, and visible ordered locking", async () => {
    const registrations: Array<{
      tool: RegisteredTool;
      signal: AbortSignal;
    }> = [];
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: vi.fn(
          async (tool: RegisteredTool, options: { signal: AbortSignal }) => {
            registrations.push({ tool, signal: options.signal });
          },
        ),
      },
    });
    window.history.replaceState(
      null,
      "",
      "/play/?room=PARTNER#invite=private-agent-token",
    );
    mocks.resume.mockResolvedValue({
      status: "join",
      code: "PARTNER",
      mode: "partner",
    });
    const waiting = fieldSnapshot();
    mocks.claimPartnerSeat.mockResolvedValue(waiting);

    const { container } = render(<App />);

    await waitFor(() =>
      expect(registrations.map(({ tool }) => tool.name)).toEqual([
        "choose_name",
      ]),
    );
    const chooseRegistration = registrations[0];
    const chooseResult = await act(() =>
      chooseRegistration.tool.execute({ name: "Cipher" }),
    );

    expect(chooseResult).toMatchObject({
      joined: true,
      name: "Cipher",
      role: "Field Agent",
    });
    expect(mocks.claimPartnerSeat).toHaveBeenCalledWith({
      code: "PARTNER",
      name: "Cipher",
      inviteToken: "private-agent-token",
    });
    expect(window.location.href).toBe("http://localhost/play/?room=PARTNER");
    await waitFor(() => expect(chooseRegistration.signal.aborted).toBe(true));
    await waitFor(() =>
      expect(latestTool(registrations, "inspect_mission")).toBeDefined(),
    );

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-card-id]"),
    );
    expect(cards).toHaveLength(25);
    expect(cards.map((card) => card.textContent)).not.toContain("target");
    expect(container.innerHTML).not.toContain('data-result="target"');

    const turn = fieldSnapshot({
      version: 3,
      view: {
        ...waiting.view,
        phase: "field_agent_turn",
        signal: { word: "orbit", count: 2 },
        maxGuesses: 3,
      },
    });
    act(() => mocks.onChange?.(turn));
    await waitFor(() =>
      expect(latestTool(registrations, "submit_guesses")).toBeDefined(),
    );

    const locked = fieldSnapshot({
      version: 4,
      view: {
        ...turn.view,
        phase: "locked",
        lockedCardIds: ["c01", "c02"],
      },
    });
    mocks.mutate.mockResolvedValue(locked);
    const submit = latestTool(registrations, "submit_guesses");
    const submitResult = await act(() =>
      submit.execute({ card_ids: ["c01", "c02"] }),
    );

    expect(submitResult).toEqual({
      accepted: true,
      locked_count: 2,
      next: "Your guesses are locked. Watch the mission reveal.",
    });
    expect(mocks.mutate).toHaveBeenCalledWith(waiting.id, 3, {
      type: "lockGuesses",
      cardIds: ["c01", "c02"],
    });
    expect(await screen.findByLabelText("Guess 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Guess 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        registrations
          .filter(({ tool }) => tool.name === "submit_guesses")
          .at(-1)?.signal.aborted,
      ).toBe(true),
    );
  });

  it("shows an actionable unsupported state without WebMCP", async () => {
    window.history.replaceState(
      null,
      "",
      "/play/?room=PARTNER#invite=private-agent-token",
    );
    mocks.resume.mockResolvedValue({
      status: "join",
      code: "PARTNER",
      mode: "partner",
    });

    render(<App />);

    expect(await screen.findByText(en.webMcpUnavailable)).toBeInTheDocument();
    expect(screen.getByText(en.webMcpRequired)).toBeInTheDocument();
    expect(mocks.claimPartnerSeat).not.toHaveBeenCalled();
  });

  it("installs the ordered reveal mask in the same authoritative update", async () => {
    const locked = fieldSnapshot({
      version: 4,
      view: {
        phase: "locked",
        signal: { word: "orbit", count: 2 },
        maxGuesses: 3,
        lockedCardIds: ["c01", "c02"],
      },
    });
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    mocks.resume.mockResolvedValue({ status: "active", room: locked });
    render(<App />);
    expect(
      await screen.findByText(en.guessesLocked("Cipher", 2)),
    ).toBeInTheDocument();

    const publicConcepts = concepts();
    const resolved = fieldSnapshot({
      version: 5,
      view: {
        phase: "waiting_for_signal",
        signal: null,
        maxGuesses: null,
        targetsRemaining: 7,
        lockedCardIds: [],
        board: publicConcepts.map((concept, index) =>
          index === 0
            ? {
                id: concept.id,
                concept,
                revealed: true as const,
                result: "target" as const,
              }
            : index === 1
              ? {
                  id: concept.id,
                  concept,
                  revealed: true as const,
                  result: "decoy" as const,
                }
              : { id: concept.id, concept, revealed: false as const },
        ),
        previousTurn: {
          turnNumber: 1,
          signal: { word: "orbit", count: 2 },
          lockedCardIds: ["c01", "c02"],
          reveals: [
            { cardId: "c01", result: "target" },
            { cardId: "c02", result: "decoy" },
          ],
          stoppedBy: "decoy",
          fieldNote: null,
        },
      },
    });

    act(() => mocks.onChange?.(resolved));

    expect(screen.getByText(en.phaseLabel("locked"))).toBeInTheDocument();
    expect(screen.getByLabelText("Word 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Word 2")).toBeInTheDocument();
    expect(screen.queryByText(en.previousTurn)).not.toBeInTheDocument();
    expect(screen.getByLabelText(en.targetCount)).toHaveTextContent("8");
  });

  it("auto-resolves a Lead lock and publishes the authoritative result", async () => {
    const waiting = waitingLeadSnapshot();
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    mocks.resume.mockResolvedValue({ status: "active", room: waiting });
    mocks.mutate.mockResolvedValue(resolvedLeadSnapshot());
    render(<App />);
    await screen.findByRole("button", { name: en.sendSignal });

    vi.useFakeTimers();
    act(() => mocks.onChange?.(lockedLeadSnapshot()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(mocks.mutate).toHaveBeenCalledWith(waiting.id, 4, {
      type: "resolveLockedGuesses",
    });
    expect(screen.getByText(en.phaseLabel("locked"))).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_400);
    });
    expect(screen.getByText(en.previousTurn)).toBeInTheDocument();
    expect(screen.getByLabelText(en.signalWord)).toBeEnabled();
  });

  it("refreshes and converges when resolution reports a version conflict", async () => {
    const locked = lockedLeadSnapshot();
    const resolved = resolvedLeadSnapshot();
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    mocks.resume.mockResolvedValue({ status: "active", room: locked });
    mocks.mutate.mockRejectedValue(new Error("ROOM_VERSION_CONFLICT"));
    mocks.load.mockResolvedValue(resolved);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: en.revealNow }));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith(locked.id));
    expect(mocks.resume).toHaveBeenCalledTimes(1);

    await waitFor(
      () => {
        expect(screen.getByText(en.previousTurn)).toBeInTheDocument();
        expect(screen.getByLabelText(en.signalWord)).toBeEnabled();
      },
      { timeout: 2_500 },
    );
  });

  it("lets Reveal now retry from a refreshed lock and deduplicates in-flight resolution", async () => {
    const locked = lockedLeadSnapshot();
    const freshLock = lockedLeadSnapshot(5);
    const resolved = resolvedLeadSnapshot(6);
    let releaseFirst!: () => void;
    const firstAttempt = new Promise<never>((_resolve, reject) => {
      releaseFirst = () => reject(new Error("ROOM_VERSION_CONFLICT"));
    });
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    mocks.resume.mockResolvedValue({ status: "active", room: locked });
    mocks.mutate
      .mockReturnValueOnce(firstAttempt)
      .mockResolvedValueOnce(resolved);
    mocks.load.mockResolvedValue(freshLock);
    render(<App />);

    const reveal = await screen.findByRole("button", { name: en.revealNow });
    fireEvent.click(reveal);
    fireEvent.click(reveal);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);

    releaseFirst();
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith(locked.id));
    fireEvent.click(screen.getByRole("button", { name: en.revealNow }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    expect(mocks.mutate).toHaveBeenLastCalledWith(locked.id, 5, {
      type: "resolveLockedGuesses",
    });
  });

  it("finishes one persisted reveal sequence despite same-turn refreshes", async () => {
    const waiting = waitingLeadSnapshot();
    const resolved = resolvedLeadSnapshot();
    const sameTurnRefresh = resolvedLeadSnapshot(6);
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    mocks.resume.mockResolvedValue({ status: "active", room: waiting });
    render(<App />);
    await screen.findByRole("button", { name: en.sendSignal });

    vi.useFakeTimers();
    act(() => mocks.onChange?.(resolved));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    act(() => mocks.onChange?.(sameTurnRefresh));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_400);
    });

    expect(screen.getByText(en.previousTurn)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.revealNow })).toBeNull();
  });

  it("does not regress a resolved room to a late older locked snapshot", async () => {
    const waiting = waitingLeadSnapshot();
    window.history.replaceState(null, "", "/play/?room=PARTNER");
    mocks.resume.mockResolvedValue({ status: "active", room: waiting });
    render(<App />);
    await screen.findByRole("button", { name: en.sendSignal });

    act(() => mocks.onChange?.(resolvedLeadSnapshot()));
    act(() => mocks.onChange?.(lockedLeadSnapshot()));

    expect(screen.queryByText(en.revealCountdown(3))).toBeNull();
    expect(screen.getByText(en.revealingGuesses("Cipher"))).toBeInTheDocument();
  });
});

function latestTool(
  registrations: Array<{ tool: RegisteredTool }>,
  name: string,
): RegisteredTool {
  const registration = registrations
    .map(({ tool }) => tool)
    .filter((tool) => tool.name === name)
    .at(-1);
  if (!registration) {
    throw new Error(`Missing ${name}`);
  }
  return registration;
}

function concepts() {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `c${String(index + 1).padStart(2, "0")}`,
    en: `Word ${index + 1}`,
    ar: `كلمة ${index + 1}`,
  }));
}

function baseSnapshot() {
  return {
    mode: "partner" as const,
    id: "room-00000000-0000-4000-8000-000000000200",
    code: "PARTNER",
    hostId: "00000000-0000-4000-8000-000000000001",
    visibility: "private" as const,
    version: 1,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    inviteToken: "private-agent-token",
  };
}

function leadSnapshot(
  overrides: Omit<Partial<PartnerRoomSnapshot>, "view"> & {
    view?: Partial<PartnerMissionLeadView>;
  } = {},
): PartnerRoomSnapshot & {
  view: PartnerMissionLeadView;
} {
  const board = concepts().map((concept, index) => ({
    id: concept.id,
    concept,
    kind:
      index < 8
        ? ("target" as const)
        : index === 24
          ? ("trap" as const)
          : ("decoy" as const),
    revealed: false,
  }));
  const base = baseSnapshot();
  const view: PartnerMissionLeadView = {
    roomId: base.id,
    lang: "en",
    phase: "waiting_for_agent",
    viewerRole: "mission_lead",
    missionLeadName: "Lead",
    fieldAgentName: null,
    targetsRemaining: 8,
    signal: null,
    lockedCardIds: [],
    previousTurn: null,
    turnNumber: 0,
    maxGuesses: null,
    board,
    can: {
      claimFieldAgent: false,
      giveSignal: false,
      lockGuesses: false,
      resolveLockedGuesses: false,
    },
  };
  return {
    ...base,
    ...overrides,
    view: { ...view, ...(overrides.view ?? {}) },
  };
}

function waitingLeadSnapshot(version = 3) {
  return leadSnapshot({
    version,
    view: {
      phase: "waiting_for_signal",
      fieldAgentName: "Cipher",
      can: {
        claimFieldAgent: false,
        giveSignal: true,
        lockGuesses: false,
        resolveLockedGuesses: false,
      },
    },
  });
}

function lockedLeadSnapshot(version = 4) {
  return leadSnapshot({
    version,
    view: {
      phase: "locked",
      fieldAgentName: "Cipher",
      signal: { word: "orbit", count: 2 },
      lockedCardIds: ["c01", "c02"],
      turnNumber: 1,
      maxGuesses: 3,
      can: {
        claimFieldAgent: false,
        giveSignal: false,
        lockGuesses: false,
        resolveLockedGuesses: true,
      },
    },
  });
}

function resolvedLeadSnapshot(version = 5) {
  const locked = lockedLeadSnapshot(version);
  return leadSnapshot({
    version,
    view: {
      ...locked.view,
      phase: "waiting_for_signal",
      signal: null,
      targetsRemaining: 7,
      lockedCardIds: [],
      board: locked.view.board.map((card, index) =>
        index < 2 ? { ...card, revealed: true } : card,
      ),
      previousTurn: {
        turnNumber: 1,
        signal: { word: "orbit", count: 2 },
        lockedCardIds: ["c01", "c02"],
        reveals: [
          { cardId: "c01", result: "target" },
          { cardId: "c02", result: "decoy" },
        ],
        stoppedBy: "decoy",
        fieldNote: null,
      },
      can: {
        claimFieldAgent: false,
        giveSignal: true,
        lockGuesses: false,
        resolveLockedGuesses: false,
      },
    },
  });
}

function fieldSnapshot(
  overrides: Omit<Partial<PartnerRoomSnapshot>, "view"> & {
    view?: Partial<PartnerFieldAgentView>;
  } = {},
): PartnerRoomSnapshot & { view: PartnerFieldAgentView } {
  const base = baseSnapshot();
  const view: PartnerFieldAgentView = {
    roomId: base.id,
    lang: "en",
    phase: "waiting_for_signal",
    viewerRole: "field_agent",
    missionLeadName: "Lead",
    fieldAgentName: "Cipher",
    targetsRemaining: 8,
    signal: null,
    lockedCardIds: [],
    previousTurn: null,
    turnNumber: 0,
    maxGuesses: null,
    board: concepts().map((concept) => ({
      id: concept.id,
      concept,
      revealed: false,
    })),
    can: {
      claimFieldAgent: false,
      giveSignal: false,
      lockGuesses: false,
      resolveLockedGuesses: false,
    },
  };
  return {
    ...base,
    ...overrides,
    view: { ...view, ...(overrides.view ?? {}) },
  };
}
