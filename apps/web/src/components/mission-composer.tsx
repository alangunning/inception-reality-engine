"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  Fingerprint,
  FolderGit2,
  GitBranch,
  LockKeyhole,
  MoonStar,
  Network,
  Play,
  Settings,
  ShieldAlert,
  SquareTerminal,
  Trash2,
  UsersRound,
  XCircle
} from "lucide-react";
import type {
  AdversarialFaultClass,
  MissionDefinitionDraft,
  MissionRun,
  Reality,
  RealityEvent
} from "@inception/domain";
import type { MissionAction, MissionSnapshot } from "@inception/orchestrator";
import {
  AdminDrawer,
  OperationMonitor,
  RealityPhaseHeader,
  RealityTimeline,
  RealityTopbar,
  RealityWorkspace,
  replayRealities,
  type InspectorTab,
  type PresentedRealityOperation,
  type RealityPhaseStep
} from "./reality-engine";

interface MissionSummary {
  id: string;
  name: string;
  scope: string;
  status: MissionRun["status"];
  realityCount: number;
  updatedAt: string;
}

interface RuntimeInfo {
  mode: "mock" | "real";
  model: string;
  sdkVersion: string;
}

interface ComposerState {
  name: string;
  repositoryPath: string;
  mission: string;
  scope: string;
  premise: string;
  constraints: string;
  parentTruths: string;
  proofName: string;
  proofExecutable: string;
  proofArgs: string;
  tokenBudget: number;
  maxDreamDepth: number;
  interventionEnabled: boolean;
  interventionHypothesis: string;
  interventionFaultClass: AdversarialFaultClass;
  interventionAllowedPaths: string;
  interventionProtectedPaths: string;
  interventionMaxChangedFiles: number;
  interventionMaxPatchLines: number;
  interventionTokenBudget: number;
  interventionMaxMinutes: number;
  interventionTargetDepth: number;
}

const initialState: ComposerState = {
  name: "VAmPI Ownership Regression",
  repositoryPath: "",
  mission: "Maintain the local VAmPI educational fixture. Using only its source and local tests, reproduce the documented book-ownership regression in tests/test_authorization_regression.py, correct the smallest implementation boundary, and preserve the existing API contract.",
  scope: "VAmPI local ownership rules for book records and user deletion",
  premise: "The current handlers enforce the documented owner and administrator invariants.",
  constraints: "Work only inside the operator-provided local VAmPI educational fixture.\nPerform repository maintenance with static source inspection and local tests; do not start or contact a service.\nUse only synthetic test data and do not access credentials, accounts, external targets, or network systems.\nLimit changes to reproducing and correcting the documented local behavior.\nPreserve the documented OpenAPI shape unless a compatible correction requires otherwise.\nReturn reproducible test evidence without exposing hidden model reasoning.",
  parentTruths: "This is an operator-owned local educational fixture with published defects.\nA book record is available only to its documented owner.\nOnly the administrator role may delete users.\nEvery conclusion must cite executable local-test or source evidence.",
  proofName: "Authorization regression",
  proofExecutable: "python3",
  proofArgs: "tests/test_authorization_regression.py",
  tokenBudget: 8_000_000,
  maxDreamDepth: 3,
  interventionEnabled: false,
  interventionHypothesis: "A minimal authorization-boundary regression should be discoverable from cross-user behavior and ordinary source evidence without revealing which line changed.",
  interventionFaultClass: "permission",
  interventionAllowedPaths: "api_views/**\nmodels/**\napp.py\nconfig.py",
  interventionProtectedPaths: ".git/**\n.inception/**\n.github/**\nopenapi_specs/**\nrequirements.txt\nDockerfile\ndocker-compose.yaml",
  interventionMaxChangedFiles: 2,
  interventionMaxPatchLines: 80,
  interventionTokenBudget: 16_000,
  interventionMaxMinutes: 12,
  interventionTargetDepth: 1
};

const subjectCharters = [
  {
    name: "Ariadne",
    role: "Ownership contract investigator",
    mission: "Trace documented owner and role checks from the local API handler to persisted test data."
  },
  {
    name: "Saito",
    role: "Access rule reviewer",
    mission: "Compare local handlers with documented ownership requirements using only source and tests; do not contact a running service."
  },
  {
    name: "Eames",
    role: "Regression test engineer",
    mission: "Turn the documented behavior mismatch into the smallest decisive executable local test."
  }
];

const adversarialSubject = {
  name: "Mal",
  role: "Bounded chaos engineer",
  mission: "Inject one minimal reversible fault inside the operator's explicit path, file, patch, time, and token limits."
};

interface TrainingTargetStatus {
  id: "vampi";
  name: string;
  description: string;
  sourceUrl: string;
  revision: string;
  license: string;
  catalogueUrl: string;
  prepared: boolean;
  repositoryPath?: string;
}

