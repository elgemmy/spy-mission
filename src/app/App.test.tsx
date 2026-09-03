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
  onChanges: [] as Array<(room: RoomSnapshot | null) => void>,
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
  mocks.onChanges = [];
  mocks.subscribe.mockReset().mockImplementation((_roomId, onChange) => {
    mocks.onChange = onChange;
    mocks.onChanges.push(onChange);
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

  it("disables duplicate cold-start room creation submissions", async () => {
    let resolveCreate: ((room: RoomSnapshot) => void) | undefined;
    mocks.create.mockImplementation(
      () =>
        new Promise<RoomSnapshot>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "إنشاء غرفة جديدة" }));
    fireEvent.change(screen.getByPlaceholderText("اسمك"), {
      target: { value: "Host" },
    });
    const submit = screen.getByRole("button", { name: "إنشاء الغرفة" });

    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    resolveCreate?.(snapshot());
    await screen.findByText("TESTROOM");
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

  it("disables duplicate cold-start join submissions", async () => {
    let resolveJoin: ((room: RoomSnapshot) => void) | undefined;
    mocks.join.mockImplementation(
      () =>
        new Promise<RoomSnapshot>((resolve) => {
          resolveJoin = resolve;
        }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "الانضمام برمز" }));
    fireEvent.change(screen.getByLabelText("رمز الغرفة"), {
      target: { value: "TESTROOM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "متابعة" }));
    fireEvent.change(screen.getByPlaceholderText("اسمك"), {
      target: { value: "Guest" },
    });
    const submit = screen.getByRole("button", { name: "الدخول للغرفة" });

    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mocks.join).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    resolveJoin?.(snapshot());
    await screen.findByText("TESTROOM");
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

  it("preserves a transient resume URL and invite until retry succeeds", async () => {
    window.history.replaceState(
      null,
      "",
      "/play/?room=TESTROOM#invite=stable-private-token",
    );
    mocks.resume
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ status: "active", room: snapshot() });

    render(<App />);

    expect(await screen.findByText(/تعذر الاتصال/)).toBeInTheDocument();
    expect(window.location.href).toBe(
      "http://localhost/play/?room=TESTROOM#invite=stable-private-token",
    );
    fireEvent.click(screen.getByRole("button", { name: "متابعة" }));

    await screen.findByText("TESTROOM");
    expect(mocks.resume).toHaveBeenCalledTimes(2);
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

  it("tears down dialogs, copied state, and pending room actions on revocation", async () => {
    let resolveMutation: ((room: RoomSnapshot) => void) | undefined;
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });
    mocks.mutate.mockImplementation(
      () =>
        new Promise<RoomSnapshot>((resolve) => {
          resolveMutation = resolve;
        }),
    );
    render(<App />);
    await screen.findByText("TESTROOM");
    fireEvent.click(screen.getByRole("button", { name: "نسخ الرابط" }));
    expect(
      screen.getByRole("button", { name: "تم النسخ" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تغيير الاسم" }));
    fireEvent.change(screen.getByLabelText("الاسم الجديد"), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    act(() => mocks.onChange?.(null));
    const create = await screen.findByRole("button", {
      name: "إنشاء غرفة جديدة",
    });
    expect(create).toBeEnabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    resolveMutation?.({ ...snapshot(), version: 2 });
    await act(async () => Promise.resolve());
    expect(create).toBeInTheDocument();
  });

  it("ignores a queued clipboard completion after room teardown", async () => {
    let resolveClipboard: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClipboard = resolve;
        }),
    );
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      window.history.replaceState(null, "", "/play/?room=TESTROOM");
      mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });
      render(<App />);
      await screen.findByText("TESTROOM");

      fireEvent.click(screen.getByRole("button", { name: "نسخ الرابط" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      act(() => mocks.onChange?.(null));
      await screen.findByRole("button", { name: "إنشاء غرفة جديدة" });

      await act(async () => {
        resolveClipboard?.();
        await Promise.resolve();
      });

      expect(
        screen.queryByRole("button", { name: "تم النسخ" }),
      ).not.toBeInTheDocument();
    } finally {
      if (descriptor) {
        Object.defineProperty(navigator, "clipboard", descriptor);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });

  it("clears a confirmation dialog through the same revocation teardown", async () => {
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: snapshot() });
    render(<App />);
    await screen.findByText("TESTROOM");
    fireEvent.click(screen.getByRole("button", { name: "حذف الغرفة" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    act(() => mocks.onChange?.(null));

    await screen.findByRole("button", { name: "إنشاء غرفة جديدة" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("ignores a stale room subscription after navigating to another room", async () => {
    const roomA = snapshot();
    const roomB = {
      ...snapshot(),
      id: "room-00000000-0000-4000-8000-000000000099",
      code: "ROOMB",
      view: {
        ...snapshot().view,
        roomId: "room-00000000-0000-4000-8000-000000000099",
      },
    };
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume
      .mockResolvedValueOnce({ status: "active", room: roomA })
      .mockResolvedValueOnce({ status: "active", room: roomB });
    render(<App />);
    await screen.findByText("TESTROOM");
    const staleRoomAChange = mocks.onChanges[0];

    window.history.pushState(null, "", "/play/?room=ROOMB");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await screen.findByText("ROOMB");
    act(() => staleRoomAChange?.(null));

    expect(screen.getByText("ROOMB")).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(
      "/play/?room=ROOMB",
    );
  });

  it("lets the host ban a player during an active game", async () => {
    const activeRoom = snapshot();
    activeRoom.view.phase = "clue";
    activeRoom.view.players.push({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Guest",
      team: "blue",
      role: "operative",
    });
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: activeRoom });
    mocks.mutate.mockResolvedValue({ ...activeRoom, version: 2 });
    render(<App />);
    await screen.findByText("Guest");

    fireEvent.click(screen.getByRole("button", { name: "حظر" }));
    fireEvent.click(
      screen.getByRole("alertdialog").querySelectorAll("button")[1]!,
    );

    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(activeRoom.id, 1, {
        type: "banPlayer",
        targetPlayerId: "00000000-0000-4000-8000-000000000002",
      }),
    );
  });

  it("disables private invite copying when this host lacks the plaintext token", async () => {
    const privateRoom = { ...snapshot(), visibility: "private" as const };
    window.history.replaceState(null, "", "/play/?room=TESTROOM");
    mocks.resume.mockResolvedValue({ status: "active", room: privateRoom });
    mocks.getInviteToken.mockReturnValue(null);
    render(<App />);

    expect(
      await screen.findByText("رابط الدعوة الخاص غير متاح في هذا المتصفح."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نسخ الرابط" })).toBeDisabled();
    expect(screen.queryByText("تجديد رابط الدعوة")).not.toBeInTheDocument();
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
