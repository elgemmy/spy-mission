import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "../room";

const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  create: vi.fn(),
  join: vi.fn(),
  load: vi.fn(),
  mutate: vi.fn(),
  getInviteToken: vi.fn(),
  clearRoomStorage: vi.fn(),
  subscribe: vi.fn(),
  onChange: undefined as ((room: RoomSnapshot | null) => void) | undefined,
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

beforeEach(() => {
  window.history.replaceState(null, "", "/play/");
  localStorage.clear();
  mocks.resume.mockReset();
  mocks.create.mockReset();
  mocks.join.mockReset();
  mocks.load.mockReset();
  mocks.mutate.mockReset();
  mocks.getInviteToken.mockReset().mockReturnValue(null);
  mocks.clearRoomStorage.mockReset();
  mocks.onChange = undefined;
  mocks.subscribe.mockReset().mockImplementation((_roomId, onChange) => {
    mocks.onChange = onChange;
    return vi.fn();
  });
});

afterEach(() => {
  localStorage.clear();
});

describe("App room lifecycle", () => {
  it("opens /play/ at home, never restores storage, and removes the legacy key", async () => {
    localStorage.setItem("codenames.roomId", "obsolete-room");
    localStorage.setItem("codenames.localRooms.v1", "obsolete-snapshot");
    localStorage.setItem("codenames.localPlayerId.v2", "obsolete-player");

    render(<App />);

    expect(
      screen.getByRole("button", { name: "إنشاء غرفة جديدة" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem("codenames.roomId")).toBeNull(),
    );
    expect(localStorage.getItem("codenames.localRooms.v1")).toBeNull();
    expect(localStorage.getItem("codenames.localPlayerId.v2")).toBeNull();
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it("resumes an active membership from the room URL", async () => {
    window.history.replaceState(null, "", "/play/?room=testroom");
    mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });

    render(<App />);

    expect(await screen.findByText("TESTROOM")).toBeInTheDocument();
    expect(mocks.resume).toHaveBeenCalledWith("TESTROOM");
    expect(window.location.pathname + window.location.search).toBe(
      "/play/?room=TESTROOM",
    );
  });

  it("canonicalizes the URL after room creation", async () => {
    mocks.create.mockResolvedValue(snapshot());
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "إنشاء غرفة جديدة" }));
    fireEvent.change(screen.getByPlaceholderText("اسمك"), {
      target: { value: "Host" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء الغرفة" }));

    await screen.findByText("TESTROOM");
    expect(mocks.create).toHaveBeenCalledWith({ name: "Host", lang: "ar" });
    expect(window.location.pathname + window.location.search).toBe(
      "/play/?room=TESTROOM",
    );
  });

  it("joins a public room by code and canonicalizes the URL", async () => {
    mocks.join.mockResolvedValue(snapshot());
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "الانضمام برمز" }));
    fireEvent.change(screen.getByLabelText("رمز الغرفة"), {
      target: { value: "testroom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "متابعة" }));
    fireEvent.change(screen.getByPlaceholderText("اسمك"), {
      target: { value: "Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "الدخول للغرفة" }));

    await screen.findByText("TESTROOM");
    expect(mocks.join).toHaveBeenCalledWith({
      code: "TESTROOM",
      name: "Guest",
    });
    expect(window.location.pathname + window.location.search).toBe(
      "/play/?room=TESTROOM",
    );
  });

  it("uses only the private fragment token and strips it after joining", async () => {
    window.history.replaceState(
      null,
      "",
      "/play/?room=TESTROOM#invite=fragment-private-token",
    );
    mocks.resume.mockResolvedValue({ status: "join", code: "TESTROOM" });
    mocks.join.mockResolvedValue({
      ...snapshot(),
      visibility: "private",
    });

    render(<App />);

    const name = await screen.findByPlaceholderText("اسمك");
    fireEvent.change(name, { target: { value: "Guest" } });
    fireEvent.click(screen.getByRole("button", { name: "الدخول للغرفة" }));

    await waitFor(() =>
      expect(mocks.join).toHaveBeenCalledWith({
        code: "TESTROOM",
        name: "Guest",
        inviteToken: "fragment-private-token",
      }),
    );
    await screen.findByText("TESTROOM");
    expect(window.location.href).toBe("http://localhost/play/?room=TESTROOM");
  });

  it("does not treat an invite query parameter as a private token", async () => {
    window.history.replaceState(
      null,
      "",
      "/play/?room=TESTROOM&invite=query-token",
    );
    mocks.resume.mockResolvedValue({ status: "join", code: "TESTROOM" });
    mocks.join.mockResolvedValue(snapshot());

    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText("اسمك"), {
      target: { value: "Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "الدخول للغرفة" }));

    await waitFor(() =>
      expect(mocks.join).toHaveBeenCalledWith({
        code: "TESTROOM",
        name: "Guest",
      }),
    );
  });

  it("clears the pending room URL when backing out of a deep link", async () => {
    window.history.replaceState(
      null,
      "",
      "/play/?room=TESTROOM#invite=pending-token",
    );
    mocks.resume.mockResolvedValue({ status: "join", code: "TESTROOM" });

    render(<App />);
    await screen.findByPlaceholderText("اسمك");
    fireEvent.click(screen.getByRole("button", { name: "رجوع" }));

    await screen.findByRole("button", { name: "إنشاء غرفة جديدة" });
    expect(window.location.href).toBe("http://localhost/play/");
  });

  it("exits to home without mutating server membership", async () => {
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });
    render(<App />);
    await screen.findByText("TESTROOM");

    fireEvent.click(
      screen.getByRole("button", { name: "الخروج من هذه الشاشة" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "خروج" }));

    await screen.findByRole("button", { name: "إنشاء غرفة جديدة" });
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.clearRoomStorage).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe("/play/");
  });

  it("returns home and clears room storage when membership is revoked", async () => {
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });
    render(<App />);
    await screen.findByText("TESTROOM");

    act(() => mocks.onChange?.(null));

    await screen.findByRole("button", { name: "إنشاء غرفة جديدة" });
    expect(mocks.clearRoomStorage).toHaveBeenCalledWith(snapshot().id);
    expect(window.location.pathname + window.location.search).toBe("/play/");
  });

  it("clears URL and room storage after confirmed permanent leave", async () => {
    const guestRoom = snapshot({
      hostId: "00000000-0000-4000-8000-000000000099",
    });
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: guestRoom });
    mocks.mutate.mockResolvedValue({ left: true });
    render(<App />);
    await screen.findByText("TESTROOM");

    fireEvent.click(
      screen.getByRole("button", { name: "مغادرة الغرفة نهائيا" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "مغادرة" }));

    await screen.findByRole("button", { name: "إنشاء غرفة جديدة" });
    expect(mocks.mutate).toHaveBeenCalledWith(guestRoom.id, 1, {
      type: "leaveRoom",
    });
    expect(mocks.clearRoomStorage).toHaveBeenCalledWith(guestRoom.id);
    expect(window.location.pathname + window.location.search).toBe("/play/");
  });

  it("clears URL and room storage after confirmed host deletion", async () => {
    const hostRoom = snapshot();
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: hostRoom });
    mocks.mutate.mockResolvedValue({ deleted: true });
    render(<App />);
    await screen.findByText("TESTROOM");

    fireEvent.click(screen.getByRole("button", { name: "حذف الغرفة" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف" }));

    await screen.findByRole("button", { name: "إنشاء غرفة جديدة" });
    expect(mocks.mutate).toHaveBeenCalledWith(hostRoom.id, 1, {
      type: "deleteRoom",
    });
    expect(mocks.clearRoomStorage).toHaveBeenCalledWith(hostRoom.id);
    expect(window.location.pathname + window.location.search).toBe("/play/");
  });
});

function snapshot(
  options: {
    hostId?: string;
    playerId?: string;
  } = {},
): RoomSnapshot {
  const playerId = options.playerId ?? "00000000-0000-4000-8000-000000000001";
  const hostId = options.hostId ?? playerId;
  return {
    id: "room-00000000-0000-4000-8000-000000000000",
    code: "TESTROOM",
    hostId,
    visibility: "public",
    view: {
      roomId: "room-00000000-0000-4000-8000-000000000000",
      lang: "ar",
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
}
