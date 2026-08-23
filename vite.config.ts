/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Two HTML entries (ADR-001): the landing page at `/` and the game at `/play/`.
const landingEntry = fileURLToPath(new URL("./index.html", import.meta.url));
const playEntry = fileURLToPath(new URL("./play/index.html", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      // The service worker lives at `/sw.js` but only controls the game.
      scope: "/play/",
      // The game registers the SW itself via `virtual:pwa-register`, so the
      // plugin must not inject a register script into the landing page.
      injectRegister: null,
      includeAssets: [
        "favicon.svg",
        "pwa-icon.svg",
        "pwa-192.png",
        "pwa-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        id: "/play/",
        name: "Spymaster Mission",
        short_name: "Spymaster",
        description:
          "One clue. 25 words. Two teams. A family word-spy game in the browser — Arabic or English.",
        lang: "ar",
        dir: "rtl",
        start_url: "/play/",
        scope: "/play/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f1e8da",
        theme_color: "#2f2a24",
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,json}"],
        // Never precache or serve the landing page from the service worker.
        globIgnores: ["index.html", "assets/landing-*"],
        navigateFallback: "/play/index.html",
        navigateFallbackAllowlist: [/^\/play(\/|$)/],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        landing: landingEntry,
        play: playEntry,
      },
      output: {
        // Stable entry names so `globIgnores` can exclude the landing bundle.
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
