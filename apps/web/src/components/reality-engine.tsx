"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Download,
  Eye,
  FileCode2,
  FileDiff,
  Fingerprint,
  FlaskConical,
  GitBranch,
  History,
  Layers3,
  LockKeyhole,
  Minimize2,
  MoonStar,
  Network,
  Pause,
  Play,
  Power,
  Radio,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SquareTerminal,
  TestTube2,
  TimerReset,
  Trash2,
  UsersRound,
  X,
  XCircle
} from "lucide-react";
import type {
  AnchorResult,
  DreamProposal,
  MemoryIntegritySeal,
  Reality,
  RealityEvent,
  RealityRunArchive,
  RegressionResult,
  WakeReport
} from "@inception/domain";
import type { ActiveRealityOperation, DemoAction, DemoSnapshot } from "@inception/orchestrator";

type LoadingState = "idle" | "acting" | "resetting";
export type InspectorTab = "world" | "constitution" | "runtime";
export type PresentedRealityOperation = Pick<
  ActiveRealityOperation,
  "id" | "label" | "executor" | "realityId" | "startedAt"
>;
type EventFamily = "all" | "codex" | "dream" | "subject" | "evidence" | "memory" | "anchor" | "reality";
type EventSort = "newest" | "oldest";
type PresentedDemoSnapshot = DemoSnapshot & {
  runtime: {
    codexMode: "mock" | "real";
    persistence: "prisma" | "sqlite-fallback";
    model: string;
    sdkVersion: string;
  };
};

interface SafeEventMetadata {
  stage?: "thread" | "turn" | "command" | "file" | "tool" | "search" | "plan" | "subject" | "model";
  status?: "started" | "updated" | "completed" | "failed";
  detail?: string;
  command?: string;
  paths?: string[];
  tool?: string;
  exitCode?: number;
  completedItems?: number;
  totalItems?: number;
  planSteps?: Array<{
    text: string;
    status: "pending" | "completed";
  }>;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  failureKind?: "test" | "environment" | "configuration" | "missing-tool" | "build" | "command";
  diagnostic?: string;
  model?: string;
  sdkVersion?: string;
  subjectId?: string;
  subjectName?: string;
  subjectRole?: string;
  subjectThreadId?: string;
  subjectState?: "started" | "completed" | "failed";
  collaborationTool?: "spawn_agent" | "wait";
}

interface CodexProcess {
  pid: number;
  parentPid: number;
  elapsed: string;
  workingDirectory?: string;
}

interface CodexSdkOperation {
  id: string;
  realityId: string;
  model: string;
  startedAt: string;
}

interface RunLogSummary {
  id: string;
  phase: number;
  archivedAt: string;
  realityCount: number;
  eventCount: number;
  commandCount: number;
  failedCommandCount: number;
  recoveredAfterFailure: boolean;
  failureKinds: Record<string, number>;
}

interface SavedMissionSummary {
  id: string;
  kind: "demo" | "saved";
  name: string;
  scope: string;
  status: string;
  realityCount: number;
  updatedAt: string;
  href: string;
  resetHref: string;
  exportHref: string;
  canReset: boolean;
  canDelete: boolean;
}

export interface RealityPhaseStep {
  label: string;
  complete: boolean;
  current: boolean;
}

async function readApiResponse<T extends object>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${fallback} The server returned an empty HTTP ${response.status} response.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${fallback} The server returned an invalid HTTP ${response.status} response.`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fallback} The server returned an invalid HTTP ${response.status} response.`);
  }
  return value as T;
}

interface RealityGraphLayout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  maximumDepth: number;
}

function layoutRealityTree(realities: Reality[]): RealityGraphLayout {
  const byId = new Map(realities.map((reality) => [reality.id, reality]));
  const children = new Map<string, Reality[]>();
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
  const positions = new Map<string, { x: number; y: number }>();
  const visiting = new Set<string>();
  let leafIndex = 0;
  const place = (reality: Reality): number => {
    const existing = positions.get(reality.id);
    if (existing) return existing.y;
    if (visiting.has(reality.id)) {
      const y = 116 + leafIndex++ * 164;
      positions.set(reality.id, { x: 138 + reality.depth * 304, y });
      return y;
    }
    visiting.add(reality.id);
    const descendants = children.get(reality.id) ?? [];
    const childRows = descendants.map(place);
    const y = childRows.length
      ? childRows.reduce((total, row) => total + row, 0) / childRows.length
      : 116 + leafIndex++ * 164;
    positions.set(reality.id, { x: 138 + reality.depth * 304, y });
    visiting.delete(reality.id);
    return y;
  };
  for (const root of roots) place(root);
  for (const reality of realities) {
    if (!positions.has(reality.id)) place(reality);
  }

  const maximumDepth = Math.max(0, ...realities.map((reality) => reality.depth));
  const maximumY = Math.max(116, ...[...positions.values()].map((position) => position.y));
  return {
    positions,
    width: Math.max(920, 276 + maximumDepth * 304),
    height: Math.max(356, maximumY + 116),
    maximumDepth
  };
}

const stages = [
  { label: "Inspect", endPhase: 1 },
  { label: "Dream", endPhase: 2 },
  { label: "Investigate", endPhase: 5 },
  { label: "Return", endPhase: 8 },
  { label: "Verify", endPhase: 10 }
];

function statusLabel(status: Reality["status"]): string {
  const labels: Record<Reality["status"], string> = {
    forming: "Forming",
    exploring: "Exploring",
    waking: "Waking",
    kicked: "Memory returned",
    stabilised: "Reality stabilised"
  };
  return labels[status];
}

function shortId(value?: string): string {
  if (!value || value.startsWith("unbound:")) return "Awaiting entry";
  return value.length > 22 ? `${value.slice(0, 11)}...${value.slice(-6)}` : value;
}

function phaseTitle(phase: number): string {
  if (phase === 0) return "A waking world, one untested belief";
  if (phase <= 1) return "Uncertainty made explicit";
  if (phase <= 4) return "Adversarial world in motion";
  if (phase <= 6) return "A decisive nested experiment";
  if (phase <= 7) return "Memories returning upward";
  if (phase <= 8) return "Knowledge changing implementation";
  if (phase <= 9) return "Parent-owned truth under test";
  return "Reality stabilised";
}

function formatClock(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function relativeAge(now: number, timestamp: string): string {
  const seconds = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}

function safeEventMetadata(event: RealityEvent): SafeEventMetadata {
  const payload = event.payload as { metadata?: unknown };
  if (!payload.metadata || typeof payload.metadata !== "object") return {};
  return payload.metadata as SafeEventMetadata;
}

function metadataDetail(metadata: SafeEventMetadata): string | null {
  if (metadata.subjectName) {
    return [
      metadata.subjectRole,
      metadata.subjectThreadId ? `thread ${shortId(metadata.subjectThreadId)}` : null,
      metadata.collaborationTool
    ].filter(Boolean).join(" / ");
  }
  if (metadata.model) {
    return `${metadata.model}${metadata.sdkVersion ? ` / Codex SDK ${metadata.sdkVersion}` : ""}`;
  }
  if (metadata.command) {
    const exit = metadata.exitCode === undefined ? "" : ` / exit ${metadata.exitCode}`;
    return `$ ${metadata.command}${exit}`;
  }
  if (metadata.paths?.length) return metadata.paths.join(", ");
  if (metadata.tool) return metadata.tool;
  if (metadata.detail) return metadata.detail;
  if (metadata.totalItems !== undefined) {
    return `${metadata.completedItems ?? 0} of ${metadata.totalItems} plan items complete`;
  }
  if (metadata.inputTokens !== undefined || metadata.outputTokens !== undefined) {
    return [
      metadata.inputTokens !== undefined ? `${metadata.inputTokens.toLocaleString()} input` : null,
      metadata.outputTokens !== undefined ? `${metadata.outputTokens.toLocaleString()} output` : null,
      metadata.reasoningTokens !== undefined ? `${metadata.reasoningTokens.toLocaleString()} reasoning` : null
    ].filter(Boolean).join(" / ");
  }
  return null;
}

function eventFamily(event: RealityEvent): Exclude<EventFamily, "all"> {
  const prefix = event.type.split(".")[0];
  if (prefix === "codex") return "codex";
  if (prefix === "dream") return "dream";
  if (prefix === "subject") return "subject";
  if (prefix === "evidence" || prefix === "belief" || prefix === "uncertainty") return "evidence";
  if (prefix === "kick" || prefix === "wake" || prefix === "memory" || prefix === "artefact" || prefix === "synthesis" || prefix === "reflection" || prefix === "intervention") return "memory";
  if (prefix === "anchor" || prefix === "validation" || prefix === "verification") return "anchor";
  return "reality";
}

export function replayRealities(realities: Reality[], events: RealityEvent[], timelineIndex: number | null): Reality[] {
  if (timelineIndex === null || !events.length) return realities;
  const visibleEvents = events.slice(0, timelineIndex + 1);
  const cutoff = new Date(visibleEvents.at(-1)?.occurredAt ?? 0).getTime();
  const created = new Set(
    visibleEvents
      .filter((event) => event.type === "reality.created" || event.type === "dream.created")
      .map((event) => event.realityId)
  );
  const subjectIds = new Set(
    visibleEvents
      .filter((event) => event.type === "subject.entered")
      .map((event) => event.payload.subjectId)
      .filter((id): id is string => typeof id === "string")
  );
  const surfacedProposals = new Set(
    visibleEvents
      .filter((event) => event.type === "uncertainty.discovered")
      .map((event) => event.payload.proposal)
      .filter((title): title is string => typeof title === "string")
  );

  return realities
    .filter((reality) => created.has(reality.id) || new Date(reality.createdAt).getTime() <= cutoff)
    .map((reality) => {
      const realityEvents = visibleEvents.filter((event) => event.realityId === reality.id);
      const lastEvent = realityEvents.at(-1);
      const hasMemory = realityEvents.some((event) => event.type === "memory.returned");
      const returnedSubjectIds = new Set(
        realityEvents
          .filter((event) => event.type === "subject.returned")
          .map((event) => event.payload.subjectId)
          .filter((id): id is string => typeof id === "string")
      );
      const status: Reality["status"] = realityEvents.some((event) => event.type === "reality.stabilised")
        ? "stabilised"
        : hasMemory
          ? "kicked"
          : realityEvents.some((event) => event.type === "kick.triggered")
            ? "waking"
            : reality.kind === "dream" || realityEvents.some((event) => event.type === "inspection.completed")
              ? "exploring"
              : "forming";
      return {
        ...reality,
        status,
        worldState: {
          ...reality.worldState,
          simulatedMinutes: lastEvent?.dreamTime ?? 0,
          currentFocus: lastEvent?.summary ?? "Establishing the world",
          summary: lastEvent?.summary ?? reality.premise,
          status: statusLabel(status)
        },
        evidence: reality.evidence.filter((entry) => new Date(entry.createdAt).getTime() <= cutoff),
        beliefs: reality.beliefs.filter((entry) => new Date(entry.createdAt).getTime() <= cutoff),
        proposals: reality.proposals.filter((proposal) => surfacedProposals.has(proposal.title)),
        subjects: reality.subjects
          .filter((subject) => subjectIds.has(subject.id))
          .map((subject) => ({
            ...subject,
            status: returnedSubjectIds.has(subject.id) ? "returned" as const : "entered" as const
          })),
        wakeReport: hasMemory ? reality.wakeReport : undefined
      };
    });
}

function replayPhase(events: RealityEvent[], realities: Reality[]): number {
  let phase = 0;
  for (const event of events) {
    const depth = realities.find((reality) => reality.id === event.realityId)?.depth ?? 0;
    if (event.type === "inspection.completed" || event.type === "uncertainty.discovered") phase = Math.max(phase, 1);
    if (event.type === "dream.created") phase = Math.max(phase, depth >= 2 ? 5 : 2);
    if (event.type === "subject.entered") phase = Math.max(phase, 3);
    if ((event.type === "evidence.discovered" || event.type === "belief.changed") && depth === 1) phase = Math.max(phase, 4);
    if (event.type === "memory.returned") phase = Math.max(phase, depth >= 2 ? 6 : 7);
    if (event.type === "synthesis.completed") phase = Math.max(phase, 8);
    if (event.type.startsWith("anchor.") || event.type.startsWith("verification.")) phase = Math.max(phase, 9);
    if (event.type === "reality.stabilised") phase = 10;
  }
  return phase;
}

function isTimelineMilestone(event: RealityEvent): boolean {
  return event.type !== "codex.progress" && event.type !== "anchor.started";
}

export function SectionHeading({ icon, eyebrow, title, meta }: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div className="heading-icon" aria-hidden="true">{icon}</div>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {meta && <div className="heading-meta">{meta}</div>}
    </header>
  );
}

