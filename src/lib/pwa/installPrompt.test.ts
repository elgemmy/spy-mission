import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "./installPrompt";

type Outcome = "accepted" | "dismissed";

function makeBeforeInstallPromptEvent(outcome: Outcome = "accepted") {
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
  return event;
}

function fireBeforeInstallPrompt(outcome: Outcome = "accepted") {
  const event = makeBeforeInstallPromptEvent(outcome);
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  // Clear any event still held by the module-level capture.
  act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
});

describe("useInstallPrompt", () => {
  it("cannot prompt before the browser offers an install event", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(false);
  });

  it("flips canPrompt when beforeinstallprompt is captured", () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = fireBeforeInstallPrompt();

    expect(result.current.canPrompt).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("captures events fired before the hook mounts", () => {
    fireBeforeInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(true);
  });

  it("returns the user's choice and consumes the event", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = fireBeforeInstallPrompt("accepted");

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.prompt();
    });

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe("accepted");
    expect(result.current.canPrompt).toBe(false);
  });

  it("reports a dismissed choice", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt("dismissed");

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.prompt();
    });

    expect(outcome).toBe("dismissed");
  });

  it("reports 'unavailable' when there is nothing to prompt with", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.prompt();
    });

    expect(outcome).toBe("unavailable");
  });

  it("clears the captured event on appinstalled", () => {
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    expect(result.current.canPrompt).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.canPrompt).toBe(false);
  });

  it("does not clobber a newer event captured while a stale prompt settles", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let resolveUserChoice!: (value: {
      outcome: Outcome;
      platform: string;
    }) => void;
    const pendingChoice = new Promise<{ outcome: Outcome; platform: string }>(
      (resolve) => {
        resolveUserChoice = resolve;
      },
    );
    const eventA = makeBeforeInstallPromptEvent();
    eventA.userChoice = pendingChoice;
    act(() => {
      window.dispatchEvent(eventA);
    });

    let promptPromise: Promise<string> | undefined;
    act(() => {
      promptPromise = result.current.prompt();
    });

    // A newer event replaces the stale one while A's prompt is still pending.
    const eventB = fireBeforeInstallPrompt("accepted");

    await act(async () => {
      resolveUserChoice({ outcome: "accepted", platform: "web" });
      await promptPromise;
    });

    // B must be preserved, not cleared by A's stale finally.
    expect(result.current.canPrompt).toBe(true);
    expect(eventB.prompt).not.toHaveBeenCalled();
  });

  it("reports display mode and platform", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isStandalone).toBe(false);
    expect(["ios", "android", "desktop", "other"]).toContain(
      result.current.platform,
    );
  });
});
