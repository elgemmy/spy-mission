import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DEBUG_PORT = Number(process.env.PLAY_SPYMISSION_PORT ?? 9222);
const CACHE =
  process.env.PLAY_SPYMISSION_HOME ?? join(homedir(), ".cache/play-spymission");
const USER_DATA = join(CACHE, "chrome-profile");
const INVITE_URL = process.argv[2];

function isSpyMissionInvite(value) {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "spymission.dev" &&
      parsed.pathname.startsWith("/play/")
    );
  } catch {
    return false;
  }
}

if (!INVITE_URL || !isSpyMissionInvite(INVITE_URL)) {
  console.error(
    "Usage: launch.mjs https://spymission.dev/play/?room=...#invite=...",
  );
  process.exit(1);
}

async function debugReady() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  if (!res.ok) throw new Error("not ready");
  return res.json();
}

try {
  const info = await debugReady();
  const opened = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(INVITE_URL)}`,
    { method: "PUT" },
  );
  if (!opened.ok) throw new Error("unable to open the invitation");
  console.log(JSON.stringify({ ok: true, reused: true, info }, null, 2));
  process.exit(0);
} catch {
  // Launch a dedicated WebMCP Chrome.
}

const chromeCandidates = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const chromeBin =
  process.env.PLAY_SPYMISSION_CHROME ??
  chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromeBin) {
  console.error(
    "Chrome was not found. Set PLAY_SPYMISSION_CHROME to its executable path.",
  );
  process.exit(1);
}
const chrome = spawn(
  chromeBin,
  [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA}`,
    "--enable-features=WebMCP,DevToolsWebMCPSupport,WebMCPTesting",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--new-window",
    INVITE_URL,
  ],
  { detached: true, stdio: "ignore" },
);
chrome.unref();

for (let i = 0; i < 40; i++) {
  try {
    const info = await debugReady();
    console.log(
      JSON.stringify(
        { ok: true, reused: false, pid: chrome.pid, info },
        null,
        2,
      ),
    );
    process.exit(0);
  } catch {
    await delay(250);
  }
}

console.error("Chrome debug port did not come up");
process.exit(1);
