import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { playUrl } from "../config/routes";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/globals.css";

// Placeholder shell — the real landing page lands in a follow-up change.
export function LandingPlaceholder() {
  return (
    <main className="cn-shell">
      <h1>Spymaster Mission</h1>
      <a href={playUrl()}>Play</a>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LandingPlaceholder />
  </StrictMode>,
);
