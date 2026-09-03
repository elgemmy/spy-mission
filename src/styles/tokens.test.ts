import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(__dirname, "tokens.css"), "utf8");

const REQUIRED_TOKENS = [
  "--cn-bg",
  "--cn-surface",
  "--cn-ink",
  "--cn-red",
  "--cn-red-tint",
  "--cn-blue",
  "--cn-font-ar",
  "--cn-font-ui",
  "--cn-font-mono",
  "--cn-r-card",
  "--cn-shadow-tile",
  "--cn-flip-dur",
  "--cn-flip-ease",
  "--cn-shadow-float",
  "--cn-shadow-phone",
  "--cn-phone-frame",
  "--cn-max-w-shell",
  "--cn-max-w-landing",
];

describe("tokens.css", () => {
  it("defines required Warm Sand cn tokens", () => {
    for (const token of REQUIRED_TOKENS) {
      expect(tokensCss).toContain(token);
    }

    expect(tokensCss).toContain(".cn-shell");
  });
});
