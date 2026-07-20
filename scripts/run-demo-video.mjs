import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  DEMO_VIDEO_SCENARIOS,
  exportedEvents,
  isTimelineMilestone,
  matchingEvent,
  subtitleEntries
} from "./demo-video-cues.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

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

function srtTimestamp(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const millis = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function playbackSubtitles() {
  return subtitleEntries(scenario).map((entry, index) => `${index + 1}
${srtTimestamp(Math.round(entry.startMs / speed))} --> ${srtTimestamp(Math.round(entry.endMs / speed))}
${entry.text}
`).join("\n");
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
const narrationValue = argument("audio", "");
const narrationPath = narrationValue ? path.resolve(repoRoot, narrationValue) : null;
const captionsEnabled = !hasFlag("no-captions") && (Boolean(recordDirectory) || hasFlag("captions"));
const strictTiming = Boolean(recordDirectory) || hasFlag("strict-timing");
const maxDriftMs = Number(argument("max-drift-ms", "750"));
const leadInMs = Number(argument("lead-in-ms", "1000"));
const postRollMs = Number(argument("post-roll-ms", "1000"));
if (![maxDriftMs, leadInMs, postRollMs].every((value) => Number.isFinite(value) && value >= 0)) {
  throw new Error("Timing values must be finite, non-negative numbers");
}
if (narrationPath && !recordDirectory) throw new Error("--audio requires --record-dir");

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

async function command(commandName, args, options = {}) {
  try {
    return await execFileAsync(commandName, args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options
    });
  } catch (error) {
    const detail = error?.stderr || error?.stdout || error?.message || String(error);
    throw new Error(`${commandName} failed: ${String(detail).trim()}`);
  }
}

async function mediaDuration(filePath) {
  const result = await command("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not determine media duration for ${filePath}`);
  }
  return duration;
}

function installCaptionOverlay({ entries, startEpochMs, playbackSpeed }) {
  const timerKey = "__inceptionDemoCaptionTimer";
  const mount = () => {
    let caption = document.querySelector("[data-demo-caption]");
    if (!caption) {
      caption = document.createElement("div");
      caption.setAttribute("data-demo-caption", "");
      caption.setAttribute("aria-live", "off");
      Object.assign(caption.style, {
        position: "fixed",
        zIndex: "2147483647",
        left: "50%",
        bottom: "76px",
        transform: "translateX(-50%)",
        width: "min(1120px, calc(100vw - 96px))",
        minHeight: "72px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 20px",
        boxSizing: "border-box",
        border: "1px solid rgba(255,255,255,0.34)",
        borderRadius: "6px",
        background: "rgba(5,9,13,0.92)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.42)",
        color: "#fff",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: "24px",
        fontWeight: "650",
        lineHeight: "1.28",
        letterSpacing: "0",
        textAlign: "center",
        whiteSpace: "pre-line",
        pointerEvents: "none",
        opacity: "0"
      });
      document.documentElement.append(caption);
    }

    const render = () => {
      const elapsed = (Date.now() - startEpochMs) * playbackSpeed;
      const active = entries.find((entry) => elapsed >= entry.startMs && elapsed < entry.endMs);
      caption.textContent = active?.text ?? "";
      caption.style.opacity = active ? "1" : "0";
    };
    clearInterval(window[timerKey]);
    window[timerKey] = window.setInterval(render, 25);
    render();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
}

async function masterRecording({
  videoPath,
  captureEndedAt,
  startedAt,
  actionTimings
}) {
  await command("ffmpeg", ["-version"]);
  await command("ffprobe", ["-version"]);

  const rawPath = path.join(recordDirectory, `${scenarioId}-raw.webm`);
  if (path.resolve(videoPath) !== path.resolve(rawPath)) {
    await rm(rawPath, { force: true });
    await rename(videoPath, rawPath);
  }
  const rawDurationSeconds = await mediaDuration(rawPath);
  const timelineToCaptureEndSeconds = (captureEndedAt - startedAt) / 1_000;
  const trimStartSeconds = rawDurationSeconds - timelineToCaptureEndSeconds;
  const targetDurationSeconds = scenario.durationMs / speed / 1_000;
  if (trimStartSeconds < 0 || rawDurationSeconds - trimStartSeconds < targetDurationSeconds) {
    throw new Error("Recorded media does not contain the complete synchronized timeline");
  }

  if (narrationPath) {
    const narrationDurationSeconds = await mediaDuration(narrationPath);
    if (Math.abs(narrationDurationSeconds - targetDurationSeconds) > 0.5) {
      throw new Error(
        `Narration is ${narrationDurationSeconds.toFixed(3)}s; expected ${targetDurationSeconds.toFixed(3)}s (±0.5s)`
      );
    }
  }

  const outputName = argument("output", `${scenarioId}-captioned.mp4`);
  const outputPath = path.isAbsolute(outputName)
    ? outputName
    : path.join(recordDirectory, outputName);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const trimFilter = `[0:v:0]trim=start=${trimStartSeconds.toFixed(6)}:duration=${targetDurationSeconds.toFixed(6)},setpts=PTS-STARTPTS[v]`;
  const ffmpegArgs = ["-hide_banner", "-loglevel", "error", "-y", "-i", rawPath];
  if (narrationPath) ffmpegArgs.push("-i", narrationPath);
  ffmpegArgs.push(
    "-filter_complex", trimFilter,
    "-map", "[v]"
  );
  if (narrationPath) {
    ffmpegArgs.push("-map", "1:a:0", "-c:a", "aac", "-b:a", "192k");
  } else {
    ffmpegArgs.push("-an");
  }
  ffmpegArgs.push(
    "-t", targetDurationSeconds.toFixed(6),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath
  );
  await command("ffmpeg", ffmpegArgs);

  const outputDurationSeconds = await mediaDuration(outputPath);
  if (Math.abs(outputDurationSeconds - targetDurationSeconds) > 0.12) {
    throw new Error(
      `Mastered video is ${outputDurationSeconds.toFixed(3)}s; expected ${targetDurationSeconds.toFixed(3)}s`
    );
  }

  const captionsSource = path.join(repoRoot, scenario.outputDirectory, "subtitles.srt");
  const captionsPath = path.join(recordDirectory, `${scenarioId}-subtitles.srt`);
  if (speed === 1) {
    await copyFile(captionsSource, captionsPath);
  } else {
    await writeFile(captionsPath, playbackSubtitles(), "utf8");
  }
  const syncReport = {
    format: "inception-demo-video-sync",
    version: 1,
    scenario: scenarioId,
    playbackSpeed: speed,
    captionsRendered: captionsEnabled,
    captionsSource: path.relative(repoRoot, captionsSource),
    narration: narrationPath ? path.basename(narrationPath) : null,
    rawDurationSeconds,
    trimStartSeconds,
    targetDurationSeconds,
    outputDurationSeconds,
    maximumActionDriftMs: Math.max(0, ...actionTimings.map((entry) => entry.driftMs)),
    actionTimings
  };
  const reportPath = path.join(recordDirectory, `${scenarioId}-sync.json`);
  await writeFile(reportPath, `${JSON.stringify(syncReport, null, 2)}\n`, "utf8");
  console.log(`Synchronized master: ${outputPath}`);
  console.log(`Caption sidecar: ${captionsPath}`);
  console.log(`Timing report: ${reportPath}`);
}

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
const video = page.video();
let runUrl = "";
let startedAt = 0;
let captureEndedAt = 0;
const actionTimings = [];

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

async function panGraph(position) {
  const graph = page.getByTestId("reality-graph");
  await graph.evaluate(async (element, targetPosition) => {
    const target = targetPosition === "end"
      ? element.scrollWidth - element.clientWidth
      : 0;
    const initial = element.scrollLeft;
    const duration = 800;
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.scrollLeft = initial + (target - initial) * eased;
        if (progress >= 1) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }, position);
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
    case "pan-graph":
      await panGraph(action.position);
      return;
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

  startedAt = Date.now() + leadInMs;
  if (captionsEnabled) {
    const captionConfig = {
      entries: subtitleEntries(scenario),
      startEpochMs: startedAt,
      playbackSpeed: speed
    };
    await context.addInitScript(installCaptionOverlay, captionConfig);
    await page.evaluate(installCaptionOverlay, captionConfig);
  }
  for (const action of scenario.actions) {
    const dueAt = startedAt + Math.round(action.atMs / speed);
    const remaining = dueAt - Date.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
    const driftMs = Math.max(0, Date.now() - dueAt);
    actionTimings.push({
      atMs: action.atMs,
      label: action.label,
      driftMs
    });
    console.log(`[${formatOffset(action.atMs)}] ACTION ${action.label} (+${driftMs}ms)`);
    if (strictTiming && driftMs > maxDriftMs) {
      throw new Error(
        `Action '${action.label}' drifted ${driftMs}ms; maximum allowed drift is ${maxDriftMs}ms`
      );
    }
    await runAction(action);
  }
  const remaining = startedAt + Math.round(scenario.durationMs / speed) - Date.now();
  if (remaining > 0) await page.waitForTimeout(remaining);
  if (recordDirectory && postRollMs > 0) await page.waitForTimeout(postRollMs);
} finally {
  captureEndedAt = Date.now();
  await context.close();
  await browser.close();
}

if (recordDirectory) {
  if (!video) throw new Error("Playwright did not create a recording");
  await masterRecording({
    videoPath: await video.path(),
    captureEndedAt,
    startedAt,
    actionTimings
  });
}

console.log(`${scenario.title} cue run completed.`);
