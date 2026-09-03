import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  applyUpdate,
  dismissRefresh,
  setNeedRefresh,
  setOfflineReady,
  useServiceWorkerStatus,
} from "./serviceWorker";

describe("useServiceWorkerStatus", () => {
  it("starts with no refresh needed and not offline-ready", () => {
    const { result } = renderHook(() => useServiceWorkerStatus());
    expect(result.current).toEqual({
      needRefresh: false,
      offlineReady: false,
    });
  });

  it("flips needRefresh when a new service worker is waiting", () => {
    const { result } = renderHook(() => useServiceWorkerStatus());

    act(() => {
      setNeedRefresh(vi.fn(async () => undefined));
    });

    expect(result.current.needRefresh).toBe(true);
  });

  it("flips offlineReady", () => {
    const { result } = renderHook(() => useServiceWorkerStatus());

    act(() => {
      setOfflineReady();
    });

    expect(result.current.offlineReady).toBe(true);
  });

  it("dismissRefresh clears needRefresh without applying the update", async () => {
    const update = vi.fn(async () => undefined);
    const { result } = renderHook(() => useServiceWorkerStatus());

    act(() => {
      setNeedRefresh(update);
    });
    expect(result.current.needRefresh).toBe(true);

    act(() => {
      dismissRefresh();
    });

    expect(result.current.needRefresh).toBe(false);
    await applyUpdate();
    expect(update).not.toHaveBeenCalled();
  });

  it("applyUpdate calls the stored update function and clears needRefresh", async () => {
    const update = vi.fn(async () => undefined);
    const { result } = renderHook(() => useServiceWorkerStatus());

    act(() => {
      setNeedRefresh(update);
    });

    await act(async () => {
      await applyUpdate();
    });

    expect(update).toHaveBeenCalledOnce();
    expect(result.current.needRefresh).toBe(false);
  });

  it("applyUpdate is a no-op when there is nothing pending", async () => {
    await expect(applyUpdate()).resolves.toBeUndefined();
  });
});
