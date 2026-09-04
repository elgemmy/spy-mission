import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createMissionChangeDetector } from "../.agents/skills/play-spymission/scripts/watch-state.mjs";

function mission(overrides = {}) {
  return {
    version: 1,
    phase: "waiting_for_signal",
    signal: null,
    cards: [{ id: "c1", word: "Moon", revealed: false }],
    ...overrides,
  };
}

function run(command, args, options) {
  return new Promise((resolveRun) => {
    const process = spawn(command, args, options);
    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    process.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    process.once("close", (status) => resolveRun({ status, stderr, stdout }));
  });
}

test("the watcher wakes once for each new Signal", () => {
  const detector = createMissionChangeDetector();
  const firstSignal = mission({
    version: 2,
    phase: "field_agent_turn",
    signal: { word: "space", count: 1 },
  });

  assert.equal(detector.observe(firstSignal).newSignal, true);
  assert.equal(detector.observe(firstSignal).newSignal, false);
  assert.equal(
    detector.observe({ ...firstSignal, version: 5 }).newSignal,
    true,
    "an identical Signal on a later turn is still meaningful",
  );
});

test("the watcher wakes after a reveal", () => {
  const detector = createMissionChangeDetector();
  detector.observe(mission());

  const change = detector.observe(
    mission({
      version: 2,
      cards: [{ id: "c1", word: "Moon", revealed: true, result: "target" }],
    }),
  );

  assert.deepEqual(change.newReveals, [
    { id: "c1", word: "Moon", result: "target" },
  ]);
});

test("the watcher reports terminal phases", () => {
  const detector = createMissionChangeDetector();
  assert.equal(detector.observe(mission({ phase: "won" })).ended, true);
  detector.reset();
  assert.equal(detector.observe(mission({ phase: "lost" })).ended, true);
});

test("the stop helper removes its PID record and stops only watch.mjs", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "play-spymission-stop-"));
  const fixture = join(temporary, "watch.mjs");
  const pidPath = join(temporary, "watch.pid");
  const stopPath = resolve(".agents/skills/play-spymission/scripts/stop.sh");
  await writeFile(fixture, "setInterval(() => {}, 1000);\n");
  const child = spawn(process.execPath, [fixture], { stdio: "ignore" });

  try {
    await writeFile(pidPath, `${child.pid}\n`);
    const stopped = await run("bash", [stopPath], {
      encoding: "utf8",
      env: { ...process.env, PLAY_SPYMISSION_HOME: temporary },
    });
    assert.equal(stopped.status, 0, stopped.stderr);
    await assert.rejects(readFile(pidPath, "utf8"), { code: "ENOENT" });
    assert.throws(() => process.kill(child.pid, 0));
  } finally {
    try {
      process.kill(child.pid, "SIGKILL");
    } catch {
      // Already stopped.
    }
    await rm(temporary, { recursive: true, force: true });
  }
});
