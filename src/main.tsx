import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { setNeedRefresh, setOfflineReady } from "./lib/pwa/serviceWorker";
import "./styles/tokens.css";
import "./styles/theme.css";
import "./styles/globals.css";

// Only the game registers the service worker (scope `/play/`, see ADR-001).
// `registerType: "prompt"` (vite.config.ts) means updates never reload the
// page on their own — `updateSW(true)` only runs when the player confirms
// via the `UpdateToast`.
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => setNeedRefresh(() => updateSW(true)),
    onOfflineReady: setOfflineReady,
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
