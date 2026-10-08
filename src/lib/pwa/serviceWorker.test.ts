import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let serviceWorker: typeof import("./serviceWorker");

beforeEach(async () => {
  vi.resetModules();
  serviceWorker = await import("./serviceWorker");
});

describe("useServiceWorkerStatus", () => {
  it("starts with no refresh needed and not offline-ready", () => {
    const { result } = renderHook(() => serviceWorker.useServiceWorkerStatus());
    expect(result.current).toEqual({
      needRefresh: false,
      offlineReady: false,
    });
  });

  it("flips needRefresh when a new service worker is waiting", () => {
    const { result } = renderHook(() => serviceWorker.useServiceWorkerStatus());

    act(() => {
      serviceWorker.setNeedRefresh(vi.fn(async () => undefined));
    });

    expect(result.current.needRefresh).toBe(true);
  });

  it("flips offlineReady", () => {
    const { result } = renderHook(() => serviceWorker.useServiceWorkerStatus());

    act(() => {
      serviceWorker.setOfflineReady();
    });

    expect(result.current.offlineReady).toBe(true);
  });

  it("dismissRefresh clears needRefresh without applying the update", async () => {
    const update = vi.fn(async () => undefined);
    const { result } = renderHook(() => serviceWorker.useServiceWorkerStatus());

    act(() => {
      serviceWorker.setNeedRefresh(update);
    });
    expect(result.current.needRefresh).toBe(true);

    act(() => {
      serviceWorker.dismissRefresh();
    });

    expect(result.current.needRefresh).toBe(false);
    await serviceWorker.applyUpdate();
    expect(update).not.toHaveBeenCalled();
  });

  it("applyUpdate calls the stored update function and clears needRefresh", async () => {
    const update = vi.fn(async () => undefined);
    const { result } = renderHook(() => serviceWorker.useServiceWorkerStatus());

    act(() => {
      serviceWorker.setNeedRefresh(update);
    });

    await act(async () => {
      await serviceWorker.applyUpdate();
    });

    expect(update).toHaveBeenCalledOnce();
    expect(result.current.needRefresh).toBe(false);
  });

  it("applyUpdate is a no-op when there is nothing pending", async () => {
    await expect(serviceWorker.applyUpdate()).resolves.toBeUndefined();
  });
});
