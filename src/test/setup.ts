import "@testing-library/jest-dom/vitest";

// Node >=22 defines its own `globalThis.localStorage` accessor, which resolves
// to `undefined` unless the process is started with `--localstorage-file`.
// Vitest's jsdom environment copies window properties onto the global object
// but skips any key that already exists there and is not on its own allow-list
// (`getWindowKeys`), so jsdom's Storage never reaches `window.localStorage`.
// Re-expose jsdom's implementation here.
const jsdomWindow = (
  globalThis as typeof globalThis & { jsdom?: { window: Window } }
).jsdom?.window;

for (const key of ["localStorage", "sessionStorage"] as const) {
  const storage = jsdomWindow?.[key];
  // Read via `jsdomWindow` only: touching `globalThis[key]` would trigger
  // Node's experimental-localStorage warning.
  if (storage) {
    Object.defineProperty(globalThis, key, {
      value: storage,
      configurable: true,
      writable: false,
    });
  }
}
