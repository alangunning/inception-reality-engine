"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  FileCode2,
  FileDiff,
  FlaskConical,
  GitBranch,
  History,
  Layers3,
  LockKeyhole,
  MoonStar,
  Network,
  Play,
  Power,
  Radio,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SquareTerminal,
  TestTube2,
  Trash2,
  UsersRound,
  X,
  XCircle
} from "lucide-react";
import type { Reality, RealityEvent, WakeReport } from "@inception/domain";
import type { ActiveRealityOperation, DemoAction, DemoSnapshot } from "@inception/orchestrator";

type LoadingState = "idle" | "acting" | "resetting";
type InspectorTab = "world" | "constitution" | "runtime";
type EventFamily = "all" | "codex" | "dream" | "subject" | "evidence" | "memory" | "anchor" | "reality";
type EventSort = "newest" | "oldest";
type PresentedDemoSnapshot = DemoSnapshot & {
  runtime: {
    codexMode: "mock" | "real";
    persistence: "prisma" | "sqlite-fallback";
  };
};

interface SafeEventMetadata {
  stage?: "thread" | "turn" | "command" | "file" | "tool" | "search" | "plan";
  status?: "started" | "updated" | "completed" | "failed";
  detail?: string;
  command?: string;
  paths?: string[];
  tool?: string;
  exitCode?: number;
  completedItems?: number;
  totalItems?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  failureKind?: "test" | "environment" | "configuration" | "missing-tool" | "build" | "command";
  diagnostic?: string;
}

interface CodexProcess {
  pid: number;
  parentPid: number;
  elapsed: string;
  workingDirectory?: string;
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

const graphPositions: Record<number, { x: number; y: number }> = {
  0: { x: 150, y: 185 },
  1: { x: 500, y: 95 },
  2: { x: 845, y: 205 }
};

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
  if (prefix === "kick" || prefix === "memory" || prefix === "synthesis") return "memory";
  if (prefix === "anchor" || prefix === "validation") return "anchor";
  return "reality";
}

