// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const legacyProductName = /\bCodenames?(?: Hub)?\b/i;

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("public Spy Mission identity", () => {
  it.each(["index.html", "play/index.html"])(
    "brands %s as Spy Mission",
    (relativePath) => {
      const html = source(relativePath);
      expect(html).toContain('lang="en"');
      expect(html).toContain('dir="ltr"');
      expect(html).toContain("Spy Mission");
      expect(html).not.toMatch(legacyProductName);
    },
  );

  it("keeps the PWA manifest identity English-first and scoped to play", () => {
    const config = source("vite.config.ts");
    expect(config).toMatch(/name:\s*"Spy Mission"/);
    expect(config).toMatch(/short_name:\s*"Spy Mission"/);
    expect(config).toMatch(/lang:\s*"en"/);
    expect(config).toMatch(/dir:\s*"ltr"/);
    expect(config).toMatch(/scope:\s*"\/play\/"/);
    expect(config).not.toMatch(legacyProductName);
  });

  it.each(["public/favicon.svg", "public/pwa-icon.svg"])(
    "gives %s the Spy Mission accessible name",
    (relativePath) => {
      const icon = source(relativePath);
      expect(icon).toContain('aria-label="Spy Mission"');
      expect(icon).not.toMatch(legacyProductName);
    },
  );

  it("runs the built-output identity check as part of production builds", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.build).toContain(
      "node scripts/verify-public-identity.mjs",
    );
  });
});
