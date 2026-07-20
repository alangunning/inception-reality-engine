import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repoRoot, "examples", "run-exports");

function argument(name, fallback) {
  const exact = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (exact) return exact.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const baseUrl = argument("base-url", "http://127.0.0.1:3100").replace(/\/$/, "");
const checkOnly = process.argv.includes("--check");

async function jsonFrom(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${url} returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok) throw new Error(body.error ?? `${url} returned HTTP ${response.status}`);
  return body;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} is missing`);
  return value;
}

function requireStablePasswordReset(history, archive) {
  if (history?.session?.phase !== 10 || history?.operation !== null || history?.nextAction !== null) {
    throw new Error("Password-reset Demo Mission is not stabilised");
  }
  const histories = requireArray(history.realities, "Password-reset Realities");
  const events = requireArray(history.events, "Password-reset events");
  if (histories.length !== 4 || events.length !== 215) {
    throw new Error(`Unexpected password-reset shape: ${histories.length} Realities, ${events.length} events`);
  }
  if (archive?.session?.updatedAt !== history.session.updatedAt) {
    throw new Error("Current password-reset archive does not match the rendered Mission history");
  }
  if (requireArray(archive.events, "Password-reset archive events").length !== events.length) {
    throw new Error("Current password-reset archive is incomplete");
  }
}

function requireStableVampi(history) {
  const run = history?.snapshot?.run;
  if (!run || run.status !== "stabilised" || history.snapshot.operation !== null || history.snapshot.nextAction !== null) {
    throw new Error("VAmPI Mission is not stabilised");
  }
  const realities = requireArray(run.realities, "VAmPI Realities");
  const events = requireArray(run.events, "VAmPI events");
  const memories = requireArray(run.memories, "VAmPI Memories");
  if (realities.length !== 15 || events.length !== 1_048 || memories.length !== 14) {
    throw new Error(
      `Unexpected VAmPI shape: ${realities.length} Realities, ${events.length} events, ${memories.length} Memories`
    );
  }
  if (!requireArray(run.proofResults, "VAmPI proofs").every((proof) => proof.status === "passed")) {
    throw new Error("VAmPI immutable proof did not pass");
  }
}

function redactLocalPaths(value) {
  const serialized = JSON.stringify(value)
    .replaceAll(repoRoot, "$REPO_ROOT")
    .replaceAll(homedir(), "$HOME")
    .replace(/Bearer [A-Za-z0-9._~+/-]{12,}/g, "Bearer [redacted]");
  return JSON.parse(serialized);
}

function assertSafe(value, label) {
  const serialized = JSON.stringify(value);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized)) throw new Error(`${label} contains an API key`);
  if (/Bearer [A-Za-z0-9._~+/-]{12,}/.test(serialized)) throw new Error(`${label} contains a bearer token`);
  if (/(?:OPENAI|CODEX)_API_KEY\s*[=:]\s*\S+/.test(serialized)) {
    throw new Error(`${label} contains an API-key assignment`);
  }
  if (serialized.includes("/.codex/auth.json")) throw new Error(`${label} contains an auth-file path`);
  if (serialized.includes(homedir()) || serialized.includes(repoRoot)) {
    throw new Error(`${label} contains a machine-specific path`);
  }
}

function datedFilename(prefix, isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid export timestamp: ${isoDate}`);
  return `${prefix}-${date.toISOString().slice(0, 10)}.json`;
}

async function emit(filename, value) {
  assertSafe(value, filename);
  const content = `${JSON.stringify(value)}\n`;
  const filePath = path.join(outputDirectory, filename);
  if (checkOnly) {
    const current = await readFile(filePath, "utf8").catch(() => "");
    if (current !== content) throw new Error(`${filename} is stale; run npm run demo:exports`);
  } else {
    await writeFile(filePath, content, "utf8");
  }
  console.log(`${checkOnly ? "Verified" : "Exported"} ${filename}`);
}

const index = await jsonFrom(`${baseUrl}/api/missions`);
const requestedVampiId = argument("vampi-id", "");
const vampi = requestedVampiId
  ? index.runs?.find((run) => run.id === requestedVampiId)
  : index.runs?.find((run) => run.name === "VAmPI Ownership Regression" && run.status === "stabilised");
if (!vampi) throw new Error("No stabilised VAmPI Ownership Regression Mission is available");

const [passwordHistoryRaw, passwordArchiveRaw, vampiHistoryRaw] = await Promise.all([
  jsonFrom(`${baseUrl}/api/missions/password-reset?download=1`),
  jsonFrom(`${baseUrl}/api/admin/history?id=current&download=1`),
  jsonFrom(`${baseUrl}/api/missions/${encodeURIComponent(vampi.id)}?download=1`)
]);
requireStablePasswordReset(passwordHistoryRaw, passwordArchiveRaw);
requireStableVampi(vampiHistoryRaw);

const passwordHistory = redactLocalPaths(passwordHistoryRaw);
const passwordArchive = redactLocalPaths(passwordArchiveRaw);
// `id=current` is a live projection whose archive timestamp changes on every
// request. Pin it to the completed Reality timestamp so repeated safe exports
// are byte-for-byte reproducible.
passwordArchive.archivedAt = passwordHistory.session.updatedAt;
const vampiHistory = redactLocalPaths(vampiHistoryRaw);
const vampiRun = vampiHistory.snapshot.run;
const vampiEventLog = {
  format: "inception-mission-event-log",
  version: 1,
  mission: {
    id: vampiRun.id,
    name: vampiRun.definition.name,
    status: vampiRun.status,
    createdAt: vampiRun.createdAt,
    updatedAt: vampiRun.updatedAt
  },
  runtime: vampiHistory.runtime,
  eventCount: vampiRun.events.length,
  events: vampiRun.events
};

await mkdir(outputDirectory, { recursive: true });
await emit(
  datedFilename("password-reset-real-mission-history", passwordHistory.session.updatedAt),
  passwordHistory
);
await emit(
  datedFilename("password-reset-real-stabilised", passwordHistory.session.updatedAt),
  passwordArchive
);
await emit(
  datedFilename("vampi-real-mission-history", vampiRun.updatedAt),
  vampiHistory
);
await emit(
  datedFilename("vampi-real-run-log", vampiRun.updatedAt),
  vampiEventLog
);