export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="empty-state">{icon}<span>{children}</span></div>;
}

export function RealityTopbar({
  codexMode,
  model,
  environment,
  realityCount,
  actions
}: {
  codexMode: "mock" | "real";
  model: string;
  environment: string;
  realityCount: number;
  actions: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-symbol"><Layers3 size={22} /></div>
        <div><strong>INCEPTION</strong><span>Reality Engine</span></div>
      </div>
      <div className="topbar-controls">
        <div className="topbar-status" data-testid="topbar-status" role="status" aria-label="Reality Engine status">
          <span className="stream-status"><Radio size={13} /> LIVE MEMORY STREAM</span>
          <span><BrainCircuit size={13} /> {codexMode.toUpperCase()} CODEX / {model.toUpperCase()}</span>
          <span><Layers3 size={13} /> {environment.toUpperCase()}</span>
          <span><Network size={13} /> {realityCount} REALITIES</span>
        </div>
        <nav className="topbar-actions" data-testid="topbar-actions" aria-label="Reality Engine actions">
          {actions}
        </nav>
      </div>
    </header>
  );
}

export function RealityPhaseHeader({
  eyebrow,
  title,
  steps
}: {
  eyebrow: string;
  title: string;
  steps: RealityPhaseStep[];
}) {
  return (
    <section className="phase-header" data-testid="phase-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <ol className="phase-track" aria-label="Reality progress">
        {steps.map((step, index) => (
          <li className={`${step.complete ? "is-complete" : ""} ${step.current ? "is-current" : ""}`} key={step.label}>
            <span>{step.complete ? <Check size={12} /> : index + 1}</span>
            <b>{step.label}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RealityJourneyBand({
  realities,
  events,
  stabilised
}: {
  realities: Reality[];
  events: RealityEvent[];
  stabilised: boolean;
}) {
  const hasDream = realities.some((reality) => reality.depth > 0);
  const hasSubjects = realities.some((reality) => reality.subjects.length > 0)
    || events.some((event) => event.type.startsWith("subject."));
  const hasKick = events.some((event) => event.type === "kick.triggered");
  const hasMemory = events.some((event) =>
    event.type === "memory.returned"
    || event.type === "memory.quarantined"
    || event.type === "reflection.created"
  );
  const journey = [
    { label: "Waking requirements", detail: "Parent truth", icon: <LockKeyhole size={15} />, reached: true },
    { label: "Dreams explore", detail: "Isolated worlds", icon: <MoonStar size={15} />, reached: hasDream },
    { label: "Subjects test", detail: "Independent roles", icon: <UsersRound size={15} />, reached: hasSubjects },
    { label: "Totem judges", detail: "Kick boundary", icon: <Fingerprint size={15} />, reached: hasKick },
    { label: "Memory changes Reality", detail: "Proven outcome", icon: <ArrowUpFromLine size={15} />, reached: hasMemory || stabilised }
  ];
  const firstUnreached = journey.findIndex((stage) => !stage.reached);
  const current = stabilised
    ? journey.length - 1
    : firstUnreached < 0 ? journey.length - 1 : firstUnreached;

  return (
    <section className="reality-journey" data-testid="reality-journey" aria-label="Current Reality journey">
      {journey.map((stage, index) => (
        <div
          className={`${stage.reached ? "is-reached" : ""} ${index === current ? "is-current" : ""}`}
          key={stage.label}
        >
          <span>{stage.icon}</span>
          <p><strong>{stage.label}</strong><small>{stage.detail}</small></p>
          {index < journey.length - 1 && <ChevronRight size={13} aria-hidden="true" />}
        </div>
      ))}
    </section>
  );
}

export function WakeTransition({
  stage,
  realityName
}: {
  stage: "collecting" | "sealing" | "returning" | null;
  realityName?: string;
}) {
  if (!stage) return null;
  const stages = [
    { id: "collecting", label: "Collecting lived evidence" },
    { id: "sealing", label: "Reality Totem checking memory" },
    { id: "returning", label: "Validated memory returning upward" }
  ] as const;
  const activeIndex = stages.findIndex((entry) => entry.id === stage);
  return (
    <div className="wake-transition" role="status" aria-live="polite" data-testid="wake-transition">
      <div className="wake-transition-core">
        <Fingerprint size={24} />
        <span><small>KICK DETECTED / {realityName ?? "DREAM"}</small><strong>{stages[activeIndex]?.label}</strong></span>
      </div>
      <ol>
        {stages.map((entry, index) => (
          <li className={`${index < activeIndex ? "is-complete" : ""} ${index === activeIndex ? "is-current" : ""}`} key={entry.id}>
            <span>{index < activeIndex ? <Check size={11} /> : index + 1}</span>
            {entry.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RealityGraph({ realities, locusId, selectedId, pulseId, onSelect }: {
  realities: Reality[];
  locusId: string | null;
  selectedId: string | null;
  pulseId: string | null;
  onSelect: (id: string) => void;
}) {
  const collapsed = realities.length === 1 && realities[0]?.status === "stabilised";
  const layout = useMemo(() => layoutRealityTree(realities), [realities]);
  const viewportHeight = Math.min(560, layout.height);
  return (
    <div
      className={`reality-map ${collapsed ? "is-collapsed" : ""}`}
      data-testid="reality-graph"
      style={{ height: viewportHeight }}
    >
      <div
        className="reality-graph-canvas"
        style={{ width: layout.width, height: layout.height }}
      >
        <div className="map-grid" aria-hidden="true" />
        {Array.from({ length: layout.maximumDepth + 1 }, (_, depth) => (
          <div
            className={`depth-rail depth-rail-${depth}`}
            style={{ left: 28 + depth * 304 }}
            key={depth}
          >
            <span>LEVEL {depth}</span>
            <b>{depth === 0 ? "Waking" : depth === 1 ? "Dream" : "Nested dream"}</b>
          </div>
        ))}
        <svg
          className="map-links"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          {realities.map((reality) => {
            const parent = realities.find((candidate) => candidate.id === reality.parentId);
            const from = parent ? layout.positions.get(parent.id) : undefined;
            const to = layout.positions.get(reality.id);
            if (!parent || !from || !to) return null;
            const returned = reality.status === "kicked";
            const forwardPath = `M ${from.x + 109} ${from.y} C ${from.x + 190} ${from.y}, ${to.x - 190} ${to.y}, ${to.x - 109} ${to.y}`;
            const returnPath = `M ${to.x - 109} ${to.y} C ${to.x - 190} ${to.y}, ${from.x + 190} ${from.y}, ${from.x + 109} ${from.y}`;
            return (
              <g key={`${parent.id}-${reality.id}`}>
                <path
                  className={`map-path ${returned ? "path-returned" : ""}`}
                  d={forwardPath}
                />
                {returned && (
                  <circle
                    className="memory-packet"
                    r="4"
                    style={{ offsetPath: `path("${returnPath}")` }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {realities.map((reality) => {
          const position = layout.positions.get(reality.id);
          if (!position) return null;
          const selected = reality.id === selectedId;
          const locus = reality.id === locusId;
          return (
            <button
              type="button"
              className={`reality-node depth-node-${reality.depth} ${selected ? "is-selected" : ""} ${locus ? "is-locus" : ""} ${pulseId === reality.id ? "is-waking" : ""}`}
              style={{ left: position.x, top: position.y }}
              key={reality.id}
              onClick={() => onSelect(reality.id)}
              aria-pressed={selected}
            >
              <span className="node-kicker">
                <span>L{reality.depth}</span>
                {locus && <b><Radio size={10} /> LOCUS</b>}
                {!locus && <b>{statusLabel(reality.status)}</b>}
              </span>
              <strong>{reality.name}</strong>
              <small>{reality.worldState.currentFocus}</small>
              <span className="node-stats">
                <span><Clock3 size={12} />{reality.worldState.simulatedMinutes}m</span>
                <span><FlaskConical size={12} />{reality.evidence.length}</span>
                <span><UsersRound size={12} />{reality.subjects.length}</span>
              </span>
            </button>
          );
        })}

        {pulseId && <div className="wake-flash" aria-hidden="true"><span /><span /></div>}
      </div>
    </div>
  );
}

export function WorldInspector({ reality, locus, tab, operation, now, onTab }: {
  reality: Reality;
  locus: boolean;
  tab: InspectorTab;
  operation: PresentedRealityOperation | null;
  now: number;
  onTab: (tab: InspectorTab) => void;
}) {
  const realityOperation = operation?.realityId === reality.id ? operation : null;
  const latestBelief = reality.beliefs.at(-1);
  const proofState = reality.anchors.some((anchor) => anchor.status === "failed")
    ? "Proof failed"
    : reality.anchors.length > 0 && reality.anchors.every((anchor) => anchor.status === "passed")
      ? "Verified"
      : "Unverified";
  const unresolvedProposals = reality.proposals.filter((proposal) => proposal.status === "open").length;
  const dreamBudget = reality.proposals.reduce((total, proposal) => total + (proposal.estimatedTokens ?? 0), 0);
  return (
    <aside className="world-inspector">
      <div className="inspector-title">
        <div>
          <span className="eyebrow">INSPECTED REALITY / L{reality.depth}</span>
          <h2>{reality.name}</h2>
        </div>
        <span className={`state-badge state-${reality.status}`}>{statusLabel(reality.status)}</span>
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Reality details">
        {(["world", "constitution", "runtime"] as const).map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "is-active" : ""}
            onClick={() => onTab(item)}
            key={item}
          >
            {item === "world" && <BookOpen size={14} />}
            {item === "constitution" && <ShieldCheck size={14} />}
            {item === "runtime" && <SquareTerminal size={14} />}
            {item}
          </button>
        ))}
      </div>

      {tab === "world" && (
        <div className="inspector-body">
          <div className="dream-clock" data-testid="simulated-world-time">
            <Clock3 size={18} />
            <span><small>SIMULATED WORLD-TIME</small><strong>{reality.worldState.simulatedMinutes}</strong></span>
            <em>{reality.constitution.timeDilation ?? 1}x / minutes</em>
          </div>
          {realityOperation && (
            <div className="live-world-clock">
              <Radio size={15} />
              <span><small>LIVE OPERATION TIME</small><strong>{formatElapsed(now - new Date(realityOperation.startedAt).getTime())}</strong></span>
              <em>wall clock</em>
            </div>
          )}
          <dl className="definition-list">
            <div><dt>Premise</dt><dd>{reality.premise}</dd></div>
            <div><dt>World state</dt><dd>{reality.worldState.summary}</dd></div>
            <div><dt>Implementation</dt><dd>{reality.worldState.implementationState}</dd></div>
          </dl>
          <div className="reality-health" aria-label="Evidence-derived Reality signals">
            <span className="health-heading"><TimerReset size={14} /> REALITY SIGNALS</span>
            <div className="health-row">
              <span>Parent-owned proof</span><strong>{proofState}</strong>
            </div>
            <div className="health-row">
              <span>Model-reported confidence</span>
              <strong>{Math.round((latestBelief?.confidence ?? 0) * 100)}%</strong>
            </div>
            <div className="health-row">
              <span>Open uncertainties</span><strong>{unresolvedProposals}</strong>
            </div>
            <small>Model-estimated Dream budget: {dreamBudget.toLocaleString()} tokens</small>
          </div>
        </div>
      )}

      {tab === "constitution" && (
        <div className="inspector-body">
          <p className="mission-copy">{reality.constitution.mission}</p>
          <div className="contract-group">
            <span>CONSTRAINTS</span>
            {reality.constitution.constraints.map((constraint) => (
              <p key={constraint}><LockKeyhole size={13} />{constraint}</p>
            ))}
          </div>
          <div className="contract-group">
            <span>PARENT TRUTHS</span>
            {reality.constitution.parentTruths.map((truth) => (
              <p key={truth}><Check size={13} />{truth}</p>
            ))}
          </div>
          {!!reality.constitution.runtimeLaws?.length && (
            <div className="contract-group">
              <span>WORLD-SPECIFIC LAWS / {reality.constitution.timeDilation ?? 1}x TIME</span>
              {reality.constitution.runtimeLaws.map((law) => (
                <p key={law}><CircleDot size={13} />{law}</p>
              ))}
            </div>
          )}
          <div className="anchor-summary">
            <ShieldCheck size={17} />
            <span><strong>{reality.anchors.length} inherited anchors</strong><small>Parent-owned and immutable in this world</small></span>
          </div>
        </div>
      )}

      {tab === "runtime" && (
        <div className="inspector-body">
          <dl className="runtime-list">
            <div><dt><BrainCircuit size={14} />Codex thread</dt><dd>{shortId(reality.codexThreadId)}</dd></div>
            <div><dt><GitBranch size={14} />Git branch</dt><dd>{reality.branchName ?? "Preparing isolation"}</dd></div>
            <div><dt><FileCode2 size={14} />Worktree</dt><dd>{reality.worktreePath?.split("/").slice(-3).join("/") ?? "Preparing isolation"}</dd></div>
            <div><dt><CircleDot size={14} />Orchestration locus</dt><dd>{locus ? "This Reality" : "Inspecting memory"}</dd></div>
          </dl>
          <div className="runtime-contract">
            <LockKeyhole size={15} />
            SDK output is schema-validated before persistence, SSE, or rendering.
          </div>
        </div>
      )}
    </aside>
  );
}

export function MemoryReport({
  reality,
  report,
  seal
}: {
  reality: Reality;
  report: WakeReport;
  seal?: MemoryIntegritySeal;
}) {
  const changed = report.changedBeliefs[0];
  return (
    <article className="memory-report">
      <header>
        <span className="memory-level">L{reality.depth}</span>
        <div><small>MEMORY RETURNED</small><h3>{reality.name}</h3></div>
        <span className="validated-badge">
          {seal?.verdict === "verified" ? <Fingerprint size={13} /> : <ShieldCheck size={13} />}
          {seal?.verdict === "verified" ? "INTEGRITY SEALED" : "VALIDATED"}
        </span>
      </header>
      {seal && (
        <div className="memory-integrity-strip" data-testid="canonical-memory-seal">
          <span><Fingerprint size={13} /><b>REALITY TOTEM</b>{seal.checks.filter((check) => check.status === "passed").length}/{seal.checks.length} policy checks</span>
          <code>{seal.reportDigest.slice(0, 16)} / {seal.descendantSealIds.length} descendant seal{seal.descendantSealIds.length === 1 ? "" : "s"}</code>
        </div>
      )}
      {changed && (
        <div className="memory-belief">
          <div><span>ENTERED BELIEVING</span><p>{changed.from}</p></div>
          <ArrowRight size={18} />
          <div><span>WOKE BELIEVING / MODEL-REPORTED {Math.round(changed.confidence * 100)}%</span><p>{changed.to}</p></div>
        </div>
      )}
      <div className="memory-columns">
        <div>
          <span>GENERALISED INVARIANTS</span>
          {report.invariants.map((invariant) => <p key={invariant}><Check size={13} />{invariant}</p>)}
        </div>
        <div>
          <span>RETURNED ARTEFACTS</span>
          {report.artefacts.map((artefact) => (
            <p key={artefact.path}><FileCode2 size={13} /><b>{artefact.name}</b><small>{artefact.summary}</small></p>
          ))}
        </div>
        <div>
          <span>REMAINING UNCERTAINTY</span>
          {report.remainingUncertainty.map((uncertainty) => <p key={uncertainty}><CircleDot size={13} />{uncertainty}</p>)}
        </div>
      </div>
      <footer><BrainCircuit size={14} /><span>{report.recommendation}</span></footer>
    </article>
  );
}

export function OperationMonitor({ operation, realities, events, now }: {
  operation: PresentedRealityOperation;
  realities: Reality[];
  events: RealityEvent[];
  now: number;
}) {
  const reality = realities.find((candidate) => candidate.id === operation.realityId);
  const operationEvents = events.filter((event) =>
    (
      event.type === "codex.progress"
      || event.type === "subject.started"
      || event.type === "subject.completed"
      || event.type === "subject.failed"
      || event.type === "reality.fractured"
      || event.type === "reality.recovered"
    )
    && event.realityId === operation.realityId
    && new Date(event.occurredAt).getTime() >= new Date(operation.startedAt).getTime()
  );
  const latest = operationEvents.at(-1);
  const latestMetadata = latest ? safeEventMetadata(latest) : {};
  const observedCodex = operationEvents.some((event) => event.type === "codex.progress");
  const terminal = (event: RealityEvent) => {
    const status = safeEventMetadata(event).status;
    return status === "completed" || status === "failed";
  };
  const commandCount = operationEvents.filter((event) =>
    safeEventMetadata(event).stage === "command" && terminal(event)
  ).length;
  const fileCount = operationEvents.filter((event) =>
    safeEventMetadata(event).stage === "file" && terminal(event)
  ).length;
  const externalToolCount = operationEvents.filter((event) => {
    const stage = safeEventMetadata(event).stage;
    return (stage === "tool" || stage === "search") && terminal(event);
  }).length;
  const subjectStarts = operationEvents.filter((event) => event.type === "subject.started").length;
  const subjectReturns = operationEvents.filter((event) => event.type === "subject.completed").length;
  const collaborationToolCount = operationEvents.filter((event) =>
    event.type === "subject.started"
    || event.type === "subject.completed"
    || event.type === "subject.failed"
  ).length;
  const sdkToolCount = externalToolCount + collaborationToolCount;

  return (
    <section className="operation-monitor" aria-live="polite" aria-label="Active Reality operation" data-testid="operation-monitor">
      <div className="operation-state">
        <span className="operation-live">
          <Radio size={12} /> {operation.executor === "codex" ? "CODEX OPERATION" : "REALITY ACTION"}
        </span>
        <span className="operation-elapsed"><Clock3 size={14} /> {formatElapsed(now - new Date(operation.startedAt).getTime())}</span>
      </div>
      <div className="operation-identity">
        <span>{operation.label.toUpperCase()}</span>
        <strong>{reality?.name ?? "Current Reality"}</strong>
        <small>Started {formatClock(operation.startedAt)}</small>
      </div>
      <div className="operation-counters" aria-label="Operation telemetry">
        <span><SquareTerminal size={14} /><b>{commandCount}</b> commands</span>
        <span><FileCode2 size={14} /><b>{fileCount}</b> file events</span>
        <span title="Native Codex Subject spawn and terminal return evidence"><UsersRound size={14} /><b>{subjectReturns}/{subjectStarts}</b> Subjects</span>
        <span title="Completed MCP, search, and Codex collaboration tool calls"><Radio size={14} /><b>{sdkToolCount}</b> SDK tools</span>
        <span><Layers3 size={14} /><b>{operationEvents.length}</b> milestones</span>
      </div>
      <div className="operation-latest">
        <time dateTime={latest?.occurredAt ?? operation.startedAt}>
          {formatClock(latest?.occurredAt ?? operation.startedAt)}
        </time>
        <span>
          <strong>{latest?.summary ?? `${operation.label} is preparing ${reality?.name ?? "the current Reality"}.`}</strong>
          {latestMetadata.diagnostic && <small className="event-diagnostic">{latestMetadata.diagnostic}</small>}
          {latest
            ? metadataDetail(latestMetadata) && <small>{metadataDetail(latestMetadata)}</small>
            : <small>The isolated worktree is being checked. Codex usage begins when a thread milestone appears.</small>}
        </span>
        <em>{latestMetadata.stage ?? "orchestrator"} / {latestMetadata.status ?? (observedCodex ? "active" : "preparing")}</em>
      </div>
      <div className="operation-scan" aria-hidden="true"><i /></div>
    </section>
  );
}

export function EventFeed({
  events,
  realities,
  now,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  totalCount = events.length
}: {
  events: RealityEvent[];
  realities: Reality[];
  now: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
}) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<EventFamily>("all");
  const [sort, setSort] = useState<EventSort>("newest");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(200);
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const selectedReality = selectedEvent
    ? realities.find((reality) => reality.id === selectedEvent.realityId)
    : null;

  useEffect(() => {
    if (!selectedEvent) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEventId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedEvent]);

  const filteredEvents = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    return events
      .filter((event) => family === "all" || eventFamily(event) === family)
      .filter((event) => {
        if (!normalisedQuery) return true;
        const reality = realities.find((candidate) => candidate.id === event.realityId);
        const metadata = safeEventMetadata(event);
        return [
          event.summary,
          event.type,
          reality?.name,
          metadata.stage,
          metadata.status,
          metadataDetail(metadata),
          metadata.planSteps?.map((step) => step.text).join(" ")
        ].filter(Boolean).join(" ").toLowerCase().includes(normalisedQuery);
      })
      .sort((left, right) => {
        const difference = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
        return sort === "oldest" ? difference : -difference;
      });
  }, [events, family, query, realities, sort]);
  const renderedEvents = filteredEvents.slice(0, visibleLimit);

  return (
    <div className="event-feed" data-testid="event-feed">
      <div className="event-toolbar" data-testid="event-toolbar">
        <label className="event-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events"
            aria-label="Search Reality events"
          />
        </label>
        <select value={family} onChange={(event) => setFamily(event.target.value as EventFamily)} aria-label="Filter Reality events">
          <option value="all">All events</option>
          <option value="codex">Codex</option>
          <option value="dream">Dreams</option>
          <option value="subject">Subjects</option>
          <option value="evidence">Evidence</option>
          <option value="memory">Memories</option>
          <option value="anchor">Anchors</option>
          <option value="reality">Reality</option>
        </select>
        <div className="event-sort" role="group" aria-label="Sort Reality events">
          <button
            type="button"
            className={sort === "newest" ? "is-active" : ""}
            onClick={() => setSort("newest")}
            title="Newest first"
            aria-label="Newest events first"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className={sort === "oldest" ? "is-active" : ""}
            onClick={() => setSort("oldest")}
            title="Oldest first"
            aria-label="Oldest events first"
          >
            <ArrowUp size={14} />
          </button>
        </div>
        <small>{renderedEvents.length} shown / {events.length} loaded / {totalCount} persisted</small>
      </div>
      {renderedEvents.map((event) => {
        const reality = realities.find((candidate) => candidate.id === event.realityId);
        const metadata = safeEventMetadata(event);
        const detail = metadataDetail(metadata);
        return (
          <button
            type="button"
            className={`event-row ${selectedEventId === event.id ? "is-selected" : ""}`}
            data-testid="event-row"
            key={event.id}
            onClick={() => setSelectedEventId(event.id)}
            aria-haspopup="dialog"
            aria-label={`Inspect event: ${event.summary}`}
          >
            <time dateTime={event.occurredAt}>
              <b>{formatClock(event.occurredAt)}</b>
              <small>{relativeAge(now, event.occurredAt)}</small>
            </time>
            <span className={`event-mark event-${event.type.split(".")[0]}`} />
            <div className="event-copy">
              <span className="event-context">
                <b>{metadata.stage ?? event.type.replace(".", " / ")}</b>
                {metadata.status && (
                  <i className={`event-status event-status-${metadata.status}`}>
                    {metadata.failureKind === "test" ? "test evidence" : metadata.status}
                  </i>
                )}
              </span>
              <strong>{event.summary}</strong>
              {metadata.diagnostic && <p className="event-diagnostic">{metadata.diagnostic}</p>}
              {detail && <code>{detail}</code>}
              <small>{reality?.name ?? "Reality"}</small>
            </div>
            <ChevronRight className="event-open" size={14} aria-hidden="true" />
          </button>
        );
      })}
      {!renderedEvents.length && (
        <EmptyState icon={<Search size={18} />}>No Reality events match this view.</EmptyState>
      )}
      {(renderedEvents.length < filteredEvents.length || hasMore) && (
        <button
          type="button"
          className="event-load-more"
          disabled={loadingMore}
          onClick={() => {
            if (renderedEvents.length < filteredEvents.length) {
              setVisibleLimit((current) => current + 200);
            } else {
              onLoadMore?.();
            }
          }}
        >
          <History size={14} />
          {loadingMore ? "Loading earlier events" : "Load 200 earlier events"}
        </button>
      )}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          reality={selectedReality ?? null}
          now={now}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </div>
  );
}

function EventDetailDialog({
  event,
  reality,
  now,
  onClose
}: {
  event: RealityEvent;
  reality: Reality | null;
  now: number;
  onClose(): void;
}) {
  const metadata = safeEventMetadata(event);
  const planSteps = metadata.planSteps ?? [];
  const payloadEntries = Object.entries(event.payload)
    .filter(([key]) => key !== "metadata");
  const eventRecord = {
    id: event.id,
    type: event.type,
    realityId: event.realityId,
    dreamTime: event.dreamTime,
    occurredAt: event.occurredAt,
    payload: Object.fromEntries(payloadEntries),
    metadata
  };

  return (
    <div className="event-detail-overlay" role="presentation" onMouseDown={(click) => {
      if (click.target === click.currentTarget) onClose();
    }}>
      <aside
        className="event-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
        data-testid="event-detail"
      >
        <header>
          <div>
            <span className="eyebrow">VALIDATED REALITY EVENT</span>
            <h2 id="event-detail-title">{metadata.stage ?? event.type.replace(".", " / ")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close event details" title="Close">
            <X size={17} />
          </button>
        </header>

        <div className="event-detail-body">
          <section className="event-detail-summary">
            <span className={`event-mark event-${event.type.split(".")[0]}`} />
            <div>
              <small>{metadata.status ?? event.type}</small>
              <strong>{event.summary}</strong>
              {metadata.diagnostic && <p>{metadata.diagnostic}</p>}
            </div>
          </section>

          <dl className="event-detail-facts">
            <div><dt>REALITY</dt><dd>{reality?.name ?? "Unknown Reality"}</dd></div>
            <div><dt>EXACT TIME</dt><dd>{new Date(event.occurredAt).toLocaleString()}</dd></div>
            <div><dt>AGE</dt><dd>{relativeAge(now, event.occurredAt)}</dd></div>
            <div><dt>DREAM TIME</dt><dd>{event.dreamTime} minutes</dd></div>
            <div><dt>EVENT ID</dt><dd><code>{event.id}</code></dd></div>
            <div><dt>REALITY ID</dt><dd><code>{event.realityId}</code></dd></div>
          </dl>

          {metadata.totalItems !== undefined && (
            <section className="event-plan-snapshot" data-testid="event-plan-snapshot">
              <header>
                <span>PLAN AT THIS EVENT</span>
                <b>{metadata.completedItems ?? 0} / {metadata.totalItems} COMPLETE</b>
              </header>
              {planSteps.length ? (
                <ol>
                  {planSteps.map((step, index) => (
                    <li className={`plan-step-${step.status}`} key={`${step.text}-${index}`}>
                      {step.status === "completed" ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}
                      <span>{step.text}</span>
                      <b>{step.status}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Step text was not retained by the earlier runtime. The validated completion counts remain available.</p>
              )}
              {metadata.totalItems > planSteps.length && planSteps.length > 0 && (
                <small>{planSteps.length} of {metadata.totalItems} bounded plan steps retained.</small>
              )}
            </section>
          )}

          <section className="event-record">
            <header>
              <span>COMPLETE VALIDATED EVENT RECORD</span>
              <b>NO RAW MODEL REASONING</b>
            </header>
            <pre>{JSON.stringify(eventRecord, null, 2)}</pre>
          </section>
        </div>
      </aside>
    </div>
  );
}

export function AdminDrawer({
  open,
  onClose,
  onFullReset,
  onLoadArchive,
  onStateChanged,
  mission,
  onMissionDeleted
}: {
  open: boolean;
  onClose: () => void;
  onFullReset?: (snapshot: PresentedDemoSnapshot) => void;
  onLoadArchive?: (archive: RealityRunArchive) => void;
  onStateChanged: () => Promise<void>;
  mission?: {
    id: string;
    name: string;
    status: string;
    eventCount: number;
    realityCount: number;
  };
  onMissionDeleted?: () => void;
}) {
  const [processes, setProcesses] = useState<CodexProcess[]>([]);
  const [sdkOperations, setSdkOperations] = useState<CodexSdkOperation[]>([]);
  const [currentLog, setCurrentLog] = useState<RunLogSummary | null>(null);
  const [archivedLogs, setArchivedLogs] = useState<RunLogSummary[]>([]);
  const [savedMissions, setSavedMissions] = useState<SavedMissionSummary[]>([]);
  const [codexMode, setCodexMode] = useState<"mock" | "real">("mock");
  const [busy, setBusy] = useState<"idle" | "stopping" | "resetting" | "loading-archive" | "managing-mission">("idle");
  const [adminError, setAdminError] = useState<string | null>(null);

  const loadProcesses = useCallback(async () => {
    const response = await fetch("/api/admin/codex", { cache: "no-store" });
    const body = await readApiResponse<{
      processes?: CodexProcess[];
      sdkOperations?: CodexSdkOperation[];
      codexMode?: "mock" | "real";
      error?: string;
    }>(response, "Could not inspect Codex processes.");
    if (!response.ok) throw new Error(body.error ?? "Could not inspect Codex processes.");
    setProcesses(body.processes ?? []);
    setSdkOperations(body.sdkOperations ?? []);
    setCodexMode(body.codexMode ?? "mock");
  }, []);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/admin/history", { cache: "no-store" });
    const body = await readApiResponse<{
      current?: RunLogSummary;
      archives?: RunLogSummary[];
      error?: string;
    }>(response, "Could not load retrospective run logs.");
    if (!response.ok) throw new Error(body.error ?? "Could not load retrospective run logs.");
    setCurrentLog(body.current ?? null);
    setArchivedLogs(body.archives ?? []);
  }, []);

  const loadMissions = useCallback(async () => {
    const response = await fetch("/api/missions", { cache: "no-store" });
    const body = await readApiResponse<{
      runs?: SavedMissionSummary[];
      library?: SavedMissionSummary[];
      error?: string;
    }>(response, "Could not load saved Missions.");
    if (!response.ok) throw new Error(body.error ?? "Could not load saved Missions.");
    setSavedMissions(body.library ?? body.runs ?? []);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadProcesses().catch((cause) => setAdminError(cause instanceof Error ? cause.message : String(cause)));
    loadHistory().catch((cause) => setAdminError(cause instanceof Error ? cause.message : String(cause)));
    loadMissions().catch((cause) => setAdminError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => {
      loadProcesses().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadHistory, loadMissions, loadProcesses, open]);

  const stopCodex = async () => {
    const activeCount = Math.max(processes.length, sdkOperations.length);
    if (!window.confirm(`Stop ${activeCount || "all"} active Codex operation${activeCount === 1 ? "" : "s"}? In-flight Reality actions will return an error.`)) return;
    setBusy("stopping");
    setAdminError(null);
    try {
      const response = await fetch("/api/admin/codex", { method: "DELETE" });
      const body = await readApiResponse<{ error?: string }>(response, "Could not stop Codex processes.");
      if (!response.ok) throw new Error(body.error ?? "Could not stop Codex processes.");
      await loadProcesses();
      await onStateChanged();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };

  const cleanup = async () => {
    const confirmed = mission
      ? window.confirm(`Delete Mission "${mission.name}" and clean up every Mission-owned worktree and branch? Other saved Missions and the password-reset Demo Mission are not changed.`)
      : window.confirm("Full reset stops active Codex CLI executions, archives the validated run log, deletes active Reality state, removes registered and orphaned worktrees, prunes Inception branches, and starts a clean waking Reality. Continue?");
    if (!confirmed) return;
    setBusy("resetting");
    setAdminError(null);
    try {
      if (mission) {
        const response = await fetch(`/api/missions/${encodeURIComponent(mission.id)}`, {
          method: "DELETE"
        });
        const body = await readApiResponse<{ error?: string }>(
          response,
          "Could not delete the Mission."
        );
        if (!response.ok) throw new Error(body.error ?? "Could not delete the Mission.");
        onMissionDeleted?.();
        onClose();
        return;
      }
      const response = await fetch("/api/admin/reset", { method: "POST" });
      const body = await readApiResponse<{
        snapshot?: PresentedDemoSnapshot;
        error?: string;
      }>(response, "Could not fully reset the Reality Engine.");
      if (!response.ok || !body.snapshot) throw new Error(body.error ?? "Could not fully reset the Reality Engine.");
      onFullReset?.(body.snapshot);
      setProcesses([]);
      onClose();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };

  const loadArchive = async (archive: RunLogSummary) => {
    setBusy("loading-archive");
    setAdminError(null);
    try {
      const response = await fetch(`/api/admin/history?id=${encodeURIComponent(archive.id)}`, {
        cache: "no-store"
      });
      const body = await readApiResponse<{
        run?: RealityRunArchive;
        error?: string;
      }>(response, "Could not open the saved Reality timeline.");
      if (!response.ok || !body.run) {
        throw new Error(body.error ?? "Could not open the saved Reality timeline.");
      }
      onLoadArchive?.(body.run);
      onClose();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };

  const resetSavedMission = async (saved: SavedMissionSummary) => {
    const detail = saved.kind === "demo"
      ? "The current validated run will be archived and the Demo Mission waking Reality will be formed again."
      : "A clean waking Reality will be formed from the same definition, then the previous Mission worktrees and history will be removed.";
    if (!window.confirm(`Reset Mission "${saved.name}"? ${detail}`)) return;
    setBusy("managing-mission");
    setAdminError(null);
    try {
      const response = await fetch(saved.resetHref, {
        method: "POST"
      });
      const body = await readApiResponse<{
        run?: { id: string };
        session?: PresentedDemoSnapshot["session"];
        error?: string;
      }>(response, "Could not reset the Mission.");
      if (!response.ok || (!body.run && !body.session)) {
        throw new Error(body.error ?? "Could not reset the Mission.");
      }
      await loadMissions();
      if (saved.kind === "demo" && body.session) {
        onFullReset?.(body as PresentedDemoSnapshot);
        await onStateChanged();
        return;
      }
      if (mission?.id === saved.id) {
        window.location.assign(`/missions/${encodeURIComponent(body.run!.id)}`);
        return;
      }
      await onStateChanged();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };

  const deleteSavedMission = async (saved: SavedMissionSummary) => {
    if (!saved.canDelete) return;
    if (!window.confirm(`Delete Mission "${saved.name}" and clean up all of its worktrees and branches?`)) return;
    setBusy("managing-mission");
    setAdminError(null);
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(saved.id)}`, {
        method: "DELETE"
      });
      const body = await readApiResponse<{ error?: string }>(
        response,
        "Could not delete the Mission."
      );
      if (!response.ok) throw new Error(body.error ?? "Could not delete the Mission.");
      await loadMissions();
      if (mission?.id === saved.id) {
        onMissionDeleted?.();
        onClose();
        return;
      }
      await onStateChanged();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };

  const deleteAllSavedMissions = async () => {
    const deletableMissions = savedMissions.filter((saved) => saved.canDelete);
    if (!window.confirm(`Delete all ${deletableMissions.length} user-created Mission${deletableMissions.length === 1 ? "" : "s"} and clean up every Mission-owned worktree and branch? The password-reset Demo Mission is not changed.`)) return;
    setBusy("managing-mission");
    setAdminError(null);
    try {
      const response = await fetch("/api/missions", { method: "DELETE" });
      const body = await readApiResponse<{ error?: string }>(
        response,
        "Could not delete saved Missions."
      );
      if (!response.ok) throw new Error(body.error ?? "Could not delete saved Missions.");
      await loadMissions();
      if (mission) {
        onMissionDeleted?.();
        onClose();
        return;
      }
      await onStateChanged();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };

  if (!open) return null;

  return (
    <div className="admin-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-title" data-testid="admin-drawer">
        <header>
          <div>
            <span className="eyebrow">ADMIN CONTROLS</span>
            <h2 id="admin-title">Runtime and cleanup</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close admin controls" title="Close"><X size={17} /></button>
        </header>

        <section className="admin-section">
          <div className="admin-section-title">
            <span><SquareTerminal size={16} /> CODEX CLI EXECUTIONS</span>
            <b>{codexMode.toUpperCase()} MODE</b>
          </div>
          <div className="process-list">
            {processes.length ? processes.map((entry) => (
              <article className="process-row" key={entry.pid}>
                <span className="process-live"><Radio size={12} /> ACTIVE</span>
                <div>
                  <strong>PID {entry.pid}</strong>
                  <code>{entry.workingDirectory ?? "Working directory unavailable"}</code>
                </div>
                <small>{entry.elapsed}</small>
              </article>
            )) : (
              <EmptyState icon={<SquareTerminal size={18} />}>No active Codex CLI executions.</EmptyState>
            )}
            {sdkOperations.map((entry) => (
              <article className="process-row" key={entry.id}>
                <span className="process-live"><Radio size={12} /> SDK STREAM</span>
                <div>
                  <strong>{entry.model}</strong>
                  <code>Reality {entry.realityId.slice(0, 12)} / {entry.id.slice(0, 8)}</code>
                </div>
                <small>{relativeAge(Date.now(), entry.startedAt)}</small>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="admin-stop"
            onClick={stopCodex}
            disabled={busy !== "idle" || (!processes.length && !sdkOperations.length)}
          >
            <Power size={15} /> {busy === "stopping" ? "Stopping Codex CLI" : "Stop all Codex CLI"}
          </button>
        </section>

        <section className="admin-section" data-testid="saved-mission-admin">
          <div className="admin-section-title">
            <span><GitBranch size={16} /> MISSION LIBRARY</span>
            <b>{savedMissions.length} AVAILABLE</b>
          </div>
          <div className="saved-mission-list">
            {savedMissions.map((saved) => (
              <article key={saved.id} data-testid="saved-mission-row">
                <a
                  className="saved-mission-open"
                  href={saved.href}
                  title={`Open ${saved.name}`}
                >
                  {saved.kind === "demo" ? <LockKeyhole size={13} /> : <GitBranch size={13} />}
                  <span>
                    <strong>{saved.name}</strong>
                    <small>
                      {saved.kind === "demo" ? "DEMO / IMMUTABLE / " : ""}
                      {saved.status.toUpperCase()} / {saved.realityCount} REALITIES
                    </small>
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => void resetSavedMission(saved)}
                  disabled={busy !== "idle" || !saved.canReset}
                  aria-label={`Reset saved Mission ${saved.name}`}
                  title="Form a clean replacement from the same Mission definition"
                >
                  <RotateCcw size={13} />
                </button>
                <a
                  href={saved.exportHref}
                  download
                  aria-label={`Export saved Mission ${saved.name}`}
                  title="Export safe Mission history"
                >
                  <Download size={13} />
                </a>
                {saved.canDelete ? (
                  <button
                    type="button"
                    onClick={() => void deleteSavedMission(saved)}
                    disabled={busy !== "idle"}
                    aria-label={`Delete saved Mission ${saved.name}`}
                    title="Delete Mission and clean up its worktrees"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : (
                  <span
                    className="saved-mission-locked"
                    aria-label={`${saved.name} cannot be deleted`}
                    title="Built-in Demo Mission cannot be deleted"
                  >
                    <LockKeyhole size={13} />
                  </span>
                )}
              </article>
            ))}
            {!savedMissions.length && (
              <EmptyState icon={<GitBranch size={18} />}>No saved Missions.</EmptyState>
            )}
          </div>
          <button
            type="button"
            className="admin-clear-missions"
            onClick={() => void deleteAllSavedMissions()}
            disabled={busy !== "idle" || !savedMissions.some((saved) => saved.canDelete)}
          >
            <Trash2 size={15} /> {busy === "managing-mission" ? "Managing Missions" : "Delete all user-created Missions"}
          </button>
        </section>

        <section className="admin-section">
          <div className="admin-section-title">
            <span><History size={16} /> RETROSPECTIVE RUN LOG</span>
            <b>{archivedLogs.length} ARCHIVED</b>
          </div>
          {mission && (
            <div className="run-log-summary">
              <div>
                <span><b>{mission.eventCount}</b> Mission events</span>
                <span><b>{mission.realityCount}</b> Realities</span>
                <span><b>{mission.status}</b> state</span>
              </div>
              <small>The active Mission timeline is available in the shared Reality Events stream. Password-reset Mission archives remain available below for retrospective comparison.</small>
            </div>
          )}
          {!mission && currentLog && (
            <div className="run-log-summary">
              <div>
                <span><b>{currentLog.eventCount}</b> safe events</span>
                <span><b>{currentLog.commandCount}</b> commands</span>
                <span><b>{currentLog.failedCommandCount}</b> non-zero exits</span>
              </div>
              {Object.keys(currentLog.failureKinds).length > 0 && (
                <p>
                  {Object.entries(currentLog.failureKinds)
                    .map(([kind, count]) => `${count} ${kind}`)
                    .join(" / ")}
                  {currentLog.recoveredAfterFailure ? " / later checks recovered" : ""}
                </p>
              )}
              <small>Validated events only. Raw model reasoning and raw Codex command output are not retained.</small>
            </div>
          )}
          <a
            className="admin-export"
            href={mission
              ? `/api/missions/${encodeURIComponent(mission.id)}?download=1`
              : "/api/admin/history?id=current&download=1"}
            download
          >
            <Download size={15} /> {mission ? "Export Mission safe run log" : "Export current safe run log"}
          </a>
          {archivedLogs.length > 0 && (
            <div className="archive-list">
              {archivedLogs.slice(0, 5).map((archive) => (
                <article key={archive.id}>
                  <button
                    type="button"
                    onClick={() => void loadArchive(archive)}
                    disabled={busy !== "idle" || !onLoadArchive}
                    aria-label={`Open saved password-reset timeline from ${new Date(archive.archivedAt).toLocaleString()}`}
                    title={onLoadArchive ? "Open saved password-reset timeline" : "Open the password-reset Demo Mission to view this timeline"}
                  >
                    <History size={13} />
                    <span>Phase {archive.phase} / {archive.eventCount} events</span>
                    <small>{new Date(archive.archivedAt).toLocaleString()}</small>
                  </button>
                  <a
                    href={`/api/admin/history?id=${encodeURIComponent(archive.id)}&download=1`}
                    download
                    aria-label={`Download saved run ${archive.id}`}
                    title="Download safe run log"
                  >
                    <Download size={13} />
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-section admin-danger">
          <div className="admin-section-title">
            <span><Trash2 size={16} /> {mission ? "DELETE MISSION" : "FULL RESET"}</span>
          </div>
          <p>
            {mission
              ? "Deletes this saved Mission and removes its isolated Reality worktrees and branches. Other Missions and the password-reset Demo Mission remain unchanged."
              : "Stops Codex, archives safe telemetry, deletes active state, removes all Inception worktrees and branches, then forms one clean waking Reality."}
          </p>
          <button type="button" onClick={cleanup} disabled={busy !== "idle"}>
            <Trash2 size={15} /> {busy === "resetting"
              ? "Cleaning Reality state"
              : mission ? "Delete Mission and cleanup" : "Full reset and cleanup"}
          </button>
        </section>

        {adminError && <div className="admin-error"><XCircle size={15} />{adminError}</div>}
      </aside>
    </div>
  );
}

export function RealityTimeline({ events, index, onChange }: {
  events: RealityEvent[];
  index: number | null;
  onChange: (index: number | null) => void;
}) {
  const milestoneIndexes = events.reduce<number[]>((indexes, event, eventIndex) => {
    if (isTimelineMilestone(event)) indexes.push(eventIndex);
    return indexes;
  }, []);
  const maximum = Math.max(0, milestoneIndexes.length - 1);
  const firstLaterMilestone = index === null
    ? -1
    : milestoneIndexes.findIndex((eventIndex) => eventIndex > index);
  const position = index === null || firstLaterMilestone === -1
    ? maximum
    : Math.max(0, firstLaterMilestone - 1);
  const selectedIndex = milestoneIndexes[position] ?? 0;
  const selected = events[selectedIndex];
  return (
    <section className={`reality-timeline ${index !== null ? "is-replaying" : ""}`} data-testid="reality-timeline">
      <div>
        <History size={16} />
        <span>
          <small>{index === null ? "LIVE REALITY TIMELINE" : "REPLAYING VALIDATED EXPERIENCE"}</small>
          <strong>{selected?.summary ?? "Waking Reality formed"}</strong>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={maximum}
        value={position}
        disabled={milestoneIndexes.length < 2}
        onChange={(event) => onChange(milestoneIndexes[Number(event.target.value)] ?? 0)}
        aria-label="Replay Reality timeline"
      />
      <span className="timeline-position">
        {selected ? formatClock(selected.occurredAt) : "--:--:--"} / {position + 1} of {milestoneIndexes.length} milestones
      </span>
      <button type="button" onClick={() => onChange(null)} disabled={index === null}>
        <Radio size={13} /> Live
      </button>
    </section>
  );
}

export function DreamGate({ proposal, owner, onCancel, onConfirm }: {
  proposal: DreamProposal;
  owner: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dream-gate-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="dream-gate" role="dialog" aria-modal="true" aria-labelledby="dream-gate-title" data-testid="dream-gate">
        <header>
          <span><MoonStar size={16} /> DREAM PROPOSAL / {owner}</span>
          <button type="button" onClick={onCancel} aria-label="Close Dream proposal"><X size={16} /></button>
        </header>
        <div className="dream-gate-premise">
          <small>COUNTERFACTUAL PREMISE</small>
          <h2 id="dream-gate-title">{proposal.title}</h2>
          <p>{proposal.premise}</p>
        </div>
        <div className="dream-gate-decision">
          <div><span>MODEL-ESTIMATED IMPACT</span><strong>{Math.round((proposal.impactProbability ?? 0.5) * 100)}%</strong></div>
          <div><span>MODEL-ESTIMATED CODEX BUDGET</span><strong>{(proposal.estimatedTokens ?? 0).toLocaleString()} tokens</strong></div>
          <div><span>MODEL-ESTIMATED COST</span><strong>{proposal.costClass ?? "unscored"}</strong></div>
        </div>
        <div className="dream-gate-insight">
          <span>EXPECTED INSIGHT</span>
          <p>{proposal.expectedInsight ?? proposal.rationale}</p>
        </div>
        <footer>
          <button type="button" onClick={onCancel}>Keep waking Reality</button>
          <button type="button" className="confirm-dream" onClick={onConfirm}>
            <MoonStar size={16} /> Confirm and create Dream
          </button>
        </footer>
      </section>
    </div>
  );
}

function ActionDock({ snapshot, operation, loading, replaying, onAction, onReset }: {
  snapshot: PresentedDemoSnapshot;
  operation: PresentedRealityOperation | null;
  loading: LoadingState;
  replaying: boolean;
  onAction: (action: DemoAction) => void;
  onReset: () => void;
}) {
  const next = snapshot.nextAction;
  const busy = loading !== "idle"
    || operation !== null
    || replaying
    || snapshot.session.autopilot.mode === "running";
  const progress = snapshot.session.phase * 10;
  const isDream = next?.kind === "dream";
  const isKick = next?.kind === "kick";
  const isStandard = next && !isDream && !isKick;
  const complete = snapshot.session.phase === 10 && !next;
  const runsCodex = (operation?.executor ?? next?.executor) === "codex";
  const runtimeLabel = runsCodex
    ? snapshot.runtime.codexMode === "real" ? "STARTS REAL CODEX CLI IN THE ACTIVE WORKTREE" : "RUNS DEMO CODEX RUNTIME"
    : "ORCHESTRATED REALITY ACTION";
  const primaryCommand = (() => {
    switch (next?.id) {
      case "inspect": return "Run Codex audit";
      case "enter_subjects": return "Enter Subjects";
      case "discover_abuse": return "Run Codex investigation";
      case "synthesise": return "Synthesise memories";
      case "run_anchors": return "Run anchor tests";
      case "repair": return "Repair proof";
      case "stabilise": return "Stabilise Reality";
      default: return next ? "Advance Reality" : "Reality stabilised";
    }
  })();

  return (
    <div className={`action-dock ${complete ? "is-complete" : ""}`} data-testid="action-dock">
      <div className="dock-progress">
        <span><b>{snapshot.session.phase}</b> / 10</span>
        <small>{replaying ? "REPLAY MODE / LIVE REALITY PAUSED" : `NEXT MOVE / ${runtimeLabel}`}</small>
        <strong data-testid="next-move">
          {replaying ? "Return the timeline to Live to continue" : operation?.label ?? next?.label ?? "Reality stabilised"}
        </strong>
        <div><i style={{ width: `${progress}%` }} /></div>
      </div>
      <button type="button" className="reset-command" data-testid="reset-run" onClick={onReset} disabled={busy} title="Full reset this run">
        <RotateCcw size={16} /> Full reset
      </button>
      <button type="button" className={`dream-command ${isDream ? "is-next" : ""}`} data-testid="dream-action" onClick={() => next && onAction(next.id)} disabled={busy || !isDream}>
        <MoonStar size={17} /> {isDream ? next.label : "Dream"}
      </button>
      <button type="button" className={`kick-command ${isKick ? "is-next" : ""}`} data-testid="kick-action" onClick={() => next && onAction(next.id)} disabled={busy || !isKick}>
        <ArrowUpFromLine size={17} /> {isKick ? "Kick and return memory" : "Kick"}
      </button>
      <button
        type="button"
        className={`primary-command ${isStandard ? "is-next" : ""}`}
        data-testid="primary-action"
        onClick={() => next && onAction(next.id)}
        disabled={busy || !isStandard}
      >
        {operation ? <><span className="button-spinner" />{operation.executor === "codex" ? "Codex working" : "Operation active"}</> : loading !== "idle" ? (
          <><span className="button-spinner" />Entering operation</>
        ) : (
          <>{next ? <Play size={16} /> : <CheckCircle2 size={16} />}{primaryCommand}</>
        )}
      </button>
    </div>
  );
}

function DemoAutoModeBar({
  snapshot,
  busy,
  onControl
}: {
  snapshot: PresentedDemoSnapshot;
  busy: boolean;
  onControl(command: "start" | "resume" | "pause" | "stop"): void;
}) {
  if (snapshot.runtime.codexMode !== "mock") return null;
  const state = snapshot.session.autopilot;
  const running = state.mode === "running";
  const paused = state.mode === "paused";
  return (
    <section className={`mission-autopilot autopilot-${state.mode}`} data-testid="demo-autopilot">
      <div>
        <span><Play size={15} /></span>
        <p>
          <small>RECORDING AUTO MODE / DETERMINISTIC / NO CODEX USAGE</small>
          <strong>{running ? "Advancing the Demo Mission for a consistent recording" : paused ? state.pauseReason ?? "Recording path paused" : state.mode === "completed" ? "Demo Mission reached a stable Reality" : "Manual control"}</strong>
        </p>
      </div>
      <dl>
        <div><dt>ACTIONS</dt><dd>{state.actionsCompleted} / {state.maxActions}</dd></div>
        <div><dt>PACE</dt><dd>{(state.paceMilliseconds / 1_000).toFixed(1)}s</dd></div>
      </dl>
      <nav aria-label="Demo recording auto mode controls">
        {["off", "stopped", "completed"].includes(state.mode) && snapshot.session.phase < 10 && (
          <button type="button" onClick={() => onControl("start")} disabled={busy}>
            <Play size={14} /> Start recording auto
          </button>
        )}
        {running && (
          <button type="button" onClick={() => onControl("pause")} disabled={busy}>
            <Pause size={14} /> Pause
          </button>
        )}
        {paused && (
          <button type="button" className="is-primary" onClick={() => onControl("resume")} disabled={busy}>
            <Play size={14} /> Resume
          </button>
        )}
        {(running || paused) && (
          <button type="button" onClick={() => onControl("stop")} disabled={busy}>
            <SquareTerminal size={13} /> Stop
          </button>
        )}
      </nav>
    </section>
  );
}

export function RealityWorkspace({
  realities,
  sourceRealities = realities,
  events,
  activeRealityId,
  selectedRealityId,
  onSelectReality,
  inspectorTab,
  onInspectorTab,
  operation,
  now,
  pulseRealityId = null,
  graphRealities = realities,
  memoryIntegrity = [],
  anchorResults = [],
  regressionResult,
  finalDiff = "",
  revealCode,
  onToggleCode,
  hasMoreEvents = false,
  loadingMoreEvents = false,
  onLoadMoreEvents,
  totalEventCount = events.length
}: {
  realities: Reality[];
  sourceRealities?: Reality[];
  events: RealityEvent[];
  activeRealityId: string;
  selectedRealityId: string | null;
  onSelectReality(id: string): void;
  inspectorTab: InspectorTab;
  onInspectorTab(tab: InspectorTab): void;
  operation: PresentedRealityOperation | null;
  now: number;
  pulseRealityId?: string | null;
  graphRealities?: Reality[];
  memoryIntegrity?: MemoryIntegritySeal[];
  anchorResults?: AnchorResult[];
  regressionResult?: RegressionResult;
  finalDiff?: string;
  revealCode: boolean;
  onToggleCode(): void;
  hasMoreEvents?: boolean;
  loadingMoreEvents?: boolean;
  onLoadMoreEvents?: () => void;
  totalEventCount?: number;
}) {
  const selectedReality = realities.find((reality) => reality.id === selectedRealityId)
    ?? realities.find((reality) => reality.id === activeRealityId)
    ?? realities[0];
  if (!selectedReality) return null;

  const root = realities.find((reality) => reality.depth === 0);
  const proposals = realities.flatMap((reality) =>
    reality.proposals.map((proposal) => ({ ...proposal, owner: reality.name }))
  );
  const memories = realities.flatMap((reality) =>
    reality.wakeReport ? [{ reality, report: reality.wakeReport }] : []
  );
  const initialBelief = root?.beliefs.find((belief) => belief.origin === "initial")
    ?? root?.beliefs[0];
  const finalBelief = root?.beliefs.at(-1);
  const displayedAnchors: Array<{
    anchorId: string;
    name: string;
    status: "passed" | "failed" | "pending";
    command?: string;
    durationMs?: number;
  }> = anchorResults.length
    ? anchorResults
    : root?.anchors.map((anchor) => ({
        anchorId: anchor.id,
        name: anchor.name,
        status: anchor.status === "failed" ? "failed" as const : "pending" as const
      })) ?? [];

  return (
    <div data-testid="reality-workspace">
      <section className="topology-workspace">
        <div className="map-section">
          <SectionHeading
            icon={<Network size={18} />}
            eyebrow="REALITY TOPOLOGY"
            title="Counterfactual world graph"
            meta={<span className="locus-key"><Radio size={11} /> LOCUS: {sourceRealities.find((entry) => entry.id === activeRealityId)?.name}</span>}
          />
          <RealityGraph
            realities={graphRealities}
            locusId={activeRealityId}
            selectedId={selectedReality.id}
            pulseId={pulseRealityId}
            onSelect={onSelectReality}
          />
          <div className="map-footer">
            <span><i className="key-waking" /> Waking Reality</span>
            <span><i className="key-dream" /> Dream</span>
            <span><i className="key-memory" /> Memory path</span>
            <small>Select a world to inspect its own thread, worktree, evidence, and contract.</small>
          </div>
        </div>
        <WorldInspector
          reality={selectedReality}
          locus={selectedReality.id === activeRealityId}
          tab={inspectorTab}
          operation={operation}
          now={now}
          onTab={onInspectorTab}
        />
      </section>

      <section className="world-ledger">
        <div className="ledger-column">
          <SectionHeading
            icon={<Search size={18} />}
            eyebrow="UNCERTAINTY LEDGER"
            title="Dream proposals"
            meta={<span className="count-label">{proposals.filter((proposal) => proposal.status !== "resolved").length} unresolved</span>}
          />
          <div className="proposal-list">
            {proposals.length ? proposals.map((proposal) => (
              <article className={`proposal-row proposal-${proposal.status}`} key={proposal.id}>
                <span className="proposal-status"><CircleDot size={14} />{proposal.status}</span>
                <div>
                  <small>{proposal.owner} / {proposal.title}</small>
                  <h3>{proposal.uncertainty}</h3>
                  <p>{proposal.rationale}</p>
                  <span className="proposal-metadata">
                    <b>estimate: {Math.round((proposal.impactProbability ?? 0.5) * 100)}% impact</b>
                    <b>estimate: {(proposal.estimatedTokens ?? 0).toLocaleString()} tokens</b>
                    <b>estimate: {proposal.costClass ?? "unscored"} cost</b>
                  </span>
                </div>
                <ChevronRight size={16} />
              </article>
            )) : <EmptyState icon={<MoonStar size={19} />}>No uncertainty has been made concrete.</EmptyState>}
          </div>
        </div>

        <div className="ledger-column">
          <SectionHeading
            icon={<UsersRound size={18} />}
            eyebrow={`SUBJECTS / ${selectedReality.name}`}
            title="Bounded investigations"
            meta={<span className="count-label">{selectedReality.subjects.length} subjects</span>}
          />
          <div className="subject-list">
            {selectedReality.subjects.length ? selectedReality.subjects.map((subject) => (
              <article className="subject-row" key={subject.id}>
                <span className="subject-initial">{subject.name[0]}</span>
                <div><h3>{subject.name}<small>{subject.role}</small></h3><p>{subject.findings[0] ?? subject.mission}</p></div>
                <span className={`subject-state subject-${subject.status}`}>{subject.status}</span>
              </article>
            )) : <EmptyState icon={<UsersRound size={19} />}>No Subjects have entered this Reality.</EmptyState>}
          </div>
        </div>

        <div className="ledger-column">
          <SectionHeading
            icon={<FlaskConical size={18} />}
            eyebrow={`EVIDENCE / ${selectedReality.name}`}
            title="Experienced facts"
            meta={<span className="count-label">{selectedReality.evidence.length} items</span>}
          />
          <div className="evidence-list">
            {selectedReality.evidence.length ? selectedReality.evidence.slice().reverse().map((evidence) => {
              const wakeSource = evidence.source.startsWith("wake-report:")
                ? evidence.source.slice("wake-report:".length)
                : null;
              const sourceReality = wakeSource
                ? sourceRealities.find((reality) => reality.id === wakeSource || reality.name === wakeSource)
                : null;
              const title = evidence.title.startsWith("Memory inherited from ")
                ? `Memory returned from ${sourceReality?.name ?? "child Reality"}`
                : evidence.title;
              return (
                <article className="evidence-row" key={evidence.id}>
                  <span className={`evidence-icon evidence-${evidence.kind}`}>
                    {evidence.kind === "test" ? <TestTube2 size={15} /> : evidence.kind === "code" ? <Code2 size={15} /> : <CircleDot size={15} />}
                  </span>
                  <div>
                    <small>{evidence.kind} / {evidence.provenance ?? "observed"} / {evidence.source}</small>
                    <h3>{title}</h3><p>{evidence.summary}</p>
                  </div>
                </article>
              );
            }) : <EmptyState icon={<FlaskConical size={19} />}>No decisive evidence exists in this world yet.</EmptyState>}
          </div>
        </div>
      </section>

      <section className="memory-workspace">
        <SectionHeading
          icon={<BrainCircuit size={18} />}
          eyebrow="MEMORIES"
          title="Belief transformation"
          meta={<span className="validated-count"><ShieldCheck size={13} />{memories.length} validated reports</span>}
        />
        <div className="belief-strip">
          <div>
            <span>INITIAL BELIEF / MODEL-REPORTED {Math.round((initialBelief?.confidence ?? 0) * 100)}%</span>
            <p>{initialBelief?.statement ?? "No initial belief recorded."}</p>
          </div>
          <span className="belief-route"><i /><ArrowRight size={18} /><i /></span>
          <div>
            <span>CURRENT WAKING BELIEF / MODEL-REPORTED {Math.round((finalBelief?.confidence ?? 0) * 100)}%</span>
            <p>{finalBelief?.statement ?? "Awaiting returned memory."}</p>
          </div>
        </div>
        <div className="memory-list">
          {memories.length
            ? memories.slice().reverse().map(({ reality, report }) => (
                <MemoryReport
                  reality={reality}
                  report={report}
                  seal={memoryIntegrity.find((entry) => entry.realityId === reality.id)}
                  key={reality.id}
                />
              ))
            : <EmptyState icon={<ArrowUpFromLine size={19} />}>Kick a Dream to return a validated Wake Report.</EmptyState>}
        </div>
      </section>

      <section className="proof-workspace">
        <div className="proof-column anchor-proof">
          <SectionHeading
            icon={<LockKeyhole size={18} />}
            eyebrow="REALITY ANCHORS"
            title="Parent-owned invariants"
            meta={<span className="count-label">{displayedAnchors.length} anchors</span>}
          />
          <div className="anchor-list">
            {displayedAnchors.map((anchor) => (
              <article className={`anchor-row anchor-${anchor.status}`} key={anchor.anchorId}>
                <span>{anchor.status === "passed" ? <Check size={15} /> : anchor.status === "failed" ? <X size={15} /> : <LockKeyhole size={14} />}</span>
                <div>
                  <h3>{anchor.name}</h3>
                  <p>{anchor.status === "passed" ? "Immutable requirement survived synthesis." : anchor.status === "failed" ? "Waking implementation violated this anchor." : "Hidden from child mutation; awaiting synthesis."}</p>
                  {anchor.command && <small>{anchor.command} / {anchor.durationMs}ms</small>}
                </div>
              </article>
            ))}
            {regressionResult && (
              <article className={`anchor-row anchor-${regressionResult.status}`} data-testid="regression-proof">
                <span>{regressionResult.status === "passed" ? <Check size={15} /> : <X size={15} />}</span>
                <div>
                  <h3>Inherited regression suite</h3>
                  <p>{regressionResult.status === "passed"
                    ? `${regressionResult.testFiles.length} test artefacts agree with the waking implementation.`
                    : "A returned or discovered test still contradicts the waking implementation."}</p>
                  <small>{regressionResult.command} / {regressionResult.durationMs}ms</small>
                </div>
              </article>
            )}
          </div>
        </div>
        <div className="proof-column event-proof">
          <SectionHeading icon={<Radio size={18} />} eyebrow="REALITY EVENTS" title="Safe experience stream" meta={<span className="stream-pulse" />} />
          <EventFeed
            events={events}
            realities={realities}
            now={now}
            hasMore={hasMoreEvents}
            loadingMore={loadingMoreEvents}
            onLoadMore={onLoadMoreEvents}
            totalCount={totalEventCount}
          />
        </div>
      </section>

      {finalDiff && (
        <section className="diff-workspace">
          <SectionHeading
            icon={<FileDiff size={18} />}
            eyebrow="WAKING IMPLEMENTATION"
            title="Final Git diff"
            meta={(
              <span className="diff-actions">
                <span className="diff-meta"><GitBranch size={13} />{root?.branchName}</span>
                <button type="button" onClick={onToggleCode} data-testid="reveal-code">
                  <Eye size={13} /> {revealCode ? "Hide code" : "Reveal code"}
                </button>
              </span>
            )}
          />
          {revealCode
            ? <pre>{finalDiff}</pre>
            : <EmptyState icon={<FileDiff size={19} />}>The implementation is preserved behind the returned knowledge. Reveal it when the proof matters.</EmptyState>}
        </section>
      )}
    </div>
  );
}

export function RealityEngine() {
  const [snapshot, setSnapshot] = useState<PresentedDemoSnapshot | null>(null);
  const [selectedRealityId, setSelectedRealityId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("world");
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pulseRealityId, setPulseRealityId] = useState<string | null>(null);
  const [localOperation, setLocalOperation] = useState<ActiveRealityOperation | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [adminOpen, setAdminOpen] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [collapsedDreams, setCollapsedDreams] = useState(false);
  const [revealCode, setRevealCode] = useState(false);
  const [pendingDreamAction, setPendingDreamAction] = useState<DemoAction | null>(null);
  const [wakeStage, setWakeStage] = useState<"collecting" | "sealing" | "returning" | null>(null);
  const [wakeRealityName, setWakeRealityName] = useState<string | undefined>();
  const wakeClearTimer = useRef<number | null>(null);
  const [loadedArchive, setLoadedArchive] = useState<{
    id: string;
    archivedAt: string;
  } | null>(null);

  const loadSnapshot = useCallback(async (preserveError = false) => {
    const response = await fetch("/api/demo", { cache: "no-store" });
    const body = await readApiResponse<PresentedDemoSnapshot & { error?: string }>(
      response,
      "Could not enter the Reality Engine."
    );
    if (!response.ok) throw new Error(body.error ?? "Could not enter the Reality Engine.");
    setSnapshot(body);
    if (!preserveError) setError(null);
    setSelectedRealityId((current) => current ?? body.session.activeRealityId);
  }, []);

  useEffect(() => {
    if (loadedArchive) return;
    loadSnapshot().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const source = new EventSource("/api/events");
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as RealityEvent | { type: string };
      if ("realityId" in event && ["kick.triggered", "memory.returned", "reality.stabilised"].includes(event.type)) {
        setPulseRealityId(event.realityId);
        window.setTimeout(() => setPulseRealityId(null), 1400);
      }
      if ("realityId" in event) {
        if (event.type === "wake.collecting" || event.type === "kick.triggered") {
          setWakeStage("collecting");
        } else if (event.type === "wake.sealing") {
          setWakeStage("sealing");
        } else if (event.type === "wake.returning") {
          setWakeStage("returning");
        }
        if (event.type.startsWith("wake.") || event.type === "kick.triggered") {
          setWakeRealityName((current) => current ?? "Active Dream");
        }
        if (event.type === "wake.returning" || event.type === "memory.quarantined") {
          if (wakeClearTimer.current) window.clearTimeout(wakeClearTimer.current);
          wakeClearTimer.current = window.setTimeout(() => {
            setWakeStage(null);
            setWakeRealityName(undefined);
          }, 2_000);
        }
        setSnapshot((current) => {
          if (!current || current.events.some((existing) => existing.id === event.id)) return current;
          return { ...current, events: [...current.events, event] };
        });
        if (event.type !== "codex.progress") {
          loadSnapshot().catch(() => undefined);
        }
      }
    };
    return () => {
      source.close();
      if (wakeClearTimer.current) window.clearTimeout(wakeClearTimer.current);
    };
  }, [loadSnapshot, loadedArchive]);

  const openArchive = (archive: RealityRunArchive) => {
    const activeReality = archive.realities.find(
      (reality) => reality.id === archive.session.activeRealityId
    ) ?? archive.realities.find((reality) => reality.depth === 0) ?? null;
    setSnapshot((current) => ({
      session: archive.session,
      realities: archive.realities,
      events: archive.events,
      activeReality,
      operation: null,
      nextAction: null,
      runtime: current?.runtime ?? {
        codexMode: "mock",
        persistence: "sqlite-fallback",
        model: "gpt-5.6",
        sdkVersion: "unknown"
      }
    }));
    setLoadedArchive({ id: archive.id, archivedAt: archive.archivedAt });
    setSelectedRealityId(activeReality?.id ?? null);
    setInspectorTab("world");
    setLocalOperation(null);
    setTimelineIndex(null);
    setCollapsedDreams(false);
    setRevealCode(false);
    setError(null);
  };

  const returnToLive = async () => {
    setLoadedArchive(null);
    setTimelineIndex(null);
    setCollapsedDreams(false);
    setRevealCode(false);
    setSelectedRealityId(null);
    await loadSnapshot().catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  };

  const act = async (action: DemoAction) => {
    const next = snapshot?.nextAction;
    setLocalOperation({
      id: `local-${Date.now()}`,
      action,
      label: next?.label ?? action,
      executor: next?.executor ?? "orchestrator",
      realityId: snapshot?.session.activeRealityId ?? "",
      startedAt: new Date().toISOString()
    });
    setLoading("acting");
    setError(null);
    if (action === "wake_nested" || action === "wake_parent") {
      setWakeStage("collecting");
      setWakeRealityName(snapshot?.activeReality?.name);
    }
    try {
      const response = await fetch("/api/demo/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await readApiResponse<PresentedDemoSnapshot & { error?: string }>(
        response,
        "The Reality rejected that action."
      );
      if (!response.ok) throw new Error(body.error ?? "The Reality rejected that action.");
      setSnapshot(body);
      setSelectedRealityId(body.session.activeRealityId);
      setInspectorTab("world");
      setTimelineIndex(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await loadSnapshot(true).catch(() => undefined);
      setError(message);
      setWakeStage(null);
    } finally {
      setLocalOperation(null);
      setLoading("idle");
    }
  };

  const controlDemoAutopilot = async (command: "start" | "resume" | "pause" | "stop") => {
    setLoading("acting");
    setError(null);
    try {
      const response = await fetch("/api/demo/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const body = await readApiResponse<PresentedDemoSnapshot & { error?: string }>(
        response,
        "Demo recording auto mode could not change state."
      );
      if (!response.ok) throw new Error(body.error ?? "Demo recording auto mode could not change state.");
      setSnapshot(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await loadSnapshot(true).catch(() => undefined);
    } finally {
      setLoading("idle");
    }
  };

  const reset = async () => {
    if (!window.confirm("Full reset archives the validated run log, deletes active Reality state, and removes its Git worktrees before forming a clean waking Reality. Continue?")) return;
    setLoading("resetting");
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const body = await readApiResponse<PresentedDemoSnapshot & { error?: string }>(
        response,
        "The Reality could not be reset."
      );
      if (!response.ok) throw new Error(body.error ?? "The Reality could not be reset.");
      setSnapshot(body);
      setSelectedRealityId(body.session.activeRealityId);
      setInspectorTab("world");
      setTimelineIndex(null);
      setCollapsedDreams(false);
      setRevealCode(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading("idle");
    }
  };

  const replayedRealities = useMemo(
    () => snapshot ? replayRealities(snapshot.realities, snapshot.events, timelineIndex) : [],
    [snapshot, timelineIndex]
  );
  const visibleEvents = useMemo(
    () => snapshot
      ? timelineIndex === null ? snapshot.events : snapshot.events.slice(0, timelineIndex + 1)
      : [],
    [snapshot, timelineIndex]
  );
  const displayedPhase = timelineIndex === null
    ? snapshot?.session.phase ?? 0
    : replayPhase(visibleEvents, snapshot?.realities ?? []);
  const selectedReality = replayedRealities.find((reality) => reality.id === selectedRealityId)
    ?? replayedRealities.find((reality) => reality.id === snapshot?.session.activeRealityId)
    ?? replayedRealities[0]
    ?? null;
  const root = replayedRealities.find((reality) => reality.depth === 0) ?? null;
  const memories = useMemo(
    () => replayedRealities.flatMap((reality) => reality.wakeReport ? [{ reality, report: reality.wakeReport }] : []),
    [replayedRealities]
  );
  const activeOperation = snapshot?.operation ?? localOperation;
  const passedAnchorCount = snapshot?.session.anchorResults.filter((anchor) => anchor.status === "passed").length ?? 0;
  const graphRealities = collapsedDreams && root ? [root] : replayedRealities;
  const pendingProposal = snapshot?.activeReality?.proposals.find((proposal) => proposal.status === "open") ?? null;
  const requestAction = (action: DemoAction) => {
    if (action === "create_attack_dream" || action === "create_nested_dream") {
      setPendingDreamAction(action);
      return;
    }
    void act(action);
  };

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      activeOperation ? 1000 : 15_000
    );
    return () => window.clearInterval(timer);
  }, [activeOperation?.id]);

  if (!snapshot || !selectedReality) {
    return (
      <main className="loading-screen">
        <div className="loading-mark"><Layers3 size={38} /><span /><span /></div>
        <h1>Inception</h1>
        <p>{error ?? "Forming the waking Reality..."}</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <RealityTopbar
        codexMode={snapshot.runtime.codexMode}
        model={snapshot.runtime.model}
        environment={snapshot.runtime.persistence === "prisma" ? "PRISMA" : "PORTABLE SQLITE"}
        realityCount={snapshot.realities.length}
        actions={(
          <>
            {snapshot.runtime.codexMode === "real" && (
              <a className="mission-link" href="/missions" title="Mission Control" aria-label="Open Mission Control">
                <GitBranch size={13} />
                <span>MISSION CONTROL</span>
              </a>
            )}
            <button type="button" className="admin-trigger" data-testid="admin-trigger" onClick={() => setAdminOpen(true)} title="Admin controls" aria-label="Open admin controls">
              <Settings size={15} />
            </button>
          </>
        )}
      />

      <RealityPhaseHeader
        eyebrow={loadedArchive
          ? "SAVED SCENARIO / PASSWORD RESET"
          : timelineIndex === null
            ? "DEMO MISSION / PASSWORD RESET"
            : "TIMELINE REPLAY / VALIDATED MEMORY"}
        title={phaseTitle(displayedPhase)}
        steps={stages.map((stage, index) => {
            const previousEnd = stages[index - 1]?.endPhase ?? 0;
            return {
              label: stage.label,
              complete: displayedPhase >= stage.endPhase,
              current: displayedPhase > previousEnd && displayedPhase < stage.endPhase
                || displayedPhase === 0 && index === 0
            };
          })}
      />

      <RealityJourneyBand
        realities={snapshot.realities}
        events={snapshot.events}
        stabilised={snapshot.session.phase === 10}
      />

      <DemoAutoModeBar
        snapshot={snapshot}
        busy={loading !== "idle" || Boolean(activeOperation)}
        onControl={(command) => void controlDemoAutopilot(command)}
      />

      {loadedArchive && (
        <section className="archive-view-banner" data-testid="archive-view-banner">
          <History size={17} />
          <span>
            <b>Saved Reality timeline</b>
            Read-only validated memory archived {new Date(loadedArchive.archivedAt).toLocaleString()}.
          </span>
          <button type="button" onClick={() => void returnToLive()}>
            <Radio size={14} /> Return to live Reality
          </button>
        </section>
      )}

      {error && <div className="error-banner"><XCircle size={17} /><span><b>Reality fracture</b>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><X size={15} /></button></div>}

      {snapshot.session.phase === 10 && (
        <section className="outcome-summary" data-testid="outcome-summary">
          <div className="outcome-intro">
            <span className="eyebrow">WAKING OUTCOME</span>
            <h2>Password reset now survives rotating-source abuse</h2>
            <p>Two returned memories changed one IP-only control into generic responses plus IP, identifier, and global request budgets while preserving token expiry.</p>
          </div>
          <div className="outcome-results" aria-label="Security outcome">
            <div>
              <ShieldCheck size={19} />
              <span><b>Enumeration closed</b><small>Known and unknown accounts receive one public response.</small></span>
            </div>
            <div>
              <CircleDot size={19} />
              <span><b>Rotating sources contained</b><small>One identifier is capped at 3 delivered resets per hour.</small></span>
            </div>
            <div>
              <CheckCircle2 size={19} />
              <span><b>Anchor proof</b><small>{passedAnchorCount} of {snapshot.session.anchorResults.length} immutable requirements passed.</small></span>
            </div>
          </div>
          <p className="outcome-boundary">
            <LockKeyhole size={15} />
            <span><b>Production boundary</b> Move counters to an atomic shared store and calibrate thresholds from operational telemetry.</span>
          </p>
          <div className="outcome-actions">
            <button type="button" onClick={() => {
              setCollapsedDreams((current) => !current);
              if (!collapsedDreams && root) setSelectedRealityId(root.id);
            }} data-testid="collapse-dreams">
              <Minimize2 size={15} /> {collapsedDreams ? "Reveal lived Realities" : "Collapse Dreams into waking Reality"}
            </button>
            <span title={memories.flatMap(({ report }) => report.invariants).join(" / ")}>
              <BrainCircuit size={14} /> {memories.reduce((total, memory) => total + memory.report.invariants.length, 0)} inherited truths
            </span>
          </div>
        </section>
      )}

      {activeOperation && (
        <OperationMonitor
          operation={activeOperation}
          realities={snapshot.realities}
          events={snapshot.events}
          now={now}
        />
      )}

      <WakeTransition stage={wakeStage} realityName={wakeRealityName} />

      <RealityTimeline events={snapshot.events} index={timelineIndex} onChange={setTimelineIndex} />

      <RealityWorkspace
        realities={replayedRealities}
        sourceRealities={snapshot.realities}
        events={visibleEvents}
        activeRealityId={snapshot.session.activeRealityId ?? root?.id ?? ""}
        selectedRealityId={selectedReality.id}
        onSelectReality={setSelectedRealityId}
        inspectorTab={inspectorTab}
        onInspectorTab={setInspectorTab}
        operation={activeOperation}
        now={now}
        pulseRealityId={pulseRealityId}
        graphRealities={graphRealities}
        memoryIntegrity={snapshot.session.memoryIntegrity}
        anchorResults={snapshot.session.anchorResults}
        regressionResult={snapshot.session.regressionResult}
        finalDiff={snapshot.session.finalDiff}
        revealCode={revealCode}
        onToggleCode={() => setRevealCode((current) => !current)}
      />

      <AdminDrawer
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onFullReset={(cleanSnapshot) => {
          setSnapshot(cleanSnapshot);
          setLoadedArchive(null);
          setSelectedRealityId(cleanSnapshot.session.activeRealityId);
          setInspectorTab("world");
          setLocalOperation(null);
          setLoading("idle");
          setTimelineIndex(null);
          setCollapsedDreams(false);
          setRevealCode(false);
        }}
        onLoadArchive={openArchive}
        onStateChanged={loadSnapshot}
      />

      {pendingDreamAction && pendingProposal && (
        <DreamGate
          proposal={pendingProposal}
          owner={snapshot.activeReality?.name ?? "Current Reality"}
          onCancel={() => setPendingDreamAction(null)}
          onConfirm={() => {
            const action = pendingDreamAction;
            setPendingDreamAction(null);
            void act(action);
          }}
        />
      )}

      {!loadedArchive && (
        <ActionDock
          snapshot={snapshot}
          operation={activeOperation}
          loading={loading}
          replaying={timelineIndex !== null}
          onAction={requestAction}
          onReset={reset}
        />
      )}
    </main>
  );
}
