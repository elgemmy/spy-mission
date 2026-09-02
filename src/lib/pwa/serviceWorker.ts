import { useSyncExternalStore } from "react";

/**
 * Framework-agnostic store for service-worker update state (ADR-001 §4).
 *
 * This module does not import `virtual:pwa-register` — `src/main.tsx` wires
 * the real `registerSW` callbacks to the setters below, keeping this file
 * (and its tests) free of the Vite PWA virtual module.
 */

export interface ServiceWorkerStatus {
  needRefresh: boolean;
  offlineReady: boolean;
}

const listeners = new Set<() => void>();
let pendingUpdate: (() => Promise<void>) | null = null;
let snapshot: ServiceWorkerStatus = {
  needRefresh: false,
  offlineReady: false,
};

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: ServiceWorkerStatus): void {
  snapshot = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ServiceWorkerStatus {
  return snapshot;
}

/** Record that a new service worker is waiting; store the callback that activates it. */
export function setNeedRefresh(update: () => Promise<void>): void {
  pendingUpdate = update;
  setSnapshot({ ...snapshot, needRefresh: true });
}

/** Record that the app is ready to work offline (no UI required). */
export function setOfflineReady(): void {
  setSnapshot({ ...snapshot, offlineReady: true });
}

/** Dismiss the update toast without applying the pending update. */
export function dismissRefresh(): void {
  pendingUpdate = null;
  setSnapshot({ ...snapshot, needRefresh: false });
}

/** Apply the pending service-worker update, if one was recorded. */
export async function applyUpdate(): Promise<void> {
  const update = pendingUpdate;
  if (!update) {
    return;
  }
  pendingUpdate = null;
  setSnapshot({ ...snapshot, needRefresh: false });
  await update();
}

export function useServiceWorkerStatus(): ServiceWorkerStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
