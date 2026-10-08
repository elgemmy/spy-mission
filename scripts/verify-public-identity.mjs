import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const builtFiles = [
  "dist/index.html",
  "dist/play/index.html",
  "dist/manifest.webmanifest",
];
const legacyProductName = /\bCodenames?(?: Hub)?\b/i;

for (const relativePath of builtFiles) {
  const content = readFileSync(resolve(root, relativePath), "utf8");
  if (!content.includes("Spy Mission")) {
    throw new Error(`${relativePath} is missing the Spy Mission identity`);
  }
  if (legacyProductName.test(content)) {
    throw new Error(`${relativePath} contains a legacy public product name`);
  }
}

for (const relativePath of ["dist/index.html", "dist/play/index.html"]) {
  const html = readFileSync(resolve(root, relativePath), "utf8");
  if (
    !/<html\b[^>]*\blang="en"/.test(html) ||
    !/<html\b[^>]*\bdir="ltr"/.test(html)
  ) {
    throw new Error(`${relativePath} must start in English with LTR direction`);
  }
}

for (const relativePath of ["dist/favicon.svg", "dist/pwa-icon.svg"]) {
  const icon = readFileSync(resolve(root, relativePath), "utf8");
  if (
    !icon.includes('aria-label="Spy Mission"') ||
    legacyProductName.test(icon)
  ) {
    throw new Error(`${relativePath} has an unexpected accessible identity`);
  }
}

const manifest = JSON.parse(
  readFileSync(resolve(root, "dist/manifest.webmanifest"), "utf8"),
);
if (
  manifest.name !== "Spy Mission" ||
  manifest.short_name !== "Spy Mission" ||
  manifest.lang !== "en" ||
  manifest.dir !== "ltr" ||
  manifest.scope !== "/play/"
) {
  throw new Error("dist/manifest.webmanifest has unexpected public identity");
}

console.log("Verified Spy Mission identity in built HTML and PWA manifest.");
