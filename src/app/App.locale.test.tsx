import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "../room";
import { LandingPage } from "../landing/LandingPage";
import { MESSAGES } from "../locale/messages";
import { UI_LOCALE_STORAGE_KEY } from "../locale/uiLocale";

const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  create: vi.fn(),
  join: vi.fn(),
  load: vi.fn(),
  mutate: vi.fn(),
  getInviteToken: vi.fn(),
  clearRoomStorage: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("../room", async () => {
  const actual = await vi.importActual<typeof import("../room")>("../room");
  return {
    ...actual,
    getRoomProvider: () => ({
      resume: mocks.resume,
      create: mocks.create,
      join: mocks.join,
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

const en = MESSAGES.en.play;
const ar = MESSAGES.ar.play;

const LEGACY_ENGLISH = [
  /\bCodenames?\b/i,
  /Spymaster/i,
  /\bOperative\b/,
  /\bAssassin\b/,
  /\bClue\b/,
];

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  const playerId = "00000000-0000-4000-8000-000000000001";
  const base: RoomSnapshot = {
    id: "room-00000000-0000-4000-8000-000000000000",
    code: "TESTROOM",
    hostId: playerId,
    visibility: "public",
    view: {
      roomId: "room-00000000-0000-4000-8000-000000000000",
      lang: "en",
      phase: "lobby",
      board: [],
      turn: "red",
      clue: null,
      redRemaining: 0,
      blueRemaining: 0,
      guessesRemaining: null,
      winner: null,
      me: { id: playerId, team: "red", role: "operative" },
      players: [
        {
          id: playerId,
          name: "Host",
          team: "red",
          role: "operative",
        },
      ],
      can: {
        joinRoom: false,
        assignSelf: true,
        setLang: true,
        startGame: false,
        giveClue: false,
        guess: false,
        endTurn: false,
      },
    },
    ui: { votes: {}, clueLog: [], banners: [] },
    version: 1,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
  return {
    ...base,
    ...overrides,
    view: {
      ...base.view,
      ...(overrides.view ?? {}),
    },
  };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/play/");
  localStorage.clear();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  mocks.resume.mockReset();
  mocks.create.mockReset();
  mocks.join.mockReset();
  mocks.load.mockReset();
  mocks.mutate.mockReset();
  mocks.getInviteToken.mockReset().mockReturnValue(null);
  mocks.clearRoomStorage.mockReset();
  mocks.subscribe.mockReset().mockImplementation(() => vi.fn());
});

afterEach(() => {
  localStorage.clear();
});

describe("Spy Mission locale runtime", () => {
  it("uses English as the fresh locale on landing and play", () => {
    const landing = render(<LandingPage />);
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "25 words.",
    );
    landing.unmount();

    render(<App />);
    expect(screen.getByRole("button", { name: en.createRoom })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps a persisted Arabic UI locale from landing into the game", () => {
    const { unmount } = render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: "عربي" }));
    expect(localStorage.getItem(UI_LOCALE_STORAGE_KEY)).toBe("ar");
    unmount();

    render(<App />);
    expect(screen.getByRole("button", { name: ar.createRoom })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("creates a fresh room with English board language", async () => {
    mocks.create.mockResolvedValue(snapshot());
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: en.createRoom }));
    fireEvent.change(screen.getByLabelText(en.nameLabel), {
      target: { value: "Host" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.createSubmit }));
    await screen.findByText("TESTROOM");
    expect(mocks.create).toHaveBeenCalledWith({ name: "Host", lang: "en" });
    expect(
      within(screen.getByLabelText(en.boardLanguage)).getByRole("button", {
        name: en.boardLanguageEn,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps board language independent from the UI locale", async () => {
    mocks.create.mockResolvedValue(snapshot());
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: en.createRoom }));
    fireEvent.change(screen.getByLabelText(en.nameLabel), {
      target: { value: "Host" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.createSubmit }));
    await screen.findByText("TESTROOM");

    const boardGroup = screen.getByLabelText(en.boardLanguage);
    expect(
      within(boardGroup).getByRole("button", { name: en.boardLanguageEn }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "عربي" }));
    expect(document.documentElement.lang).toBe("ar");
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(
      within(screen.getByLabelText(ar.boardLanguage)).getByRole("button", {
        name: ar.boardLanguageEn,
      }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      within(screen.getByLabelText(ar.boardLanguage)).getByRole("button", {
        name: ar.boardLanguageAr,
      }),
    );
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        snapshot().id,
        1,
        { type: "setLang", lang: "ar" },
      ),
    );
    expect(document.documentElement.lang).toBe("ar");
  });

  it("renders core play chrome in both locales", async () => {
    mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });
    window.history.replaceState(null, "", "/play/?room=TESTROOM");

    const first = render(<App />);
    expect(await screen.findByText(en.productName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.startRound })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(en.startNeedSeats);
    first.unmount();

    localStorage.setItem(UI_LOCALE_STORAGE_KEY, "ar");
    render(<App />);
    expect(await screen.findByText(ar.productName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ar.startRound })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(ar.startNeedSeats);
  });

  it("keeps rendered English landing and play surfaces on public terminology", async () => {
    mocks.create.mockResolvedValue(snapshot());
    const landing = render(<LandingPage />);
    const landingText = landing.container.textContent ?? "";
    for (const term of LEGACY_ENGLISH) {
      expect(landingText).not.toMatch(term);
    }
    landing.unmount();

    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: en.createRoom }));
    fireEvent.change(screen.getByLabelText(en.nameLabel), {
      target: { value: "Host" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.createSubmit }));
    await screen.findByText("TESTROOM");

    const playText = container.textContent ?? "";
    for (const term of LEGACY_ENGLISH) {
      expect(playText).not.toMatch(term);
    }
    expect(landingText).toContain("Spy Mission");
    expect(playText).toContain("Spy Mission");
    expect(playText).toContain("Mission Lead");
    expect(playText).toContain("Field Agent");
  });

  it("explains why Start is disabled", async () => {
    mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    render(<App />);
    await screen.findByText("TESTROOM");

    const start = screen.getByRole("button", { name: en.startRound });
    expect(start).toBeDisabled();
    expect(start).toHaveAttribute("aria-describedby", "start-readiness");
    expect(screen.getByRole("status")).toHaveTextContent(en.startNeedSeats);
    expect(screen.getByRole("status")).toHaveTextContent("Red");
    expect(screen.getByRole("status")).toHaveTextContent("Blue");
  });

  it("opens the create-name step from /play/?create=1", () => {
    window.history.replaceState(null, "", "/play/?create=1");
    render(<App />);
    expect(screen.getByLabelText(en.nameLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.createSubmit }),
    ).toBeInTheDocument();
  });

  it("shows a visible pending label while creating a room", async () => {
    mocks.create.mockImplementation(() => new Promise(() => undefined));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: en.createRoom }));
    fireEvent.change(screen.getByLabelText(en.nameLabel), {
      target: { value: "Host" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.createSubmit }));
    expect(
      screen.getByRole("button", { name: en.createPending }),
    ).toBeDisabled();
  });

  it("shows a visible pending label while joining a room", async () => {
    mocks.join.mockImplementation(() => new Promise(() => undefined));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: en.joinByCode }));
    fireEvent.change(screen.getByLabelText(en.roomCodeLabel), {
      target: { value: "TESTROOM" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.continue }));
    fireEvent.change(screen.getByLabelText(en.nameLabel), {
      target: { value: "Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.joinSubmit }));
    expect(screen.getByRole("button", { name: en.joinPending })).toBeDisabled();
  });
});
