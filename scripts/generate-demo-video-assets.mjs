import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEMO_VIDEO_SCENARIOS,
  exportedEvents,
  matchingEvent
} from "./demo-video-cues.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

function timestamp(milliseconds, separator = ",") {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const millis = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(millis).padStart(3, "0")}`;
}

function voiceMarkdown(scenario) {
  const wordCount = scenario.voiceCues.reduce(
    (total, cue) => total + cue.text.trim().split(/\s+/).length,
    0
  );
  const minutes = scenario.durationMs / 60_000;
  return `# ${scenario.title} Voice Transcript

Spoken words only. Actor movement and UI instructions live in \`ACTOR_SCRIPT.md\`.

- **Runtime:** ${timestamp(scenario.durationMs, ".")}
- **Words:** ${wordCount}
- **Average pace:** ${Math.round(wordCount / minutes)} words per minute

${scenario.voiceCues.map((cue) => `## ${cue.id} / ${timestamp(cue.startMs, ".")} - ${timestamp(cue.endMs, ".")}

${cue.text}`).join("\n\n")}
`;
}

function splitSubtitleText(text) {
  const sentences = text.split(/(?<=[!?])\s+|(?<=\.)\s+(?=[A-Z])/);
  return sentences.flatMap((sentence) => {
    const words = sentence.trim().split(/\s+/);
    const chunkCount = Math.max(1, Math.ceil(sentence.length / 70));
    const chunkSize = Math.ceil(words.length / chunkCount);
    return Array.from({ length: chunkCount }, (_, index) =>
      words.slice(index * chunkSize, (index + 1) * chunkSize).join(" ")
    ).filter(Boolean);
  });
}

function wrapSubtitle(text, width = 42) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function subtitles(scenario) {
  const entries = [];
  for (const cue of scenario.voiceCues) {
    const segments = splitSubtitleText(cue.text);
    const weights = segments.map((segment) => segment.split(/\s+/).length);
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    let elapsedWeight = 0;
    for (const [index, segment] of segments.entries()) {
      const startMs = cue.startMs + Math.round(
        ((cue.endMs - cue.startMs) * elapsedWeight) / totalWeight
      );
      elapsedWeight += weights[index];
      const endMs = index === segments.length - 1
        ? cue.endMs
        : cue.startMs + Math.round(
            ((cue.endMs - cue.startMs) * elapsedWeight) / totalWeight
          );
      const wrapped = wrapSubtitle(segment);
      const lines = wrapped.split("\n");
      if (lines.length > 2 || lines.some((line) => line.length > 42)) {
        throw new Error(`Subtitle segment exceeds the two-line safe area: ${segment}`);
      }
      entries.push({ startMs, endMs, text: wrapped });
    }
  }
  return entries.map((entry, index) => `${index + 1}
${timestamp(entry.startMs)} --> ${timestamp(entry.endMs)}
${entry.text}
`).join("\n");
}

async function verifyOrWrite(filePath, content) {
  if (!checkOnly) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    return;
  }
  const current = await readFile(filePath, "utf8").catch(() => "");
  if (current !== content) {
    throw new Error(`${path.relative(repoRoot, filePath)} is stale; run npm run demo:video:assets`);
  }
}

for (const [id, scenario] of Object.entries(DEMO_VIDEO_SCENARIOS)) {
  if (scenario.durationMs >= 180_000) throw new Error(`${id} must remain under three minutes`);
  let priorEnd = 0;
  for (const cue of scenario.voiceCues) {
    if (cue.startMs < priorEnd || cue.endMs <= cue.startMs) {
      throw new Error(`${id}/${cue.id} has an invalid or overlapping time range`);
    }
    priorEnd = cue.endMs;
  }
  if (priorEnd !== scenario.durationMs) {
    throw new Error(`${id} voice cues must end at the scenario duration`);
  }
  for (const action of scenario.actions) {
    if (action.atMs < 0 || action.atMs >= scenario.durationMs) {
      throw new Error(`${id}/${action.label} falls outside the video duration`);
    }
  }

  const exportDocument = JSON.parse(
    await readFile(path.join(repoRoot, scenario.exportPath), "utf8")
  );
  const events = exportedEvents(exportDocument);
  for (const action of scenario.actions.filter((entry) => entry.kind === "timeline-event")) {
    if (!matchingEvent(events, action.match)) {
      throw new Error(`${id}/${action.label} does not match a retained event`);
    }
  }

  const outputDirectory = path.join(repoRoot, scenario.outputDirectory);
  await verifyOrWrite(path.join(outputDirectory, "VOICE_TRANSCRIPT.md"), voiceMarkdown(scenario));
  await verifyOrWrite(path.join(outputDirectory, "subtitles.srt"), subtitles(scenario));
}

console.log(checkOnly ? "Demo video assets are synchronized." : "Demo video assets generated.");
