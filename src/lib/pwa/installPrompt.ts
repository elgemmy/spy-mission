import { useCallback, useSyncExternalStore } from "react";

/**
 * `beforeinstallprompt` is a Chromium-only event and is not in `lib.dom`.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";
export type InstallPlatform = "ios" | "android" | "desktop" | "other";

export interface InstallPromptState {
  canPrompt: boolean;
  prompt: () => Promise<InstallOutcome>;
  isStandalone: boolean;
  platform: InstallPlatform;
}

const listeners = new Set<() => void>();
let deferredEvent: BeforeInstallPromptEvent | null = null;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setDeferredEvent(event: BeforeInstallPromptEvent | null): void {
  if (deferredEvent === event) {
    return;
  }
  deferredEvent = event;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getCanPrompt(): boolean {
  return deferredEvent !== null;
}

// The event fires early — capture it at module load, before React mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredEvent(event as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => {
    setDeferredEvent(null);
  });
}

/** Trigger the deferred browser install prompt, if one was captured. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferredEvent;
  if (!event) {
    return "unavailable";
  }

  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  } finally {
    // A deferred event can only be used once — but only clear it if it's
    // still the one we prompted. A newer `beforeinstallprompt` may have
    // replaced it while this prompt was pending.
    if (deferredEvent === event) {
      setDeferredEvent(null);
    }
  }
}

/** True when the document is running as an installed app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const standaloneMedia =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}

/** Coarse platform bucket, used to pick install instructions. */
export function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") {
    return "other";
  }

  const ua = navigator.userAgent;
  const isIpadOS = /Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIpadOS) {
    return "ios";
  }
  if (/Android/i.test(ua)) {
    return "android";
  }
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) {
    return "desktop";
  }
  return "other";
}

export function useInstallPrompt(): InstallPromptState {
  const canPrompt = useSyncExternalStore(subscribe, getCanPrompt, () => false);
  const prompt = useCallback(() => promptInstall(), []);

  return {
    canPrompt,
    prompt,
    isStandalone: isStandaloneDisplay(),
    platform: detectPlatform(),
  };
}
