// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cardCss = readFileSync(
  fileURLToPath(new URL("../ui/card/Card.css", import.meta.url)),
  "utf8",
);
const gameCss = readFileSync(
  fileURLToPath(new URL("../ui/game/Game.css", import.meta.url)),
  "utf8",
);

describe("mobile playability CSS contract", () => {
  it("keeps Arabic board words at the handoff 17px floor", () => {
    expect(cardCss).toMatch(
      /\.cn-card--ar \.cn-card__word\s*\{[^}]*font-size:\s*17px/s,
    );
    expect(cardCss).not.toMatch(
      /\.cn-card--ar \.cn-card__word\s*\{[^}]*font-size:\s*(?:1[0-6]|[0-9])px/s,
    );
  });

  it("lets the five-column board use the shell width without overflow", () => {
    expect(gameCss).toMatch(
      /\.cn-board\s*\{[^}]*grid-template-columns:\s*repeat\(5,[^}]*margin-inline:/s,
    );
    expect(gameCss).toContain("margin-inline: calc(-1 * var(--cn-space-4))");
  });

  it("protects touch targets, dialogs, and standalone safe areas", () => {
    expect(gameCss).toMatch(
      /\.cn-board__confirm\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s,
    );
    expect(gameCss).toContain("max-block-size: calc(");
    expect(gameCss).toContain("overflow-y: auto");
    expect(gameCss).toContain("env(safe-area-inset-top)");
    expect(gameCss).toContain("env(safe-area-inset-bottom)");
  });
});
