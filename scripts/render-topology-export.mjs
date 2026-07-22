import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve(
  process.argv[2] ?? "examples/run-exports/vampi-real-mission-history-2026-07-20.json"
);
const outputPath = resolve(
  process.argv[3] ?? "artifacts/vampi-submission/screenshots/topology-complete.svg"
);

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const run = source.snapshot?.run;
if (!run || !Array.isArray(run.realities) || run.realities.length === 0) {
  throw new Error(`No Reality graph found in ${sourcePath}`);
}

const realities = run.realities;
const byId = new Map(realities.map((reality) => [reality.id, reality]));
const children = new Map();
for (const reality of realities) {
  if (!reality.parentId || !byId.has(reality.parentId)) continue;
  const siblings = children.get(reality.parentId) ?? [];
  siblings.push(reality);
  children.set(reality.parentId, siblings);
}
for (const siblings of children.values()) {
  siblings.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  );
}

const roots = realities
  .filter((reality) => !reality.parentId || !byId.has(reality.parentId))
  .sort((left, right) =>
    left.depth - right.depth
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id)
  );

const canvas = { width: 2560, height: 2070 };
const columns = [48, 670, 1292, 1914];
const nodeWidth = 500;
const nodeHeight = 128;
const firstLeafY = 258;
const leafGap = 208;
const positions = new Map();
let leafIndex = 0;

function place(reality) {
  const descendants = children.get(reality.id) ?? [];
  const childRows = descendants.map(place);
  const y = childRows.length
    ? childRows.reduce((total, row) => total + row, 0) / childRows.length
    : firstLeafY + leafIndex++ * leafGap;
  positions.set(reality.id, { x: columns[reality.depth], y });
  return y;
}
for (const root of roots) place(root);

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(value, maximum = 34, lines = 2) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const result = [];
  for (const word of words) {
    const current = result.at(-1);
    if (!current || current.length + word.length + 1 > maximum) result.push(word);
    else result[result.length - 1] = `${current} ${word}`;
  }
  if (result.length <= lines) return result;
  const clipped = result.slice(0, lines);
  clipped[lines - 1] = `${clipped[lines - 1].slice(0, maximum - 1)}…`;
  return clipped;
}

