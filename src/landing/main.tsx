import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/globals.css";
import { LandingPage } from "./LandingPage";

const BOOT_FADE_MS = 400;

/** Fade the inline boot splash out once React has painted the page. */
function hideBootSplash(): void {
  const boot = document.getElementById("boot");
  if (!boot) {
    return;
  }
  requestAnimationFrame(() => {
    boot.classList.add("hide");
    window.setTimeout(() => boot.remove(), BOOT_FADE_MS);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);

hideBootSplash();
