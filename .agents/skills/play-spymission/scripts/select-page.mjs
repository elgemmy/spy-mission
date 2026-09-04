const PLAY_URL = /^https:\/\/spymission\.dev\/play\//;
const EXPECTED_TOOLS = new Set([
  "choose_name",
  "inspect_mission",
  "submit_guesses",
]);

function exposesExpectedTool(page) {
  try {
    return (page.webmcp?.tools?.() ?? []).some((tool) =>
      EXPECTED_TOOLS.has(tool.name),
    );
  } catch {
    return false;
  }
}

export function selectSpyMissionPage(pages) {
  const matches = pages.filter((page) => PLAY_URL.test(page.url()));
  const ready = matches.filter(exposesExpectedTool);
  return ready.at(-1) ?? matches.at(-1);
}