function formatTime(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function statusLabel(reality) {
  return reality.depth === 0 ? "Reality stabilised" : "Memory returned";
}

function subjectRole(role) {
  return String(role ?? "Subject")
    .replace("Ownership contract investigator", "Contract investigator")
    .replace("Negative-test engineer", "Negative-test engineer");
}

const maximumDepth = Math.max(...realities.map((reality) => reality.depth));
const subjectCount = realities.reduce((total, reality) => total + reality.subjects.length, 0);
const evidenceCount = realities.reduce((total, reality) => total + reality.evidence.length, 0);
const returnedMemories = run.memories?.filter((memory) => memory.status !== "quarantined").length ?? 0;

const edgeMarkup = realities.flatMap((reality) => {
  if (!reality.parentId) return [];
  const parentPosition = positions.get(reality.parentId);
  const childPosition = positions.get(reality.id);
  if (!parentPosition || !childPosition) return [];
  const startX = parentPosition.x + nodeWidth;
  const startY = parentPosition.y + nodeHeight / 2;
  const endX = childPosition.x;
  const endY = childPosition.y + nodeHeight / 2;
  const bend = (startX + endX) / 2;
  return [`
    <path class="edge" d="M ${startX} ${startY} C ${bend} ${startY}, ${bend} ${endY}, ${endX} ${endY}" />
    <circle class="memory" cx="${bend}" cy="${(startY + endY) / 2}" r="5" />`];
}).join("");

const nodeMarkup = realities.map((reality) => {
  const position = positions.get(reality.id);
  const titleLines = wrap(reality.name, 34, 2);
  const subjects = reality.subjects.slice(0, 4);
  const chipGap = 8;
  const chipWidth = (nodeWidth - chipGap * Math.max(0, subjects.length - 1)) / Math.max(1, subjects.length);
  const subjectMarkup = subjects.map((subject, index) => {
    const x = position.x + index * (chipWidth + chipGap);
    return `
      <g transform="translate(${x} ${position.y + nodeHeight + 8})">
        <rect class="subject-card" width="${chipWidth}" height="48" rx="4" />
        <circle class="subject-head" cx="15" cy="17" r="5" />
        <path class="subject-body" d="M 8 32 C 9 23, 21 23, 22 32" />
        <text class="subject-name" x="30" y="17">${escape(subject.name)}</text>
        <text class="subject-role" x="30" y="34">${escape(subjectRole(subject.role))}</text>
      </g>`;
  }).join("");

  return `
    <g class="reality-node depth-${reality.depth}" transform="translate(${position.x} ${position.y})">
      <rect class="node-card" width="${nodeWidth}" height="${nodeHeight}" rx="7" />
      <rect class="node-accent" width="4" height="${nodeHeight}" rx="2" />
      <text class="node-level" x="20" y="25">${reality.depth === 0 ? "ROOT" : `L${reality.depth}`}</text>
      <text class="node-status" x="${nodeWidth - 18}" y="25" text-anchor="end">${statusLabel(reality)}</text>
      ${titleLines.map((line, index) => `<text class="node-title" x="20" y="${54 + index * 24}">${escape(line)}</text>`).join("")}
      <text class="node-stats" x="20" y="112">${escape(formatTime(reality.worldState.simulatedMinutes))} dream-time</text>
      <text class="node-stats" x="178" y="112">${reality.evidence.length} evidence</text>
      <text class="node-stats" x="326" y="112">${reality.subjects.length} Subjects</text>
    </g>
    ${subjectMarkup}`;
}).join("");

const depthLabels = Array.from({ length: maximumDepth + 1 }, (_, depth) => `
  <g transform="translate(${columns[depth]} 154)">
    <text class="depth-label" x="0" y="0">LEVEL ${depth}</text>
    <text class="depth-kind" x="0" y="22">${depth === 0 ? "Protected Reality" : depth === 1 ? "Dream" : "Nested Dream"}</text>
    <line class="depth-rule" x1="0" y1="38" x2="${nodeWidth}" y2="38" />
  </g>`).join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#20292d" stroke-width="1" />
    </pattern>
    <filter id="memoryGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <style>
    text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: 0; }
    .eyebrow { fill: #58d7e5; font-size: 18px; font-weight: 800; }
    .title { fill: #f3f6f7; font-size: 36px; font-weight: 760; }
    .subtitle { fill: #8d999f; font-size: 18px; }
    .metric { fill: #d8e0e3; font-size: 17px; font-weight: 720; }
    .metric-value { fill: #72d89e; }
    .depth-label { fill: #a6b1b6; font-size: 14px; font-weight: 800; }
    .depth-kind { fill: #647178; font-size: 14px; }
    .depth-rule { stroke: #273238; stroke-width: 1; }
    .edge { fill: none; stroke: #d49e45; stroke-width: 2; stroke-dasharray: 8 9; }
    .memory { fill: #eab454; filter: url(#memoryGlow); }
    .node-card { fill: #0a0e10; stroke: #526067; stroke-width: 1.5; }
    .depth-0 .node-card { fill: #0d1718; stroke: #58d7e5; }
    .depth-1 .node-card { stroke: #67617d; }
    .depth-2 .node-card { stroke: #806b46; }
    .node-accent { fill: #58d7e5; }
    .depth-1 .node-accent { fill: #8179a0; }
    .depth-2 .node-accent, .depth-3 .node-accent { fill: #d49e45; }
    .node-level { fill: #58d7e5; font-size: 14px; font-weight: 850; }
    .node-status { fill: #72d89e; font-size: 14px; font-weight: 700; }
    .node-title { fill: #f1f4f5; font-size: 22px; font-weight: 730; }
    .node-stats { fill: #9eaaaf; font-size: 14px; }
    .subject-card { fill: #0b1511; stroke: #397653; stroke-width: 1; }
    .subject-head, .subject-body { fill: none; stroke: #72d89e; stroke-width: 1.5; }
    .subject-name { fill: #dbe5df; font-size: 12px; font-weight: 800; }
    .subject-role { fill: #72d89e; font-size: 10px; }
    .legend { fill: #8d999f; font-size: 15px; }
  </style>
  <rect width="100%" height="100%" fill="#070a0c" />
  <rect x="0" y="128" width="100%" height="1820" fill="url(#grid)" />
  <rect x="0" y="0" width="100%" height="128" fill="#0b1114" />
  <line x1="0" y1="127" x2="2560" y2="127" stroke="#273238" />
  <text class="eyebrow" x="48" y="35">INCEPTION / REALITY ENGINE</text>
  <text class="title" x="48" y="78">Complete counterfactual world graph</text>
  <text class="subtitle" x="48" y="108">Final stabilised VAmPI authorization review • every Reality, Dream, Subject, and returned Memory in one frame</text>
  <text class="metric" x="1630" y="51"><tspan class="metric-value">${realities.length}</tspan> Realities</text>
  <text class="metric" x="1810" y="51"><tspan class="metric-value">${realities.length - roots.length}</tspan> Dreams</text>
  <text class="metric" x="1988" y="51"><tspan class="metric-value">${subjectCount}</tspan> Subjects</text>
  <text class="metric" x="2170" y="51"><tspan class="metric-value">${evidenceCount}</tspan> evidence</text>
  <text class="metric" x="2390" y="51"><tspan class="metric-value">${maximumDepth}</tspan> levels</text>
  <text class="metric" x="1630" y="91"><tspan class="metric-value">${returnedMemories}</tspan> verified Memories returned through parent-owned gates</text>
  ${depthLabels}
  ${edgeMarkup}
  ${nodeMarkup}
  <rect x="0" y="1948" width="100%" height="122" fill="#0b1114" />
  <line x1="0" y1="1948" x2="2560" y2="1948" stroke="#273238" />
  <line x1="48" y1="1990" x2="92" y2="1990" stroke="#d49e45" stroke-width="2" stroke-dasharray="8 9" />
  <circle cx="70" cy="1990" r="5" fill="#eab454" />
  <text class="legend" x="108" y="1996">Validated Memory path</text>
  <rect x="360" y="1970" width="34" height="34" rx="4" fill="#0b1511" stroke="#397653" />
  <text class="legend" x="410" y="1996">Native Subject owned by its Reality</text>
  <text class="legend" x="2520" y="1996" text-anchor="end">GPT-5.6-sol • Codex SDK • isolated Git worktree + project-local runtime per Reality</text>
  <text class="legend" x="48" y="2034">Source: preserved safe VAmPI real-mode mission history • Unsupported or planted Memory cannot cross a Totem Check.</text>
</svg>`;

await writeFile(outputPath, svg, "utf8");
console.log(`Rendered ${realities.length} Realities and ${subjectCount} Subjects to ${outputPath}`);
