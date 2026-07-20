import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  DEMO_VIDEO_SCENARIOS,
  exportedEvents,
  isTimelineMilestone,
  matchingEvent
} from "./demo-video-cues.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argument(name, fallback) {
  const exact = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (exact) return exact.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function formatOffset(milliseconds) {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

const scenarioId = argument("scenario", "password-reset");
const scenario = DEMO_VIDEO_SCENARIOS[scenarioId];
if (!scenario) {
  throw new Error(`Unknown scenario '${scenarioId}'. Use password-reset or vampi.`);
}
const baseUrl = argument("base-url", "http://127.0.0.1:3100").replace(/\/$/, "");
const speed = Number(argument("speed", "1"));
if (!Number.isFinite(speed) || speed <= 0) throw new Error("--speed must be greater than zero");
const dryRun = hasFlag("dry-run");
const recordDirectoryValue = argument("record-dir", "");
const recordDirectory = recordDirectoryValue
  ? path.resolve(repoRoot, recordDirectoryValue)
  : null;

const exportDocument = JSON.parse(
  await readFile(path.join(repoRoot, scenario.exportPath), "utf8")
);
const events = exportedEvents(exportDocument);
const milestones = events.filter(isTimelineMilestone);

for (const action of scenario.actions) {
  console.log(`[${formatOffset(action.atMs)}] ${action.label}`);
}
if (dryRun) process.exit(0);

if (recordDirectory) await mkdir(recordDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: hasFlag("headless"),
  slowMo: Number(argument("slow-mo", "0"))
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  ...(recordDirectory ? {
    recordVideo: {
      dir: recordDirectory,
      size: { width: 1440, height: 1000 }
    }
  } : {})
});
const page = await context.newPage();
let runUrl = "";

async function resolveRunUrl() {
  if (scenario.route.kind === "password-reset") {
    return `${baseUrl}/missions/password-reset`;
  }
  const response = await page.request.get(`${baseUrl}/api/missions`);
  if (!response.ok()) throw new Error(`Mission Library returned HTTP ${response.status()}`);
  const body = await response.json();
  const requestedId = argument("mission-id", "");
  const run = requestedId
    ? body.runs?.find((entry) => entry.id === requestedId)
    : body.runs?.find((entry) =>
        entry.name === scenario.route.name && entry.status === "stabilised"
      );
  if (!run) {
    throw new Error(`No stabilised '${scenario.route.name}' Mission exists; pass --mission-id after loading the preserved run`);
  }
  return `${baseUrl}/missions/${encodeURIComponent(run.id)}`;
}

async function loadRetainedHistory() {
  const button = page.getByRole("button", { name: /Load \d+ earlier events/ });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await button.count() === 0 || !(await button.isVisible()) || !(await button.isEnabled())) break;
    await button.click();
    await page.waitForTimeout(300);
  }
  const range = page.getByLabel("Replay Reality timeline");
  const maximum = Number(await range.getAttribute("max"));
  if (maximum !== milestones.length - 1) {
    throw new Error(`Timeline exposes ${maximum + 1} milestones; expected ${milestones.length}. Load the matching preserved export before recording.`);
  }
}

async function scrollTo(selector) {
  const target = page.locator(selector);
  await target.waitFor({ state: "attached" });
  await target.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }));
  await page.waitForTimeout(Math.max(40, Math.round(450 / speed)));
}

async function selectTimelineEvent(match) {
  const event = matchingEvent(events, match);
  if (!event) throw new Error(`No retained event matches ${JSON.stringify(match)}`);
  const milestoneIndex = milestones.findIndex((entry) => entry.id === event.id);
  if (milestoneIndex < 0) throw new Error(`Matched event ${event.id} is not a replay milestone`);
  const range = page.getByLabel("Replay Reality timeline");
  await range.fill(String(milestoneIndex));
  await page.waitForTimeout(Math.max(40, Math.round(280 / speed)));
}

async function runAction(action) {
  switch (action.kind) {
    case "scroll-top":
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      return;
    case "scroll":
      await scrollTo(action.selector);
      return;
    case "timeline-event":
      await selectTimelineEvent(action.match);
      if (action.scrollTo) await scrollTo(action.scrollTo);
      return;
    case "inspect-timeline":
      await page.getByTestId("reality-timeline").getByTitle("Inspect current milestone").click();
      await page.getByTestId("event-detail").waitFor({ state: "visible" });
      return;
    case "close-event":
      if (await page.getByTestId("event-detail").count()) {
        await page.getByRole("button", { name: "Close event details" }).click();
      }
      return;
    case "reveal-code": {
      const button = page.getByTestId("reveal-code");
      if ((await button.count()) && /Reveal code/i.test(await button.innerText())) await button.click();
      return;
    }
    case "mission-control":
      await page.goto(`${baseUrl}/missions`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Create a Mission" }).waitFor({ state: "visible" });
      return;
    case "return-to-run":
      await page.goto(runUrl, { waitUntil: "domcontentloaded" });
      await page.getByTestId("reality-timeline").waitFor({ state: "visible" });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      return;
    default:
      throw new Error(`Unsupported demo action '${action.kind}'`);
  }
}

try {
  runUrl = await resolveRunUrl();
  await page.goto(runUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("reality-timeline").waitFor({ state: "visible" });
  await loadRetainedHistory();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

  const startedAt = Date.now();
  for (const action of scenario.actions) {
    const dueAt = startedAt + Math.round(action.atMs / speed);
    const remaining = dueAt - Date.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
    console.log(`[${formatOffset(action.atMs)}] ACTION ${action.label}`);
    await runAction(action);
  }
  const remaining = startedAt + Math.round(scenario.durationMs / speed) - Date.now();
  if (remaining > 0) await page.waitForTimeout(remaining);
} finally {
  await context.close();
  await browser.close();
}

console.log(`${scenario.title} cue run completed.`);
