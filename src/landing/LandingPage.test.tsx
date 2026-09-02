import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playHostLabel, playUrl } from "../config/routes";
import { LandingPage } from "./LandingPage";
import { STR } from "./strings";
import { LANG_STORAGE_KEY } from "./useLang";

type Outcome = "accepted" | "dismissed";

function fireBeforeInstallPrompt(outcome: Outcome = "accepted") {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as Event & {
    platforms: readonly string[];
    userChoice: Promise<{ outcome: Outcome; platform: string }>;
    prompt: () => Promise<void>;
  };
  event.platforms = ["web"];
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  event.prompt = vi.fn(async () => undefined);
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const realLocation = window.location;
let assign: ReturnType<typeof vi.fn>;

function stubLocation() {
  assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...realLocation,
      host: realLocation.host,
      href: realLocation.href,
      assign,
    },
  });
}

function region(container: HTMLElement, selector: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`missing ${selector}`);
  }
  return element;
}

function chipCount(root: HTMLElement, role: "red" | "blue"): string {
  return (
    region(root, `[data-role="${role}"] span:last-child`).textContent ?? ""
  );
}

beforeEach(() => {
  localStorage.clear();
  stubLocation();
});

afterEach(() => {
  // Drop any install event still held by the module-level capture.
  act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
  Object.defineProperty(window, "location", {
    configurable: true,
    value: realLocation,
  });
  localStorage.clear();
});

describe("LandingPage", () => {
  it("renders Arabic right-to-left by default", () => {
    render(<LandingPage />);

    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "٢٥ كلمة.",
    );
  });

  it("switches to English, persists the choice and reads it back", () => {
    const { unmount } = render(<LandingPage />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "25 words.",
    );

    unmount();
    render(<LandingPage />);

    expect(document.documentElement.dir).toBe("ltr");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "25 words.",
    );
  });

  it("points every game link at /play/ via routes.ts", () => {
    render(<LandingPage />);

    const createLinks = screen.getAllByRole("link", { name: STR.ar.play });
    expect(createLinks).toHaveLength(3);
    for (const link of createLinks) {
      expect(link).toHaveAttribute("href", playUrl({ create: true }));
    }

    const hostLabel = playHostLabel(realLocation.host);
    const hostLinks = screen.getAllByRole("link", { name: hostLabel });
    expect(hostLinks.length).toBeGreaterThanOrEqual(3);
    for (const link of hostLinks) {
      expect(link).toHaveAttribute("href", playUrl());
    }
  });

  it("plays the hero mini board and resets it", () => {
    const { container } = render(<LandingPage />);
    const board = region(container, ".cn-lp-miniboard");
    const head = region(container, ".cn-lp-miniboard__head");

    expect(chipCount(head, "red")).toBe("9");
    expect(chipCount(head, "blue")).toBe("8");

    // Index 0 of LAYOUT is a red tile.
    const tile = within(board).getByRole("button", { name: "قطار" });
    fireEvent.click(tile);

    expect(chipCount(head, "red")).toBe("8");
    expect(chipCount(head, "blue")).toBe("8");
    expect(within(board).getByRole("button", { name: "قطار" })).toBeDisabled();

    fireEvent.click(within(board).getByRole("button", { name: STR.ar.reset }));

    expect(chipCount(head, "red")).toBe("9");
    expect(
      within(board).getByRole("button", { name: "قطار" }),
    ).not.toBeDisabled();
  });

  it("copies the room code and switches the lobby language", () => {
    const { container } = render(<LandingPage />);
    const lobby = region(container, ".cn-lp-lobby");

    expect(lobby).toHaveAttribute("dir", "rtl");

    fireEvent.click(
      within(lobby).getByRole("button", { name: STR.ar.lobby.copy }),
    );
    expect(
      within(lobby).getByRole("button", { name: STR.ar.lobby.copied }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(lobby).getByRole("button", { name: STR.ar.lobby.boardLangEn }),
    );

    expect(region(container, ".cn-lp-lobby")).toHaveAttribute("dir", "ltr");
  });

  it("starts the in-game preview from the pre-revealed key", () => {
    const { container } = render(<LandingPage />);
    const board = region(container, ".cn-lp-board");
    const top = region(container, ".cn-lp-board__top");

    // 9 red − 2 revealed, 8 blue − 1 revealed.
    expect(chipCount(top, "red")).toBe("7");
    expect(chipCount(top, "blue")).toBe("7");

    // Index 6 of LAYOUT is a hidden red tile.
    fireEvent.click(within(board).getByRole("button", { name: "شمس" }));

    expect(chipCount(top, "red")).toBe("6");
    expect(chipCount(top, "blue")).toBe("7");
  });

  describe("install button", () => {
    it("falls back to the in-game install sheet", async () => {
      render(<LandingPage />);

      const button = screen.getByRole("button", { name: STR.ar.install });
      await act(async () => {
        fireEvent.click(button);
      });

      expect(assign).toHaveBeenCalledWith(playUrl({ install: true }));
    });

    it("uses a captured browser prompt when there is one", async () => {
      render(<LandingPage />);
      const event = fireBeforeInstallPrompt();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: STR.ar.install }));
      });

      expect(event.prompt).toHaveBeenCalledOnce();
      expect(assign).not.toHaveBeenCalled();
    });

    it("is hidden when the game is already installed", () => {
      const matchMedia = vi.fn((query: string) => ({
        matches: query.includes("standalone"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
      const original = window.matchMedia;
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: matchMedia,
      });

      try {
        render(<LandingPage />);
        expect(
          screen.queryByRole("button", { name: STR.ar.install }),
        ).not.toBeInTheDocument();
      } finally {
        Object.defineProperty(window, "matchMedia", {
          configurable: true,
          value: original,
        });
      }
    });
  });
});
