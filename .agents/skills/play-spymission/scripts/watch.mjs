import { createRequire } from "node:module";
import { readFileSync, unlinkSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { selectSpyMissionPage } from "./select-page.mjs";
import { createMissionChangeDetector } from "./watch-state.mjs";

const CACHE =
  process.env.PLAY_SPYMISSION_HOME ?? join(homedir(), ".cache/play-spymission");
const STATE_PATH = join(CACHE, "last-mission.json");
const PID_PATH = join(CACHE, "watch.pid");
const DEBUG_PORT = process.env.PLAY_SPYMISSION_PORT ?? "9222";
const require = createRequire(join(CACHE, "package.json"));
const puppeteer = require("puppeteer-core");

function log(message) {
  console.error(`[watch] ${new Date().toISOString()} ${message}`);
}

function wake(prompt, extra = {}) {
  console.log(
    `AGENT_LOOP_WAKE_mission ${JSON.stringify({ prompt, ...extra })}`,
  );
}

async function claimWatcher() {
  try {
    const recorded = Number((await readFile(PID_PATH, "utf8")).trim());
    if (Number.isInteger(recorded) && recorded !== process.pid) {
      try {
        process.kill(recorded, 0);
        log(`already running pid=${recorded}`);
        process.exit(0);
      } catch {
        // Replace a stale PID file.
      }
    }
  } catch {
    // No prior watcher.
  }
  await writeFile(PID_PATH, `${process.pid}\n`);
}

async function releaseWatcher() {
  try {
    const recorded = (await readFile(PID_PATH, "utf8")).trim();
    if (recorded === String(process.pid)) {
      await unlink(PID_PATH);
    }
  } catch {
    // Already cleaned up.
  }
}

function releaseWatcherSync() {
  try {
    const recorded = readFileSync(PID_PATH, "utf8").trim();
    if (recorded === String(process.pid)) {
      unlinkSync(PID_PATH);
    }
  } catch {
    // Already cleaned up.
  }
}

let activeBrowser;
let stopping = false;

async function stop(code) {
  if (stopping) return;
  stopping = true;
  try {
    activeBrowser?.disconnect();
  } catch {
    // Ignore a browser that already disconnected.
  }
  await releaseWatcher();
  process.exit(code);
}

function stopFromSignal() {
  stopping = true;
  try {
    activeBrowser?.disconnect();
  } catch {
    // Ignore a browser that already disconnected.
  }
  releaseWatcherSync();
  process.exit(0);
}

process.once("exit", releaseWatcherSync);
process.once("SIGHUP", stopFromSignal);
process.once("SIGINT", stopFromSignal);
process.once("SIGTERM", stopFromSignal);

async function connect() {
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = selectSpyMissionPage(pages);
  if (!page) throw new Error("No Spy Mission play tab in Chrome");
  return { browser, page };
}

async function waitForTool(page, name, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tool = (page.webmcp?.tools?.() ?? []).find(
      (entry) => entry.name === name,
    );
    if (tool) return tool;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${name} is unavailable in the Spy Mission page`);
}

async function inspect(page, waitSeconds) {
  const tool = await waitForTool(page, "inspect_mission");
  const result = await tool.execute(
    waitSeconds > 0 ? { wait_seconds: waitSeconds } : {},
  );
  return result?.output ?? result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let activePageUrl = "";
let lastError = "";
const changeDetector = createMissionChangeDetector();

await claimWatcher();
log(`started pid=${process.pid}`);

while (!stopping) {
  try {
    const connected = await connect();
    activeBrowser = connected.browser;
    const { page } = connected;
    const pageUrl = page.url();

    if (pageUrl !== activePageUrl) {
      activePageUrl = pageUrl;
      changeDetector.reset();
    }
    lastError = "";

    while (!stopping) {
      const mission = await inspect(page, 8);
      if (!mission || typeof mission !== "object") {
        throw new Error("inspect_mission returned no public mission state");
      }

      await writeFile(
        STATE_PATH,
        JSON.stringify({ at: new Date().toISOString(), mission }, null, 2),
      );

      const {
        ended,
        newReveals: added,
        newSignal,
      } = changeDetector.observe(mission);

      if (added.length > 0 || newSignal || ended) {
        const extra = {
          phase: mission.phase,
          signal: mission.signal,
          max_guesses: mission.max_guesses,
          targets_remaining: mission.targets_remaining,
          new_reveals: added,
        };

        if (ended) {
          wake(
            "The game ended. Report the final result in friendly everyday English, then stop the watcher.",
            extra,
          );
          await stop(0);
        }

        if (newSignal && added.length > 0) {
          wake(
            "A reveal completed and a new Signal is active. Report the reveal, submit the strongest public-state guesses, and keep watching.",
            extra,
          );
        } else if (newSignal) {
          wake(
            "A Signal is active. Submit the strongest public-state guesses and keep watching.",
            extra,
          );
        } else {
          wake(
            "A reveal completed. Report the public results, then keep watching for the next Signal.",
            extra,
          );
        }
      }

      if (mission.phase !== "waiting_for_signal") {
        await sleep(1000);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`reconnect: ${message}`);
    try {
      activeBrowser?.disconnect();
    } catch {
      // Ignore a browser that already disconnected.
    }
    activeBrowser = undefined;
    if (message !== lastError) {
      lastError = message;
      wake("The Spy Mission browser or WebMCP connection needs attention.", {
        error: message,
      });
    }
    await sleep(2000);
  }
}

await releaseWatcher();
