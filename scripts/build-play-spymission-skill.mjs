import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, ".agents/skills/play-spymission");
const output = resolve(root, "public/skills/play-spymission.zip");
const checkOnly = process.argv.includes("--check");
const fixedDosDate = (1 << 5) | 1; // 1980-01-01

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files.sort();
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, data, checksum) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(fixedDosDate, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(name, data, checksum, mode, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE((3 << 8) | 20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(fixedDosDate, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(((mode & 0xffff) << 16) >>> 0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

function endRecord(entries, centralSize, centralOffset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entries, 8);
  record.writeUInt16LE(entries, 10);
  record.writeUInt32LE(centralSize, 12);
  record.writeUInt32LE(centralOffset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

async function validateSkill() {
  const skillPath = resolve(source, "SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) throw new Error("SKILL.md is missing YAML frontmatter");
  if (!/^name:\s*play-spymission\s*$/m.test(frontmatter[1])) {
    throw new Error("SKILL.md must use the name play-spymission");
  }
  if (!/^description:\s*\S.+$/m.test(frontmatter[1])) {
    throw new Error("SKILL.md must have a non-empty description");
  }

  const textFiles = (await collectFiles(source)).filter((path) =>
    /\.(?:md|mjs|sh)$/.test(path),
  );
  const combined = (
    await Promise.all(textFiles.map((path) => readFile(path, "utf8")))
  ).join("\n");
  if (/\/home\/[A-Za-z0-9._-]+\//.test(combined)) {
    throw new Error("The skill contains a personal machine path");
  }
  if (/#invite=[A-Za-z0-9_-]{8,}/.test(combined)) {
    throw new Error("The skill contains an invitation secret");
  }
}

async function buildArchive() {
  await validateSkill();
  const localParts = [];
  const centralParts = [];
  let entryCount = 0;
  let offset = 0;

  for (const path of await collectFiles(source)) {
    const data = await readFile(path);
    const metadata = await stat(path);
    const archiveName = `play-spymission/${relative(source, path).split(sep).join("/")}`;
    const name = Buffer.from(archiveName, "utf8");
    const checksum = crc32(data);
    const normalizedMode = metadata.mode & 0o111 ? 0o100755 : 0o100644;
    const local = localHeader(name, data, checksum);
    const central = centralHeader(name, data, checksum, normalizedMode, offset);
    localParts.push(local, name, data);
    centralParts.push(central, name);
    entryCount += 1;
    offset += local.length + name.length + data.length;
  }

  const central = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    central,
    endRecord(entryCount, central.length, offset),
  ]);
}

const archive = await buildArchive();
if (checkOnly) {
  let committed;
  try {
    committed = await readFile(output);
  } catch {
    throw new Error(
      "The distributable ZIP is missing. Run npm run skill:build and commit it.",
    );
  }
  if (!archive.equals(committed)) {
    throw new Error(
      "The distributable ZIP is stale. Run npm run skill:build and commit it.",
    );
  }
  console.log("Verified play-spymission skill metadata and ZIP contents.");
} else {
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, archive);
  console.log("Built public/skills/play-spymission.zip.");
}