async function readJson<T extends object>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`${fallback} The server returned an empty response.`);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${fallback} The server returned invalid JSON.`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(fallback);
  }
  return value as T;
}

function eventMetadata(event: RealityEvent): Record<string, unknown> {
  const metadata = event.payload.metadata;
  return metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown>
    : {};
}

function observedMissionTokens(events: RealityEvent[]): number {
  return events.reduce((total, event) => {
    const metadata = eventMetadata(event);
    return total
      + (typeof metadata.inputTokens === "number" ? metadata.inputTokens : 0)
      + (typeof metadata.outputTokens === "number" ? metadata.outputTokens : 0);
  }, 0);
}

function statusLabel(status: MissionRun["status"]): string {
  return {
    forming: "FORMING",
    exploring: "EXPLORING",
    verifying: "VERIFYING",
    stabilised: "STABILISED",
    fractured: "FRACTURED"
  }[status];
}

function missionActionCommand(action: MissionAction | undefined): string {
  switch (action) {
    case "inspect": return "Run Codex review";
    case "intervene": return "Run intervention";
    case "create_dream": return "Create Dream";
    case "kick": return "Kick and return memory";
    case "synthesise": return "Synthesise memories";
    case "verify": return "Run immutable proofs";
    case "repair": return "Repair failed proofs";
    case "stabilise": return "Stabilise Reality";
    default: return "Reality stabilised";
  }
}

function missionPhaseSteps(run: MissionRun): RealityPhaseStep[] {
  const hasDream = run.realities.some((entry) => entry.depth > 0);
  const hasInspection = hasDream
    || run.realities.some((entry) => entry.proposals.length > 0)
    || run.events.some((event) => event.type === "inspection.completed");
  const hasMemory = run.memories.length > 0
    || run.realities.some((entry) => entry.status === "kicked" || Boolean(entry.wakeReport));
  const hasSynthesis = Boolean(run.finalDiff)
    || run.events.some((event) => event.type === "synthesis.completed");
  const hasProof = run.proofResults.length > 0
    || run.events.some((event) => event.type === "verification.passed" || event.type === "verification.failed");
  const progress = hasProof ? 5 : hasSynthesis ? 4 : hasMemory ? 3 : hasDream ? 2 : hasInspection ? 1 : 0;
  const labels = ["Inspect", "Dream", "Wake", "Synthesis", "Proof"];
  const stabilised = run.status === "stabilised";
  return labels.map((label, index) => ({
    label,
    complete: stabilised || index < progress,
    current: !stabilised && index === progress
  }));
}

function MissionActionDock({
  snapshot,
  busy,
  replaying,
  phaseSteps,
  onAction,
  onRemove
}: {
  snapshot: MissionSnapshot;
  busy: boolean;
  replaying: boolean;
  phaseSteps: RealityPhaseStep[];
  onAction(action: MissionAction): void;
  onRemove(): void;
}) {
  const ceilingReached = observedMissionTokens(snapshot.run.events) >= snapshot.run.definition.tokenBudget;
  const next = ceilingReached ? null : snapshot.nextAction;
  const blocked = busy || Boolean(snapshot.operation) || replaying || ceilingReached;
  const isDream = next?.kind === "dream";
  const isKick = next?.kind === "kick";
  const isStandard = Boolean(next && !isDream && !isKick);
  const complete = snapshot.run.status === "stabilised" && !next;
  const completedSteps = phaseSteps.filter((step) => step.complete).length;
  const progress = Math.round((completedSteps / phaseSteps.length) * 100);
  const runtimeLabel = next?.executor === "codex"
    ? "STARTS CODEX IN THE ACTIVE REALITY WORKTREE"
    : "ORCHESTRATED REALITY ACTION";

  return (
    <div className={`action-dock ${complete ? "is-complete" : ""}`} data-testid="mission-action-dock">
      <div className="dock-progress">
        <span><b>{completedSteps}</b> / {phaseSteps.length}</span>
        <small>{replaying ? "REPLAY MODE / LIVE REALITY PAUSED" : `NEXT MOVE / ${runtimeLabel}`}</small>
        <strong data-testid="next-move">
          {replaying
            ? "Return the timeline to Live to continue"
            : ceilingReached
              ? "Observed SDK token ceiling reached; form a new Mission with a higher ceiling before execution"
              : snapshot.operation?.label ?? next?.label ?? "Reality stabilised"}
        </strong>
        <div><i style={{ width: `${progress}%` }} /></div>
      </div>
      <button
        type="button"
        className="reset-command"
        onClick={onRemove}
        disabled={blocked}
        title="Delete this Mission and clean up its worktrees"
      >
        <Trash2 size={16} /> Delete Mission
      </button>
      <button
        type="button"
        className={`dream-command ${isDream ? "is-next" : ""}`}
        onClick={() => next && onAction(next.id)}
        disabled={blocked || !isDream}
      >
        <MoonStar size={17} /> Create Dream
      </button>
      <button
        type="button"
        className={`kick-command ${isKick ? "is-next" : ""}`}
        onClick={() => next && onAction(next.id)}
        disabled={blocked || !isKick}
      >
        <ArrowUpFromLine size={17} /> {isKick ? "Kick and return memory" : "Kick"}
      </button>
      <button
        type="button"
        className={`primary-command ${isStandard ? "is-next" : ""}`}
        onClick={() => next && onAction(next.id)}
        disabled={blocked || !isStandard}
      >
        {snapshot.operation || busy
          ? <><span className="button-spinner" />{snapshot.operation ? "Codex working" : "Entering operation"}</>
          : (
            <>
              {next ? <Play size={16} /> : <CheckCircle2 size={16} />}
              {ceilingReached
                ? "Token ceiling reached"
                : isStandard ? missionActionCommand(next?.id) : next ? "Advance Reality" : "Reality stabilised"}
            </>
          )}
      </button>
    </div>
  );
}

function MissionRunView({
  snapshot,
  runtime,
  onReload,
  onDeleted,
  onNewMission
}: {
  snapshot: MissionSnapshot;
  runtime: RuntimeInfo;
  onReload(snapshot: MissionSnapshot): void;
  onDeleted(): void;
  onNewMission(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRealityId, setSelectedRealityId] = useState(snapshot.run.activeRealityId);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("world");
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [revealCode, setRevealCode] = useState(false);
  const [pulseRealityId, setPulseRealityId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [adminOpen, setAdminOpen] = useState(false);
  const run = snapshot.run;
  const reality = snapshot.activeReality;
  // Browser state may outlive a schema migration during local development.
  const interventions = run.interventions ?? [];
  const memoryIntegrity = run.memoryIntegrity ?? [];
  const intervention = interventions.find((entry) => entry.realityId === reality.id)
    ?? interventions.at(-1);
  const interventionContract = run.definition.intervention;
  const integritySeal = memoryIntegrity.find((entry) => entry.realityId === reality.id)
    ?? memoryIntegrity.at(-1);
  const usedTokens = useMemo(() => observedMissionTokens(run.events), [run.events]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/missions/${encodeURIComponent(run.id)}`, {
      cache: "no-store"
    });
    const body = await readJson<{
      snapshot?: MissionSnapshot;
      error?: string;
    }>(response, "Could not refresh the mission.");
    if (!response.ok || !body.snapshot) throw new Error(body.error ?? "Could not refresh the mission.");
    onReload(body.snapshot);
  }, [onReload, run.id]);

  useEffect(() => {
    const stream = new EventSource(`/api/missions/events?missionId=${encodeURIComponent(run.id)}`);
    stream.onmessage = (event) => {
      const value = JSON.parse(event.data) as { type?: string; realityId?: string };
      if (
        value.realityId
        && ["kick.triggered", "memory.returned", "reality.stabilised"].includes(value.type ?? "")
      ) {
        setPulseRealityId(value.realityId);
        window.setTimeout(() => setPulseRealityId(null), 1_400);
      }
      if (value.type !== "connected") void load();
    };
    return () => stream.close();
  }, [load, run.id]);

  useEffect(() => {
    if (!snapshot.operation && !busy) return;
    const poll = window.setInterval(() => void load(), 2_000);
    return () => window.clearInterval(poll);
  }, [busy, load, snapshot.operation]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      snapshot.operation ? 1_000 : 15_000
    );
    return () => window.clearInterval(timer);
  }, [snapshot.operation?.id]);

  const act = async (action: MissionAction) => {
    if (action === "create_dream" && !window.confirm(
      `Create a child Reality at depth ${reality.depth + 1}? It will receive an isolated Codex thread and Git worktree.`
    )) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(run.id)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await readJson<MissionSnapshot & { error?: string }>(
        response,
        "The mission action failed."
      );
      if (!response.ok) throw new Error(body.error ?? "The mission action failed.");
      onReload(body);
      setSelectedRealityId(body.run.activeRealityId);
      setInspectorTab("world");
      setTimelineIndex(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this Mission and clean up every Mission-owned worktree and branch?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(run.id)}`, {
        method: "DELETE"
      });
      const body = await readJson<{ error?: string }>(response, "Could not delete the mission.");
      if (!response.ok) throw new Error(body.error ?? "Could not delete the mission.");
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const replayedRealities = useMemo(
    () => replayRealities(run.realities, run.events, timelineIndex),
    [run.events, run.realities, timelineIndex]
  );
  const visibleEvents = useMemo(
    () => timelineIndex === null ? run.events : run.events.slice(0, timelineIndex + 1),
    [run.events, timelineIndex]
  );
  const activeOperation: PresentedRealityOperation | null = snapshot.operation
    ? {
        ...snapshot.operation,
        executor: ["create_dream", "verify", "stabilise"].includes(snapshot.operation.action)
          ? "orchestrator"
          : "codex"
      }
    : null;
  const replaying = timelineIndex !== null;
  const phaseSteps = missionPhaseSteps(run);
  return (
    <main className="app-shell mission-run">
      <RealityTopbar
        codexMode={runtime.mode}
        model={runtime.model}
        environment={`CODEX SDK ${runtime.sdkVersion}`}
        realityCount={run.realities.length}
        actions={(
          <>
            <a className="mission-link" href="/" title="Canonical scenario">
              <ArrowLeft size={13} />
              <span>CANONICAL SCENARIO</span>
            </a>
            <button type="button" className="mission-link" onClick={onNewMission} title="Form a new Mission">
              <GitBranch size={13} />
              <span>NEW MISSION</span>
            </button>
            <button
              type="button"
              className="admin-trigger"
              data-testid="admin-trigger"
              onClick={() => setAdminOpen(true)}
              title="Admin controls"
              aria-label="Open admin controls"
            >
              <Settings size={15} />
            </button>
          </>
        )}
      />

      <RealityPhaseHeader
        eyebrow={`GENERALIZED MISSION / ${statusLabel(run.status)}`}
        title={run.definition.name}
        steps={phaseSteps}
      />

      <section className="mission-context-band" data-testid="mission-context">
        <p>{run.definition.mission}</p>
        <dl>
          <div><dt>MODEL</dt><dd>{runtime.model}</dd></div>
          <div><dt>OBSERVED SDK TOKENS</dt><dd>{usedTokens.toLocaleString()} / {run.definition.tokenBudget.toLocaleString()}</dd></div>
          <div><dt>DEPTH BUDGET</dt><dd>{Math.max(...run.realities.map((entry) => entry.depth))} / {run.definition.maxDreamDepth}</dd></div>
        </dl>
      </section>

      {error && (
        <div className="mission-error">
          <XCircle size={16} />
          <span><b>Reality fracture</b>{error}</span>
        </div>
      )}

      {activeOperation && (
        <OperationMonitor
          operation={activeOperation}
          realities={run.realities}
          events={run.events}
          now={now}
        />
      )}

      <RealityTimeline events={run.events} index={timelineIndex} onChange={setTimelineIndex} />

      {(intervention || integritySeal || memoryIntegrity.length === 0) && (
        <section className="mission-guardrail-band">
          {intervention && interventionContract && (
            <article className={`mission-intervention intervention-${intervention.status}`} data-testid="intervention-ledger">
              <div className="mission-intervention-heading">
                <span>
                  <strong><ShieldAlert size={14} /> {adversarialSubject.name} / {adversarialSubject.role}</strong>
                  <small>SEALED INTERVENTION / {intervention.status.toUpperCase()} / REVEAL AFTER DIAGNOSIS</small>
                </span>
                <b>{interventionContract.maxChangedFiles} FILES / {interventionContract.maxPatchLines} LINES</b>
              </div>
              {intervention.status === "armed" && <p>No mutation has run. The operator-owned contract is armed for an explicit action.</p>}
              {intervention.status === "sealed" && <p>{intervention.changedFileCount ?? 0} changed file{intervention.changedFileCount === 1 ? "" : "s"} sealed. Cause and paths remain hidden until Kick.</p>}
              {intervention.status === "rejected" && <p>{intervention.rejectionReason ?? "The mutation breached its contract and the Dream was restored."}</p>}
              {intervention.status === "revealed" && intervention.report && intervention.assessment && (
                <p>{intervention.assessment.outcome.toUpperCase()}: {intervention.report.summary}</p>
              )}
            </article>
          )}
          <article
            className={`mission-integrity integrity-${integritySeal?.verdict ?? "pending"}`}
            data-testid="memory-integrity"
          >
            <div className="mission-intervention-heading">
              <span>
                <strong><Fingerprint size={14} /> {integritySeal?.verdict === "verified" ? "Memory verified" : integritySeal?.verdict === "quarantined" ? "Memory quarantined" : "Parent policy armed"}</strong>
                <small>{integritySeal ? `${integritySeal.policyVersion.toUpperCase()} / ${integritySeal.checks.filter((check) => check.status === "passed").length} OF ${integritySeal.checks.length} CHECKS PASSED` : "NO MEMORY HAS CROSSED A KICK"}</small>
              </span>
              <b>{integritySeal ? `${integritySeal.descendantSealIds.length} DESCENDANT SEALS` : `${reality.anchors.length} REALITY ANCHORS`}</b>
            </div>
            {integritySeal && (
              <div className="mission-integrity-checks">
                {integritySeal.checks.map((check) => (
                  <span className={`integrity-check is-${check.status}`} key={check.name} title={check.summary}>
                    {check.status === "passed" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {check.name.replaceAll("-", " ")}
                  </span>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      <RealityWorkspace
        realities={replayedRealities}
        sourceRealities={run.realities}
        events={visibleEvents}
        activeRealityId={run.activeRealityId}
        selectedRealityId={selectedRealityId}
        onSelectReality={setSelectedRealityId}
        inspectorTab={inspectorTab}
        onInspectorTab={setInspectorTab}
        operation={activeOperation}
        now={now}
        pulseRealityId={pulseRealityId}
        memoryIntegrity={memoryIntegrity}
        anchorResults={run.proofResults}
        finalDiff={run.finalDiff}
        revealCode={revealCode}
        onToggleCode={() => setRevealCode((current) => !current)}
      />

      <AdminDrawer
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onStateChanged={load}
        mission={{
          id: run.id,
          name: run.definition.name,
          status: statusLabel(run.status),
          eventCount: run.events.length,
          realityCount: run.realities.length
        }}
        onMissionDeleted={onDeleted}
      />
      <MissionActionDock
        snapshot={snapshot}
        busy={busy}
        replaying={replaying}
        phaseSteps={phaseSteps}
        onAction={(action) => void act(action)}
        onRemove={() => void remove()}
      />
    </main>
  );
}

export function MissionComposer() {
  const [composer, setComposer] = useState(initialState);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [runs, setRuns] = useState<MissionSummary[]>([]);
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<TrainingTargetStatus[]>([]);
  const [targetBusy, setTargetBusy] = useState(false);
  const [composerAdminOpen, setComposerAdminOpen] = useState(false);

  const loadIndex = useCallback(async () => {
    const response = await fetch("/api/missions", { cache: "no-store" });
    const body = await readJson<{
      runs?: MissionSummary[];
      runtime?: RuntimeInfo;
      enabled?: boolean;
      error?: string;
    }>(response, "Could not load Mission Composer.");
    if (!response.ok || !body.runtime) throw new Error(body.error ?? "Could not load Mission Composer.");
    setRuntime(body.runtime);
    setRuns(body.runs ?? []);
  }, []);

  const loadTargets = useCallback(async () => {
    const response = await fetch("/api/missions/targets", { cache: "no-store" });
    const body = await readJson<{
      targets?: TrainingTargetStatus[];
      error?: string;
    }>(response, "Could not inspect the training target.");
    if (!response.ok) throw new Error(body.error ?? "Could not inspect the training target.");
    const nextTargets = body.targets ?? [];
    setTargets(nextTargets);
    const prepared = nextTargets.find((target) => target.id === "vampi" && target.prepared);
    if (prepared?.repositoryPath) {
      setComposer((current) => current.repositoryPath
        ? current
        : { ...current, repositoryPath: prepared.repositoryPath! });
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadIndex(), loadTargets()])
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [loadIndex, loadTargets]);

  const prepareTarget = async () => {
    setTargetBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/missions/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "vampi" })
      });
      const body = await readJson<{
        target?: TrainingTargetStatus;
        error?: string;
      }>(response, "Could not prepare VAmPI.");
      if (!response.ok || !body.target?.repositoryPath) {
        throw new Error(body.error ?? "Could not prepare VAmPI.");
      }
      setTargets((current) => [
        body.target!,
        ...current.filter((target) => target.id !== body.target!.id)
      ]);
      setComposer((current) => ({
        ...current,
        repositoryPath: body.target!.repositoryPath!
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setTargetBusy(false);
    }
  };

  const openRun = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await readJson<{
        snapshot?: MissionSnapshot;
        runtime?: RuntimeInfo;
        error?: string;
      }>(response, "Could not open the mission.");
      if (!response.ok || !body.snapshot) throw new Error(body.error ?? "Could not open the mission.");
      setSnapshot(body.snapshot);
      if (body.runtime) setRuntime(body.runtime);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const requestedMission = new URLSearchParams(window.location.search).get("mission");
    if (requestedMission) void openRun(requestedMission);
  }, [openRun]);

  const formMission = async () => {
    const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
    const requiredFields: Array<readonly [string, string]> = [
      ["Reality name", composer.name],
      ["Local Git repository", composer.repositoryPath],
      ["Mission", composer.mission],
      ["Scope", composer.scope],
      ["Initial belief to challenge", composer.premise],
      ["Constitution constraints", composer.constraints],
      ["Proof name", composer.proofName],
      ["Proof executable", composer.proofExecutable]
    ];
    if (composer.interventionEnabled) {
      requiredFields.push(
        ["Intervention hypothesis", composer.interventionHypothesis],
        ["Intervention allowed paths", composer.interventionAllowedPaths]
      );
    }
    const missingFields = requiredFields
      .filter(([, value]) => !value.trim())
      .map(([label]) => label);
    if (missingFields.length) {
      setError(`Complete the required Mission fields: ${missingFields.join(", ")}.`);
      return;
    }

    setBusy(true);
    setError(null);
    const draft: MissionDefinitionDraft = {
      name: composer.name.trim(),
      repositoryPath: composer.repositoryPath.trim(),
      mission: composer.mission.trim(),
      scope: composer.scope.trim(),
      premise: composer.premise.trim(),
      constraints: lines(composer.constraints),
      parentTruths: lines(composer.parentTruths),
      wakeContract: [
        "State initial beliefs and what changed.",
        "Return reproducible evidence and artefacts.",
        "Separate invariants from world-specific observations.",
        "Preserve remaining uncertainty."
      ],
      proofs: [{
        name: composer.proofName.trim(),
        executable: composer.proofExecutable.trim(),
        args: lines(composer.proofArgs)
      }],
      subjects: subjectCharters,
      intervention: composer.interventionEnabled ? {
        enabled: true,
        subject: adversarialSubject,
        hypothesis: composer.interventionHypothesis.trim(),
        faultClasses: [composer.interventionFaultClass],
        allowedPaths: lines(composer.interventionAllowedPaths),
        protectedPaths: lines(composer.interventionProtectedPaths),
        maxChangedFiles: composer.interventionMaxChangedFiles,
        maxPatchLines: composer.interventionMaxPatchLines,
        tokenBudget: composer.interventionTokenBudget,
        maxMinutes: composer.interventionMaxMinutes,
        targetDepth: composer.interventionTargetDepth,
        revealPolicy: "after-diagnosis",
        requireRollbackCommit: true
      } : undefined,
      tokenBudget: composer.tokenBudget,
      maxDreamDepth: composer.maxDreamDepth
    };
    try {
      const response = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const body = await readJson<MissionSnapshot & { error?: string }>(
        response,
        "Could not form the waking Reality."
      );
      if (!response.ok) throw new Error(body.error ?? "Could not form the waking Reality.");
      setSnapshot(body);
      await loadIndex();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (snapshot && runtime) {
    return (
      <div className="mission-shell">
        <MissionRunView
          snapshot={snapshot}
          runtime={runtime}
          onReload={setSnapshot}
          onNewMission={() => {
            window.history.replaceState(null, "", "/missions/new");
            setSnapshot(null);
          }}
          onDeleted={() => {
            setSnapshot(null);
            void loadIndex();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mission-shell">
      <div className="app-shell mission-composer-page">
        <RealityTopbar
          codexMode={runtime?.mode ?? "real"}
          model={runtime?.model ?? "checking runtime"}
          environment={runtime ? `CODEX SDK ${runtime.sdkVersion}` : "Runtime checking"}
          realityCount={runs.reduce((total, run) => total + run.realityCount, 0)}
          actions={(
            <>
              <a className="mission-link" href="/" title="Canonical scenario">
                <ArrowLeft size={13} />
                <span>CANONICAL SCENARIO</span>
              </a>
              <button
                type="button"
                className="admin-trigger"
                data-testid="admin-trigger"
                onClick={() => setComposerAdminOpen(true)}
                title="Admin controls"
                aria-label="Open admin controls"
              >
                <Settings size={15} />
              </button>
            </>
          )}
        />
        <main className="mission-composer">
        <header className="mission-composer-header">
          <div>
            <span className="eyebrow">MISSION COMPOSER / TRUSTED LOCAL MODE</span>
            <h1>Form a waking Reality</h1>
            <p>Define the world Codex may change and the parent-owned proofs it cannot negotiate.</p>
          </div>
          <div className="mission-trust-warning">
            <ShieldAlert size={18} />
            <span><b>FULL LOCAL ACCESS</b>Actions run Codex with network access and unrestricted writes inside Mission-owned Git worktrees.</span>
          </div>
        </header>

        {error && <div className="mission-error"><XCircle size={16} /><span><b>Mission unavailable</b>{error}</span></div>}
        {runtime && runtime.mode !== "real" && (
          <div className="mission-error">
            <SquareTerminal size={16} />
            <span><b>Real mode required</b>Run <code>npm run dev:real</code>. Forming a mission never starts Codex; only an explicit Reality action does.</span>
          </div>
        )}

        <div className="mission-composer-grid">
          <section className="mission-form">
            <div className="mission-section-title">
              <span><CircleDot size={16} /> WAKING WORLD</span>
              <b>NO CODEX USAGE ON CREATE</b>
            </div>
            {targets.map((target) => (
              <article className={`mission-target mission-field-wide ${target.prepared ? "is-prepared" : ""}`} key={target.id} data-testid="training-target">
                <span className="mission-target-icon"><FolderGit2 size={18} /></span>
                <div>
                  <small>CURATED LOCAL TARGET / {target.license}</small>
                  <strong>{target.name}</strong>
                  <p>{target.description}</p>
                  <span className="mission-target-links">
                    <a href={target.sourceUrl} target="_blank" rel="noreferrer">SOURCE <ExternalLink size={11} /></a>
                    <a href={target.catalogueUrl} target="_blank" rel="noreferrer">OWASP CATALOGUE <ExternalLink size={11} /></a>
                    <code>{target.revision.slice(0, 12)}</code>
                  </span>
                </div>
                <button type="button" onClick={() => void prepareTarget()} disabled={targetBusy}>
                  <FolderGit2 size={15} />
                  {targetBusy ? "Preparing target" : target.prepared ? "Use prepared target" : "Prepare VAmPI locally"}
                </button>
              </article>
            ))}
            <label>
              <span>Reality name</span>
              <input required value={composer.name} onChange={(event) => setComposer({ ...composer, name: event.target.value })} />
            </label>
            <label>
              <span>Local Git repository</span>
              <input required value={composer.repositoryPath} onChange={(event) => setComposer({ ...composer, repositoryPath: event.target.value })} placeholder="/absolute/path/to/repository" />
            </label>
            <label className="mission-field-wide">
              <span>Mission</span>
              <textarea required value={composer.mission} onChange={(event) => setComposer({ ...composer, mission: event.target.value })} placeholder="What must the waking implementation achieve?" />
            </label>
            <label>
              <span>Scope</span>
              <input required value={composer.scope} onChange={(event) => setComposer({ ...composer, scope: event.target.value })} placeholder="The bounded code or behavior under investigation" />
            </label>
            <label>
              <span>Initial belief to challenge</span>
              <input required value={composer.premise} onChange={(event) => setComposer({ ...composer, premise: event.target.value })} placeholder="A plausible assumption that has not survived a counterfactual world" />
            </label>
            <label className="mission-field-wide">
              <span>Constitution constraints / one per line</span>
              <textarea required value={composer.constraints} onChange={(event) => setComposer({ ...composer, constraints: event.target.value })} />
            </label>
            <label className="mission-field-wide">
              <span>Parent truths / one per line</span>
              <textarea value={composer.parentTruths} onChange={(event) => setComposer({ ...composer, parentTruths: event.target.value })} placeholder="Public contracts or requirements every Dream inherits" />
            </label>

            <div className="mission-section-title mission-form-divider">
              <span><ShieldAlert size={16} /> SEALED INTERVENTION</span>
              <b>OPTIONAL / EXPLICIT ACTION</b>
            </div>
            <label className="mission-toggle mission-field-wide">
              <input
                type="checkbox"
                checked={composer.interventionEnabled}
                onChange={(event) => setComposer({ ...composer, interventionEnabled: event.target.checked })}
              />
              <span>Arm one bounded chaos-engineer intervention at Dream depth {composer.interventionTargetDepth}</span>
            </label>
            {composer.interventionEnabled && (
              <>
                <label className="mission-field-wide">
                  <span>Diagnosis hypothesis</span>
                  <textarea value={composer.interventionHypothesis} onChange={(event) => setComposer({ ...composer, interventionHypothesis: event.target.value })} />
                </label>
                <label>
                  <span>Allowed fault class</span>
                  <select value={composer.interventionFaultClass} onChange={(event) => setComposer({ ...composer, interventionFaultClass: event.target.value as AdversarialFaultClass })}>
                    <option value="permission">Permission boundary</option>
                    <option value="boundary-condition">Boundary condition</option>
                    <option value="dependency-failure">Dependency failure</option>
                    <option value="concurrency">Concurrency</option>
                    <option value="state-corruption">State corruption</option>
                    <option value="performance">Performance</option>
                  </select>
                </label>
                <fieldset>
                  <legend>Intervention Dream depth</legend>
                  <div className="mission-segments">
                    {[1, 2, 3].filter((depth) => depth <= composer.maxDreamDepth).map((depth) => (
                      <button type="button" className={composer.interventionTargetDepth === depth ? "is-selected" : ""} onClick={() => setComposer({ ...composer, interventionTargetDepth: depth })} key={depth}>
                        {depth}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span>Allowed paths / one per line</span>
                  <textarea value={composer.interventionAllowedPaths} onChange={(event) => setComposer({ ...composer, interventionAllowedPaths: event.target.value })} />
                </label>
                <label>
                  <span>Protected paths / one per line</span>
                  <textarea value={composer.interventionProtectedPaths} onChange={(event) => setComposer({ ...composer, interventionProtectedPaths: event.target.value })} />
                </label>
                <label>
                  <span>Maximum changed files</span>
                  <input type="number" min={1} max={20} value={composer.interventionMaxChangedFiles} onChange={(event) => setComposer({ ...composer, interventionMaxChangedFiles: Number(event.target.value) })} />
                </label>
                <label>
                  <span>Maximum patch lines</span>
                  <input type="number" min={1} max={2_000} value={composer.interventionMaxPatchLines} onChange={(event) => setComposer({ ...composer, interventionMaxPatchLines: Number(event.target.value) })} />
                </label>
                <label>
                  <span>Intervention token limit</span>
                  <input type="number" min={1_000} max={500_000} step={1_000} value={composer.interventionTokenBudget} onChange={(event) => setComposer({ ...composer, interventionTokenBudget: Number(event.target.value) })} />
                </label>
                <label>
                  <span>Maximum minutes</span>
                  <input type="number" min={1} max={60} value={composer.interventionMaxMinutes} onChange={(event) => setComposer({ ...composer, interventionMaxMinutes: Number(event.target.value) })} />
                </label>
              </>
            )}

            <div className="mission-section-title mission-form-divider">
              <span><LockKeyhole size={16} /> IMMUTABLE PROOF</span>
              <b>STRUCTURED EXECUTION</b>
            </div>
            <label>
              <span>Proof name</span>
              <input required value={composer.proofName} onChange={(event) => setComposer({ ...composer, proofName: event.target.value })} />
            </label>
            <label>
              <span>Executable</span>
              <input required value={composer.proofExecutable} onChange={(event) => setComposer({ ...composer, proofExecutable: event.target.value })} />
            </label>
            <label className="mission-field-wide">
              <span>Arguments / one per line</span>
              <textarea value={composer.proofArgs} onChange={(event) => setComposer({ ...composer, proofArgs: event.target.value })} />
            </label>

            <div className="mission-section-title mission-form-divider">
              <span><Network size={16} /> EXPLORATION BUDGET</span>
            </div>
            <label>
              <span>Observed SDK token ceiling</span>
              <input type="number" min={10_000} max={10_000_000} step={10_000} value={composer.tokenBudget} onChange={(event) => setComposer({ ...composer, tokenBudget: Number(event.target.value) })} />
            </label>
            <fieldset>
              <legend>Maximum Dream depth</legend>
              <div className="mission-segments">
                {[1, 2, 3].map((depth) => (
                  <button
                    type="button"
                    className={composer.maxDreamDepth === depth ? "is-selected" : ""}
                    onClick={() => setComposer({
                      ...composer,
                      maxDreamDepth: depth,
                      interventionTargetDepth: Math.min(composer.interventionTargetDepth, depth)
                    })}
                    key={depth}
                  >
                    {depth}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className="mission-form-submit"
              disabled={busy || targetBusy || runtime?.mode !== "real"}
              onClick={() => void formMission()}
            >
              <GitBranch size={17} /> {busy ? "Forming Reality" : "Form waking Reality"}
            </button>
          </section>

          <aside className="mission-roster">
            <div className="mission-section-title">
              <span><UsersRound size={16} /> SUBJECT CHARTERS</span>
              <b>{subjectCharters.length} DIRECT THREADS</b>
            </div>
            {subjectCharters.map((subject) => (
              <article key={subject.name}>
                <span><UsersRound size={15} /></span>
                <div>
                  <strong>{subject.name}</strong>
                  <small>{subject.role}</small>
                  <p>{subject.mission}</p>
                </div>
              </article>
            ))}
            <div className="mission-section-title mission-history-title">
              <span><Clock3 size={16} /> SAVED MISSIONS</span>
              <b>{runs.length}</b>
            </div>
            <div className="mission-history">
              {runs.map((run) => (
                <button type="button" onClick={() => void openRun(run.id)} disabled={busy} key={run.id}>
                  <span>
                    <strong>{run.name}</strong>
                    <small>{run.scope} / {statusLabel(run.status)}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!runs.length && <p className="mission-empty">No saved missions.</p>}
            </div>
          </aside>
        </div>
        </main>
        <AdminDrawer
          open={composerAdminOpen}
          onClose={() => setComposerAdminOpen(false)}
          onStateChanged={loadIndex}
        />
      </div>
    </div>
  );
}
