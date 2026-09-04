import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE =
  process.env.PLAY_SPYMISSION_HOME ?? join(homedir(), ".cache/play-spymission");
const require = createRequire(join(CACHE, "package.json"));
const puppeteer = require("puppeteer-core");

const ACTION = process.argv[2] ?? "list";
const TOOL_NAME = process.argv[3];
const INPUT_JSON = process.argv[4] ?? "{}";
const DEBUG_PORT = process.env.PLAY_SPYMISSION_PORT ?? "9222";

const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
  defaultViewport: null,
});

const pages = await browser.pages();
const page = pages.find((entry) =>
  /^https:\/\/spymission\.dev\/play\//.test(entry.url()),
);

if (!page) {
  throw new Error("No Spy Mission play tab found in Chrome");
}

await page.bringToFront();

async function waitForTools(timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tools = page.webmcp?.tools?.() ?? [];
    if (tools.length > 0) return tools;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return page.webmcp?.tools?.() ?? [];
}

function summarize(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema ?? null,
  }));
}

function publicUrl(value) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

if (ACTION === "status") {
  const pageInfo = await page.evaluate(() => ({
    url: `${location.origin}${location.pathname}${location.search}`,
    title: document.title,
    bodyText: (document.body?.innerText || "").slice(0, 1200),
    documentModelContext: typeof document.modelContext !== "undefined",
    navigatorModelContext: typeof navigator.modelContext !== "undefined",
  }));
  const tools = await waitForTools(4000);
  console.log(
    JSON.stringify(
      {
        url: publicUrl(page.url()),
        page: pageInfo,
        toolCount: tools.length,
        tools: summarize(tools),
      },
      null,
      2,
    ),
  );
} else if (ACTION === "list") {
  const tools = await waitForTools();
  console.log(
    JSON.stringify(
      { url: publicUrl(page.url()), tools: summarize(tools) },
      null,
      2,
    ),
  );
} else if (ACTION === "call") {
  const tools = await waitForTools();
  const tool = tools.find((entry) => entry.name === TOOL_NAME);
  if (!tool) {
    throw new Error(
      `Tool ${TOOL_NAME} not found. Available: ${tools.map((entry) => entry.name).join(", ") || "(none)"}`,
    );
  }
  const result = await tool.execute(JSON.parse(INPUT_JSON));
  const output = result?.output ?? result;
  console.log(
    JSON.stringify({ status: result?.status ?? "Completed", output }, null, 2),
  );
} else if (ACTION === "screenshot") {
  const path = process.argv[3] ?? join(CACHE, "page.png");
  await page.screenshot({ path, fullPage: true });
  console.log(JSON.stringify({ path, url: publicUrl(page.url()) }));
} else {
  throw new Error(`Unknown action: ${ACTION}`);
}

browser.disconnect();
