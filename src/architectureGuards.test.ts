// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = join(repositoryRoot, "src");
const apiRoot = join(repositoryRoot, "api");

describe("architecture security guards", () => {
  it("keeps browser code behind the room API boundary", () => {
    const browserSource = sourceFiles(sourceRoot)
      .filter((path) => !path.includes(`${join("src", "server")}/`))
      .filter((path) => !path.endsWith(".test.ts"))
      .filter((path) => !path.endsWith(".test.tsx"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(browserSource).not.toMatch(
      /\.from(?:<[^>]+>)?\s*\(\s*["'](?:public\.)?rooms["']/,
    );
    expect(browserSource).not.toMatch(
      /\.rpc(?:<[^>]+>)?\s*\(\s*["'](?:public\.)?server_/,
    );
    expect(browserSource).not.toMatch(
      /from\s+["'][^"']*(?:\/|^)server\/rooms(?:\/|["'])/,
    );
    expect(browserSource).not.toMatch(
      /import\s*\(\s*["'][^"']*(?:\/|^)server\/rooms(?:\/|["'])/,
    );
  });

  it("never gives a server secret a VITE-prefixed name", () => {
    const checkedFiles = [
      ...sourceFiles(sourceRoot).filter((path) => !path.includes(".test.")),
      ...sourceFiles(apiRoot),
      join(repositoryRoot, ".env.example"),
      join(repositoryRoot, "package.json"),
      join(repositoryRoot, "vercel.json"),
    ];
    const source = checkedFiles
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /VITE_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|DATABASE_URL|DB_URL|PRIVATE_KEY)[A-Z0-9_]*/,
    );
  });

  it("denies framing on both application surfaces", () => {
    const config = JSON.parse(
      readFileSync(join(repositoryRoot, "vercel.json"), "utf8"),
    ) as {
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };

    for (const source of ["/", "/index.html", "/play/:path*"]) {
      const headers = config.headers.find(
        (entry) => entry.source === source,
      )?.headers;
      expect(headers).toEqual(
        expect.arrayContaining([
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ]),
      );
    }
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}