function SectionHeading({ icon, eyebrow, title, meta }: {
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

function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="empty-state">{icon}<span>{children}</span></div>;
}

function RealityGraph({ realities, locusId, selectedId, pulseId, onSelect }: {
  realities: Reality[];
  locusId: string | null;
  selectedId: string | null;
  pulseId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="reality-map" data-testid="reality-graph">
      <div className="map-grid" aria-hidden="true" />
      <div className="depth-rail depth-rail-0"><span>LEVEL 0</span><b>Waking</b></div>
      <div className="depth-rail depth-rail-1"><span>LEVEL 1</span><b>Dream</b></div>
      <div className="depth-rail depth-rail-2"><span>LEVEL 2</span><b>Nested dream</b></div>
      <svg className="map-links" viewBox="0 0 1000 320" preserveAspectRatio="none" aria-hidden="true">
        {realities.map((reality) => {
          const parent = realities.find((candidate) => candidate.id === reality.parentId);
          if (!parent) return null;
          const from = graphPositions[parent.depth];
          const to = graphPositions[reality.depth];
          if (!from || !to) return null;
          const returned = reality.status === "kicked";
          return (
            <g key={`${parent.id}-${reality.id}`}>
              <path
                className={`map-path ${returned ? "path-returned" : ""}`}
                d={`M ${from.x + 102} ${from.y} C ${from.x + 190} ${from.y}, ${to.x - 190} ${to.y}, ${to.x - 102} ${to.y}`}
              />
              {returned && (
                <circle className="memory-packet" r="4">
                  <animateMotion
                    dur="2.8s"
                    repeatCount="indefinite"
                    path={`M ${to.x - 102} ${to.y} C ${to.x - 190} ${to.y}, ${from.x + 190} ${from.y}, ${from.x + 102} ${from.y}`}
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {realities.map((reality) => {
        const position = graphPositions[reality.depth] ?? graphPositions[2]!;
        const selected = reality.id === selectedId;
        const locus = reality.id === locusId;
        return (
          <button
            type="button"
            className={`reality-node depth-node-${reality.depth} ${selected ? "is-selected" : ""} ${locus ? "is-locus" : ""} ${pulseId === reality.id ? "is-waking" : ""}`}
            style={{ left: `${position.x / 10}%`, top: `${position.y / 3.2}%` }}
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
  );
}

function WorldInspector({ reality, locus, tab, operation, now, onTab }: {
  reality: Reality;
  locus: boolean;
  tab: InspectorTab;
  operation: ActiveRealityOperation | null;
  now: number;
  onTab: (tab: InspectorTab) => void;
}) {
  const realityOperation = operation?.realityId === reality.id ? operation : null;
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
            <em>minutes</em>
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

function MemoryReport({ reality, report }: { reality: Reality; report: WakeReport }) {
  const changed = report.changedBeliefs[0];
  return (
    <article className="memory-report">
      <header>
        <span className="memory-level">L{reality.depth}</span>
        <div><small>MEMORY RETURNED</small><h3>{reality.name}</h3></div>
        <span className="validated-badge"><ShieldCheck size={13} /> VALIDATED</span>
      </header>
      {changed && (
        <div className="memory-belief">
          <div><span>ENTERED BELIEVING</span><p>{changed.from}</p></div>
          <ArrowRight size={18} />
          <div><span>WOKE BELIEVING / {Math.round(changed.confidence * 100)}%</span><p>{changed.to}</p></div>
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

function OperationMonitor({ operation, realities, events, now }: {
  operation: ActiveRealityOperation;
  realities: Reality[];
  events: RealityEvent[];
  now: number;
}) {
  const reality = realities.find((candidate) => candidate.id === operation.realityId);
  const operationEvents = events.filter((event) =>
    event.type === "codex.progress"
    && event.realityId === operation.realityId
    && new Date(event.occurredAt).getTime() >= new Date(operation.startedAt).getTime()
  );
  const latest = operationEvents.at(-1);
  const latestMetadata = latest ? safeEventMetadata(latest) : {};
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
  const toolCallCount = commandCount + fileCount + externalToolCount;

  return (
    <section className="operation-monitor" aria-live="polite" aria-label="Active Reality operation" data-testid="operation-monitor">
      <div className="operation-state">
        <span className="operation-live"><Radio size={12} /> LIVE OPERATION</span>
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
        <span title="Completed command, file, MCP, and search calls"><Radio size={14} /><b>{toolCallCount}</b> tool calls</span>
        <span><Layers3 size={14} /><b>{operationEvents.length}</b> milestones</span>
      </div>
      <div className="operation-latest">
        <time dateTime={latest?.occurredAt ?? operation.startedAt}>
          {formatClock(latest?.occurredAt ?? operation.startedAt)}
        </time>
        <span>
          <strong>{latest?.summary ?? `${operation.label} entered ${reality?.name ?? "the current Reality"}.`}</strong>
          {latestMetadata.diagnostic && <small className="event-diagnostic">{latestMetadata.diagnostic}</small>}
          {latest
            ? metadataDetail(latestMetadata) && <small>{metadataDetail(latestMetadata)}</small>
            : <small>Waiting for the first validated Codex milestone.</small>}
        </span>
        <em>{latestMetadata.stage ?? "orchestrator"} / {latestMetadata.status ?? "active"}</em>
      </div>
      <div className="operation-scan" aria-hidden="true"><i /></div>
    </section>
  );
}

function EventFeed({ events, realities, now }: { events: RealityEvent[]; realities: Reality[]; now: number }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<EventFamily>("all");
  const [sort, setSort] = useState<EventSort>("newest");
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
          metadataDetail(metadata)
        ].filter(Boolean).join(" ").toLowerCase().includes(normalisedQuery);
      })
      .sort((left, right) => {
        const difference = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
        return sort === "oldest" ? difference : -difference;
      });
  }, [events, family, query, realities, sort]);
  const renderedEvents = filteredEvents.slice(0, 200);

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
        <small>{renderedEvents.length} of {filteredEvents.length} / {events.length} total</small>
      </div>
      {renderedEvents.map((event) => {
        const reality = realities.find((candidate) => candidate.id === event.realityId);
        const metadata = safeEventMetadata(event);
        const detail = metadataDetail(metadata);
        return (
          <div className="event-row" data-testid="event-row" key={event.id}>
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
          </div>
        );
      })}
      {!renderedEvents.length && (
        <EmptyState icon={<Search size={18} />}>No Reality events match this view.</EmptyState>
      )}
    </div>
  );
}

function AdminDrawer({ open, onClose, onFullReset, onStateChanged }: {
  open: boolean;
  onClose: () => void;
  onFullReset: (snapshot: PresentedDemoSnapshot) => void;
  onStateChanged: () => Promise<void>;
}) {
  const [processes, setProcesses] = useState<CodexProcess[]>([]);
  const [currentLog, setCurrentLog] = useState<RunLogSummary | null>(null);
  const [archivedLogs, setArchivedLogs] = useState<RunLogSummary[]>([]);
  const [codexMode, setCodexMode] = useState<"mock" | "real">("mock");
  const [busy, setBusy] = useState<"idle" | "stopping" | "resetting">("idle");
  const [adminError, setAdminError] = useState<string | null>(null);

  const loadProcesses = useCallback(async () => {
    const response = await fetch("/api/admin/codex", { cache: "no-store" });
    const body = await response.json() as { processes?: CodexProcess[]; codexMode?: "mock" | "real"; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not inspect Codex processes.");
    setProcesses(body.processes ?? []);
    setCodexMode(body.codexMode ?? "mock");
  }, []);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/admin/history", { cache: "no-store" });
    const body = await response.json() as {
      current?: RunLogSummary;
      archives?: RunLogSummary[];
      error?: string;
    };
    if (!response.ok) throw new Error(body.error ?? "Could not load retrospective run logs.");
    setCurrentLog(body.current ?? null);
    setArchivedLogs(body.archives ?? []);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadProcesses().catch((cause) => setAdminError(cause instanceof Error ? cause.message : String(cause)));
    loadHistory().catch((cause) => setAdminError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => {
      loadProcesses().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadHistory, loadProcesses, open]);

  const stopCodex = async () => {
    if (!window.confirm(`Stop ${processes.length || "all"} active Codex CLI execution${processes.length === 1 ? "" : "s"}? In-flight Reality actions will return an error.`)) return;
    setBusy("stopping");
    setAdminError(null);
    try {
      const response = await fetch("/api/admin/codex", { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not stop Codex processes.");
      await loadProcesses();
      await onStateChanged();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };

  const fullReset = async () => {
    if (!window.confirm("Full reset stops active Codex CLI executions, archives the validated run log, deletes active Reality state, removes registered and orphaned worktrees, prunes Inception branches, and starts a clean waking Reality. Continue?")) return;
    setBusy("resetting");
    setAdminError(null);
    try {
      const response = await fetch("/api/admin/reset", { method: "POST" });
      const body = await response.json() as { snapshot?: PresentedDemoSnapshot; error?: string };
      if (!response.ok || !body.snapshot) throw new Error(body.error ?? "Could not fully reset the Reality Engine.");
      onFullReset(body.snapshot);
      setProcesses([]);
      onClose();
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
          </div>
          <button
            type="button"
            className="admin-stop"
            onClick={stopCodex}
            disabled={busy !== "idle" || !processes.length}
          >
            <Power size={15} /> {busy === "stopping" ? "Stopping Codex CLI" : "Stop all Codex CLI"}
          </button>
        </section>

        <section className="admin-section">
          <div className="admin-section-title">
            <span><History size={16} /> RETROSPECTIVE RUN LOG</span>
            <b>{archivedLogs.length} ARCHIVED</b>
          </div>
          {currentLog && (
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
          <a className="admin-export" href="/api/admin/history?id=current&download=1" download>
            <Download size={15} /> Export current safe run log
          </a>
          {archivedLogs.length > 0 && (
            <div className="archive-list">
              {archivedLogs.slice(0, 3).map((archive) => (
                <a href={`/api/admin/history?id=${encodeURIComponent(archive.id)}&download=1`} download key={archive.id}>
                  <span>Phase {archive.phase} / {archive.eventCount} events</span>
                  <small>{new Date(archive.archivedAt).toLocaleString()}</small>
                  <Download size={13} />
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="admin-section admin-danger">
          <div className="admin-section-title">
            <span><Trash2 size={16} /> FULL RESET</span>
          </div>
          <p>Stops Codex, archives safe telemetry, deletes active state, removes all Inception worktrees and branches, then forms one clean waking Reality.</p>
          <button type="button" onClick={fullReset} disabled={busy !== "idle"}>
            <Trash2 size={15} /> {busy === "resetting" ? "Resetting and cleaning" : "Full reset and cleanup"}
          </button>
        </section>

        {adminError && <div className="admin-error"><XCircle size={15} />{adminError}</div>}
      </aside>
    </div>
  );
}

function ActionDock({ snapshot, operation, loading, onAction, onReset }: {
  snapshot: PresentedDemoSnapshot;
  operation: ActiveRealityOperation | null;
  loading: LoadingState;
  onAction: (action: DemoAction) => void;
  onReset: () => void;
}) {
  const next = snapshot.nextAction;
  const busy = loading !== "idle" || operation !== null;
  const progress = snapshot.session.phase * 10;
  const isDream = next?.kind === "dream";
  const isKick = next?.kind === "kick";
  const isStandard = next && !isDream && !isKick;
  const runsCodex = (operation?.executor ?? next?.executor) === "codex";
  const runtimeLabel = runsCodex
    ? snapshot.runtime.codexMode === "real" ? "STARTS REAL CODEX CLI IN THE ACTIVE WORKTREE" : "RUNS REHEARSED CODEX RUNTIME"
    : "ORCHESTRATED REALITY ACTION";

  return (
    <div className="action-dock" data-testid="action-dock">
      <div className="dock-progress">
        <span><b>{snapshot.session.phase}</b> / 10</span>
        <small>NEXT MOVE / {runtimeLabel}</small>
        <strong data-testid="next-move">{operation?.label ?? next?.label ?? "Reality stabilised"}</strong>
        <div><i style={{ width: `${progress}%` }} /></div>
      </div>
      <button type="button" className="reset-command" data-testid="reset-run" onClick={onReset} disabled={busy} title="Full reset this run">
        <RotateCcw size={16} /> Full reset
      </button>
      <button type="button" className={`dream-command ${isDream ? "is-next" : ""}`} data-testid="dream-action" onClick={() => next && onAction(next.id)} disabled={busy || !isDream}>
        <MoonStar size={17} /> {isDream ? next.id === "create_nested_dream" ? "Create nested Dream" : "Create attack Dream" : "Dream"}
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
        {operation ? <><span className="button-spinner" />{operation.label}</> : loading !== "idle" ? (
          <><span className="button-spinner" />Entering operation</>
        ) : (
          <>{next ? <Play size={16} /> : <CheckCircle2 size={16} />}{isStandard ? next.label : next ? "Advance Reality" : "Reality stabilised"}</>
        )}
      </button>
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

  const loadSnapshot = useCallback(async () => {
    const response = await fetch("/api/demo", { cache: "no-store" });
    const body = await response.json() as PresentedDemoSnapshot & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not enter the Reality Engine.");
    setSnapshot(body);
    setError(null);
    setSelectedRealityId((current) => current ?? body.session.activeRealityId);
  }, []);

  useEffect(() => {
    loadSnapshot().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const source = new EventSource("/api/events");
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as RealityEvent | { type: string };
      if ("realityId" in event && ["kick.triggered", "memory.returned", "reality.stabilised"].includes(event.type)) {
        setPulseRealityId(event.realityId);
        window.setTimeout(() => setPulseRealityId(null), 1400);
      }
      if ("realityId" in event) {
        setSnapshot((current) => {
          if (!current || current.events.some((existing) => existing.id === event.id)) return current;
          return { ...current, events: [...current.events, event] };
        });
        if (event.type !== "codex.progress") {
          loadSnapshot().catch(() => undefined);
        }
      }
    };
    return () => source.close();
  }, [loadSnapshot]);

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
    try {
      const response = await fetch("/api/demo/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await response.json() as PresentedDemoSnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The Reality rejected that action.");
      setSnapshot(body);
      setSelectedRealityId(body.session.activeRealityId);
      setInspectorTab("world");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLocalOperation(null);
      setLoading("idle");
    }
  };

  const reset = async () => {
    if (!window.confirm("Full reset archives the validated run log, deletes active Reality state, and removes its Git worktrees before forming a clean waking Reality. Continue?")) return;
    setLoading("resetting");
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const body = await response.json() as PresentedDemoSnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The Reality could not be reset.");
      setSnapshot(body);
      setSelectedRealityId(body.session.activeRealityId);
      setInspectorTab("world");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading("idle");
    }
  };

  const selectedReality = snapshot?.realities.find((reality) => reality.id === selectedRealityId)
    ?? snapshot?.activeReality
    ?? null;
  const root = snapshot?.realities.find((reality) => reality.depth === 0) ?? null;
  const allProposals = useMemo(
    () => snapshot?.realities.flatMap((reality) => reality.proposals.map((proposal) => ({ ...proposal, owner: reality.name }))) ?? [],
    [snapshot]
  );
  const memories = useMemo(
    () => snapshot?.realities.flatMap((reality) => reality.wakeReport ? [{ reality, report: reality.wakeReport }] : []) ?? [],
    [snapshot]
  );
  const initialBelief = root?.beliefs.find((belief) => belief.origin === "initial") ?? root?.beliefs[0];
  const finalBelief = root?.beliefs.at(-1);
  const activeOperation = snapshot?.operation ?? localOperation;
  const passedAnchorCount = snapshot?.session.anchorResults.filter((anchor) => anchor.status === "passed").length ?? 0;

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
      <header className="topbar">
        <div className="brand">
          <div className="brand-symbol"><Layers3 size={22} /></div>
          <div><strong>INCEPTION</strong><span>Reality Engine</span></div>
        </div>
        <div className="topbar-status">
          <span className="stream-status"><Radio size={13} /> LIVE MEMORY STREAM</span>
          <span><BrainCircuit size={13} /> {snapshot.runtime.codexMode.toUpperCase()} CODEX</span>
          <span><Layers3 size={13} /> {snapshot.runtime.persistence === "prisma" ? "PRISMA" : "PORTABLE SQLITE"}</span>
          <span><Network size={13} /> {snapshot.realities.length} REALITIES</span>
          <button type="button" className="admin-trigger" data-testid="admin-trigger" onClick={() => setAdminOpen(true)} title="Admin controls" aria-label="Open admin controls">
            <Settings size={15} />
          </button>
        </div>
      </header>

      <section className="phase-header" data-testid="phase-header">
        <div>
          <span className="eyebrow">DETERMINISTIC SCENARIO / PASSWORD RESET</span>
          <h1>{phaseTitle(snapshot.session.phase)}</h1>
        </div>
        <ol className="phase-track" aria-label="Demo progress">
          {stages.map((stage, index) => {
            const previousEnd = stages[index - 1]?.endPhase ?? 0;
            const complete = snapshot.session.phase >= stage.endPhase;
            const current = snapshot.session.phase > previousEnd && snapshot.session.phase < stage.endPhase
              || snapshot.session.phase === 0 && index === 0;
            return (
              <li className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} key={stage.label}>
                <span>{complete ? <Check size={12} /> : index + 1}</span>
                <b>{stage.label}</b>
              </li>
            );
          })}
        </ol>
      </section>

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

      <section className="topology-workspace">
        <div className="map-section">
          <SectionHeading
            icon={<Network size={18} />}
            eyebrow="REALITY TOPOLOGY"
            title="Counterfactual world graph"
            meta={<span className="locus-key"><Radio size={11} /> LOCUS: {snapshot.activeReality?.name}</span>}
          />
          <RealityGraph
            realities={snapshot.realities}
            locusId={snapshot.session.activeRealityId}
            selectedId={selectedReality.id}
            pulseId={pulseRealityId}
            onSelect={setSelectedRealityId}
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
          locus={selectedReality.id === snapshot.session.activeRealityId}
          tab={inspectorTab}
          operation={activeOperation}
          now={now}
          onTab={setInspectorTab}
        />
      </section>

      <section className="world-ledger">
        <div className="ledger-column">
          <SectionHeading
            icon={<Search size={18} />}
            eyebrow="UNCERTAINTY LEDGER"
            title="Dream proposals"
            meta={<span className="count-label">{allProposals.filter((proposal) => proposal.status !== "resolved").length} unresolved</span>}
          />
          <div className="proposal-list">
            {allProposals.length ? allProposals.map((proposal) => (
              <article className={`proposal-row proposal-${proposal.status}`} key={proposal.id}>
                <span className="proposal-status"><CircleDot size={14} />{proposal.status}</span>
                <div><small>{proposal.owner} / {proposal.title}</small><h3>{proposal.uncertainty}</h3><p>{proposal.rationale}</p></div>
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
                ? snapshot.realities.find((reality) => reality.id === wakeSource || reality.name === wakeSource)
                : null;
              const title = evidence.title.startsWith("Memory inherited from ")
                ? `Memory returned from ${sourceReality?.name ?? "child Reality"}`
                : evidence.title;
              return (
                <article className="evidence-row" key={evidence.id}>
                  <span className={`evidence-icon evidence-${evidence.kind}`}>
                    {evidence.kind === "test" ? <TestTube2 size={15} /> : evidence.kind === "code" ? <Code2 size={15} /> : <CircleDot size={15} />}
                  </span>
                  <div><small>{evidence.kind} / {evidence.source}</small><h3>{title}</h3><p>{evidence.summary}</p></div>
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
            <span>INITIAL BELIEF / {Math.round((initialBelief?.confidence ?? 0) * 100)}%</span>
            <p>{initialBelief?.statement ?? "No initial belief recorded."}</p>
          </div>
          <span className="belief-route"><i /><ArrowRight size={18} /><i /></span>
          <div>
            <span>CURRENT WAKING BELIEF / {Math.round((finalBelief?.confidence ?? 0) * 100)}%</span>
            <p>{finalBelief?.statement ?? "Awaiting returned memory."}</p>
          </div>
        </div>
        <div className="memory-list">
          {memories.length
            ? memories.slice().reverse().map(({ reality, report }) => <MemoryReport reality={reality} report={report} key={reality.id} />)
            : <EmptyState icon={<ArrowUpFromLine size={19} />}>Kick a Dream to return a validated Wake Report.</EmptyState>}
        </div>
      </section>

      <section className="proof-workspace">
        <div className="proof-column anchor-proof">
          <SectionHeading
            icon={<LockKeyhole size={18} />}
            eyebrow="REALITY ANCHORS"
            title="Parent-owned invariants"
            meta={<span className="count-label">{snapshot.session.anchorResults.length || root?.anchors.length || 0} anchors</span>}
          />
          <div className="anchor-list">
            {(snapshot.session.anchorResults.length
              ? snapshot.session.anchorResults
              : root?.anchors.map((anchor) => ({
                  anchorId: anchor.id,
                  name: anchor.name,
                  status: anchor.status === "failed" ? "failed" as const : "pending" as const,
                  output: ""
                })) ?? []
            ).map((anchor) => (
              <article className={`anchor-row anchor-${anchor.status}`} key={anchor.anchorId}>
                <span>{anchor.status === "passed" ? <Check size={15} /> : anchor.status === "failed" ? <X size={15} /> : <LockKeyhole size={14} />}</span>
                <div>
                  <h3>{anchor.name}</h3>
                  <p>{anchor.status === "passed" ? "Immutable requirement survived synthesis." : anchor.status === "failed" ? "Waking implementation violated this anchor." : "Hidden from child mutation; awaiting synthesis."}</p>
                  {"command" in anchor && anchor.command && <small>{anchor.command} / {anchor.durationMs}ms</small>}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="proof-column event-proof">
          <SectionHeading icon={<Radio size={18} />} eyebrow="REALITY EVENTS" title="Safe experience stream" meta={<span className="stream-pulse" />} />
          <EventFeed events={snapshot.events} realities={snapshot.realities} now={now} />
        </div>
      </section>

      {snapshot.session.finalDiff && (
        <section className="diff-workspace">
          <SectionHeading
            icon={<FileDiff size={18} />}
            eyebrow="WAKING IMPLEMENTATION"
            title="Final Git diff"
            meta={<span className="diff-meta"><GitBranch size={13} />{root?.branchName}</span>}
          />
          <pre>{snapshot.session.finalDiff}</pre>
        </section>
      )}

      <AdminDrawer
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onFullReset={(cleanSnapshot) => {
          setSnapshot(cleanSnapshot);
          setSelectedRealityId(cleanSnapshot.session.activeRealityId);
          setInspectorTab("world");
          setLocalOperation(null);
          setLoading("idle");
        }}
        onStateChanged={loadSnapshot}
      />

      <ActionDock snapshot={snapshot} operation={activeOperation} loading={loading} onAction={act} onReset={reset} />
    </main>
  );
}
