"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpFromLine,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  Fingerprint,
  FolderGit2,
  GitBranch,
  LockKeyhole,
  Minimize2,
  MoonStar,
  Network,
  Play,
  Pause,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Square,
  SquareTerminal,
  Trash2,
  UsersRound,
  XCircle
} from "lucide-react";
import {
  DEFAULT_INTERVENTION_TOKEN_BUDGET,
  type AdversarialFaultClass,
  MissionDefinitionDraft,
  MissionDreamStrategy,
  MissionMemoryPolicy,
  MissionRun,
  MissionSafetyProfile,
  Reality,
  RealityEvent
} from "@inception/domain";
import type { MissionAction, MissionSnapshot } from "@inception/orchestrator";
import {
  AdminDrawer,
  DreamGate,
  OperationMonitor,
  RealityJourneyBand,
  RealityPhaseHeader,
  RealityTimeline,
  RealityTopbar,
  RealityWorkspace,
  WakeTransition,
  replayActiveRealityId,
  replayAnchorResults,
  replayFinalDiff,
  replayInterventions,
  replayMemoryIntegrity,
  replayOutcome,
  replayReflections,
  replayRealities,
  type InspectorTab,
  type PresentedRealityOperation,
  type RealityPhaseStep
} from "./reality-engine";
import {
  canonicalProductCopy,
  realityDisplayName
} from "./product-terminology";

type AutopilotCommand = "start" | "resume" | "pause" | "stop";

interface MissionSummary {
  id: string;
  name: string;
  scope: string;
  status: string;
  realityCount: number;
  updatedAt: string;
  href: string;
  kind: "demo" | "saved";
  canDelete: boolean;
}

interface RuntimeInfo {
  mode: "mock" | "real";
  model: string;
  sdkVersion: string;
  authSource?: "cli" | "api-key" | "none";
}

interface ComposerState {
  name: string;
  repositoryPath: string;
  mission: string;
  scope: string;
  premise: string;
  constraints: string;
  parentTruths: string;
  wakeContract: string;
  runtimeLaws: string;
  safetyProfile: MissionSafetyProfile;
  memoryPolicy: MissionMemoryPolicy;
  dreamStrategy: MissionDreamStrategy;
  maxSiblingDreams: number;
  proofs: Array<{
    key: string;
    name: string;
    executable: string;
    args: string;
  }>;
  subjects: Array<{
    key: string;
    name: string;
    role: string;
    mission: string;
  }>;
  tokenBudget: number;
  maxDreamDepth: number;
  dependencyBootstrapEnabled: boolean;
  dependencyBootstrapKind: "python-venv" | "node-npm";
  dependencyManifestPath: string;
  dependencyTargetDepth: number;
  requiredPythonVersion: string;
  requiredNodeVersion: string;
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
  mission: "Maintain the local VAmPI educational fixture. Use its operator-provided tests/test_authorization_regression.py harness to reproduce the documented book-ownership regression, correct the smallest implementation boundary, and preserve the existing API contract.",
  scope: "VAmPI local ownership rules for book records and user deletion",
  premise: "The current handlers enforce the documented owner and administrator invariants.",
  constraints: "Work only inside the operator-provided local VAmPI educational fixture.\nPerform repository maintenance with static source inspection and local tests; do not start or contact an application service.\nUse only synthetic test data and do not access credentials, accounts, or external targets.\nNetwork use is limited to the parent-authorized pinned dependency bootstrap from its approved package index.\nNever install packages globally or alter the host Python or Node runtime.\nLimit changes to reproducing and correcting the documented local behavior.\nPreserve the documented OpenAPI shape unless a compatible correction requires otherwise.\nReturn reproducible test evidence without exposing hidden model reasoning.",
  parentTruths: "This is an operator-owned local educational fixture with published defects and a committed regression harness.\nA book record is available only to its documented owner.\nOnly the administrator role may delete users.\nEvery conclusion must cite executable local-test or source evidence.",
  wakeContract: "State initial beliefs and what changed.\nReturn reproducible evidence and artefacts.\nSeparate invariants from world-specific observations.\nPreserve remaining uncertainty.",
  runtimeLaws: "Only evidence reproduced inside the local repository may become memory.\nA failed immutable proof prevents Reality stabilisation.\nCompeting Dreams may disagree; only evidence-backed conclusions may propagate.",
  safetyProfile: "authorized-local-defensive-review",
  memoryPolicy: "verified-reports-and-artefacts",
  dreamStrategy: "competing-siblings",
  maxSiblingDreams: 2,
  proofs: [{
    key: "authorization-regression",
    name: "Authorization regression",
    executable: "sh",
    args: "scripts/run_authorization_regression.sh"
  }],
  subjects: [
    {
      key: "ariadne",
      name: "Ariadne",
      role: "Ownership contract investigator",
      mission: "Trace documented owner and role checks from the local API handler to persisted test data."
    },
    {
      key: "saito",
      name: "Saito",
      role: "Boundary reviewer",
      mission: "Compare local handlers with documented ownership requirements using only source and tests."
    },
    {
      key: "eames",
      name: "Eames",
      role: "Negative-test engineer",
      mission: "Turn the documented behavior mismatch into the smallest decisive executable local test."
    }
  ],
  tokenBudget: 30_000_000,
  maxDreamDepth: 3,
  dependencyBootstrapEnabled: true,
  dependencyBootstrapKind: "python-venv",
  dependencyManifestPath: "requirements-reality.txt",
  dependencyTargetDepth: 3,
  requiredPythonVersion: "",
  requiredNodeVersion: "",
  interventionEnabled: true,
  interventionHypothesis: "A minimal authorization-boundary regression should be discoverable from cross-user behavior and ordinary source evidence without revealing which line changed.",
  interventionFaultClass: "permission",
  interventionAllowedPaths: "api_views/**\nmodels/**\napp.py\nconfig.py",
  interventionProtectedPaths: ".git/**\n.inception/**\n.github/**\nopenapi_specs/**\nrequirements.txt\nDockerfile\ndocker-compose.yaml",
  interventionMaxChangedFiles: 2,
  interventionMaxPatchLines: 80,
  interventionTokenBudget: DEFAULT_INTERVENTION_TOKEN_BUDGET,
  interventionMaxMinutes: 12,
  interventionTargetDepth: 2
};

const adversarialSubject = {
  name: "Mal",
  role: "Bounded adversarial engineer",
  mission: "Introduce one minimal reversible local fault inside the operator's explicit path, file, patch, time, and token limits."
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

function missionAutopilot(run: MissionRun): MissionRun["autopilot"] {
  return run.autopilot ?? {
    mode: "off",
    kind: "guided-real",
    maxActions: 60,
    maxMinutes: 180,
    pauseOnDream: true,
    pauseOnIntervention: true,
    actionsCompleted: 0
  };
}

function missionEventCount(run: MissionRun): number {
  return run.eventCount ?? run.events.length;
}

function statusLabel(status: MissionRun["status"]): string {
  return {
    forming: "CREATING",
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
    case "kick": return "Kick: return memory";
    case "synthesise": return "Synthesise memories";
    case "verify": return "Run immutable proofs";
    case "repair": return "Repair failed proofs";
    case "stabilise": return "Stabilise Reality";
    default: return "Reality stabilised";
  }
}

function missionPhaseSteps(
  run: MissionRun,
  realities = run.realities,
  events = run.events,
  replaying = false
): RealityPhaseStep[] {
  const hasDream = realities.some((entry) => entry.depth > 0);
  const hasInspection = hasDream
    || realities.some((entry) => entry.proposals.length > 0)
    || events.some((event) => event.type === "inspection.completed");
  const hasMemory = realities.some((entry) => entry.status === "kicked" || Boolean(entry.wakeReport))
    || events.some((event) => event.type === "memory.returned");
  const hasSynthesis = events.some((event) => event.type === "synthesis.completed")
    || (!replaying && Boolean(run.finalDiff));
  const hasProof = events.some((event) =>
    event.type === "verification.passed" || event.type === "verification.failed"
  ) || (!replaying && run.proofResults.length > 0);
  const progress = hasProof ? 5 : hasSynthesis ? 4 : hasMemory ? 3 : hasDream ? 2 : hasInspection ? 1 : 0;
  const labels = ["Inspect", "Dream", "Memory", "Synthesis", "Proof"];
  const stabilised = replaying
    ? events.some((event) => event.type === "reality.stabilised")
    : run.status === "stabilised";
  return labels.map((label, index) => ({
    label,
    complete: stabilised || index < progress,
    current: !stabilised && index === progress
  }));
}

function MissionAutoModeBar({
  run,
  busy,
  onControl,
  onApproveMissionLimits,
  onApproveInterventionBudget
}: {
  run: MissionRun;
  busy: boolean;
  onControl(command: AutopilotCommand): void;
  onApproveMissionLimits(tokenBudget: number): void;
  onApproveInterventionBudget(tokenBudget: number): void;
}) {
  const state = missionAutopilot(run);
  const running = state.mode === "running";
  const paused = state.mode === "paused";
  const rejectedIntervention = [...(run.interventions ?? [])].reverse().find((entry) =>
    entry.status === "rejected"
    && (
      entry.rejectionCode === "intervention_token_budget_exceeded"
      || entry.rejectionReason?.includes("intervention_token_budget_exceeded")
    )
  );
  const currentBudget = run.definition.intervention?.tokenBudget ?? 0;
  const remainingMissionBudget = Math.max(
    0,
    run.definition.tokenBudget - (run.observedTokens ?? observedMissionTokens(run.events))
  );
  const maximumBudget = Math.min(500_000, remainingMissionBudget);
  const suggestedBudget = Math.min(
    maximumBudget,
    Math.ceil(Math.max(
      currentBudget * 2,
      (rejectedIntervention?.lastAttemptTokens ?? currentBudget) * 1.25
    ) / 1_000) * 1_000
  );
  const budgetRecovery = paused
    && Boolean(rejectedIntervention)
    && currentBudget > 0;
  const observedMissionTokensCount = run.observedTokens
    ?? observedMissionTokens(run.events);
  const missionCeilingReached = observedMissionTokensCount >= run.definition.tokenBudget;
  const missionLimitRecovery = missionCeilingReached
    && !budgetRecovery
    && run.status !== "stabilised";
  const sameHardCeilingRetry = currentBudget === 500_000
    && maximumBudget === currentBudget;
  const [approvedBudget, setApprovedBudget] = useState(suggestedBudget);
  const maximumMissionBudget = 30_000_000;
  const minimumMissionBudget = Math.min(
    maximumMissionBudget,
    Math.max(
      run.definition.tokenBudget + 100_000,
      Math.ceil(observedMissionTokensCount / 100_000) * 100_000
    )
  );
  const suggestedMissionBudget = Math.min(
    maximumMissionBudget,
    Math.max(
      minimumMissionBudget,
      Math.ceil(Math.max(
        run.definition.tokenBudget + 5_000_000,
        observedMissionTokensCount * 1.15
      ) / 100_000) * 100_000
    )
  );
  const [approvedMissionBudget, setApprovedMissionBudget] = useState(suggestedMissionBudget);

  useEffect(() => {
    setApprovedBudget(suggestedBudget);
  }, [run.id, rejectedIntervention?.id, rejectedIntervention?.lastAttemptTokens, suggestedBudget]);
  useEffect(() => {
    setApprovedMissionBudget(suggestedMissionBudget);
  }, [run.id, run.definition.tokenBudget, observedMissionTokensCount, suggestedMissionBudget]);

  return (
    <section className={`mission-autopilot autopilot-${state.mode}`} data-testid="mission-autopilot">
      <div className="autopilot-summary">
        <span><Play size={15} /></span>
        <p>
          <small>GUIDED AUTO MODE / PARENT GATES ARMED</small>
          <strong>{running
            ? "Advancing one validated Reality action at a time"
            : budgetRecovery
              ? "Adversarial Subject exceeded its approved token ceiling"
              : missionLimitRecovery
                ? "Mission reached its observed SDK token ceiling"
                : paused
                  ? state.pauseReason ?? "Waiting at a parent-owned gate"
                  : state.mode === "completed"
                    ? "Auto mode reached a stable Reality"
                    : "Manual control"}</strong>
        </p>
      </div>
      <dl>
        <div><dt>ACTIONS</dt><dd>{state.actionsCompleted} / {state.maxActions}</dd></div>
        <div><dt>LIMIT</dt><dd>{state.maxMinutes} min</dd></div>
      </dl>
      <nav aria-label="Guided auto mode controls">
        {["off", "stopped", "completed"].includes(state.mode)
          && run.status !== "stabilised"
          && !missionLimitRecovery && (
          <button type="button" onClick={() => onControl("start")} disabled={busy}>
            <Play size={14} /> Start guided auto
          </button>
        )}
        {running && (
          <button type="button" onClick={() => onControl("pause")} disabled={busy}>
            <Pause size={14} /> Pause
          </button>
        )}
        {paused && !budgetRecovery && !missionLimitRecovery && (
          <button type="button" className="is-primary" onClick={() => onControl("resume")} disabled={busy}>
            <Play size={14} /> Approve and continue
          </button>
        )}
        {(running || paused) && (
          <button type="button" onClick={() => onControl("stop")} disabled={busy}>
            <Square size={13} /> Stop
          </button>
        )}
      </nav>
      {budgetRecovery && rejectedIntervention && (
        <div className="autopilot-budget-recovery" data-testid="intervention-budget-recovery">
          <span>
            <small>BOUNDED RETRY APPROVAL</small>
            <strong>
              {rejectedIntervention.lastAttemptTokens !== undefined
                ? `${rejectedIntervention.lastAttemptTokens.toLocaleString()} used / ${currentBudget.toLocaleString()} approved`
                : `Prior attempt exceeded the ${currentBudget.toLocaleString()} approved ceiling`}
            </strong>
            <p>{sameHardCeilingRetry
              ? "The Dream baseline was restored. Retry uses a fresh coordinator context at the existing hard ceiling."
              : "The Dream baseline was restored. No Codex usage resumes until you approve a new ceiling."}</p>
          </span>
          <label>
            <small>{sameHardCeilingRetry ? "HARD RETRY CEILING" : "NEW RETRY CEILING"}</small>
            <input
              aria-label="Approved intervention token ceiling"
              type="number"
              min={Math.min(currentBudget + 1_000, maximumBudget)}
              max={maximumBudget}
              step={1_000}
              value={approvedBudget}
              onChange={(event) => setApprovedBudget(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="is-primary"
            onClick={() => onApproveInterventionBudget(approvedBudget)}
            disabled={
              busy
              || (!sameHardCeilingRetry && approvedBudget <= currentBudget)
              || (sameHardCeilingRetry && approvedBudget !== currentBudget)
              || approvedBudget > maximumBudget
            }
          >
            <ShieldCheck size={14} /> {sameHardCeilingRetry
              ? `Retry at ${approvedBudget.toLocaleString()}`
              : `Approve ${approvedBudget.toLocaleString()} and retry`}
          </button>
          {maximumBudget < currentBudget && (
            <small className="budget-limit-warning">
              No bounded retry remains under this Mission&apos;s overall ceiling. Stop this run and form a Mission with a larger overall budget.
            </small>
          )}
        </div>
      )}
      {missionLimitRecovery && (
        <div className="autopilot-budget-recovery" data-testid="mission-limit-recovery">
          <span>
            <small>MISSION LIMIT APPROVAL</small>
            <strong>
              {observedMissionTokensCount.toLocaleString()} observed / {run.definition.tokenBudget.toLocaleString()} approved
            </strong>
            <p>
              {run.definition.tokenBudget < maximumMissionBudget
                ? "Reality state is preserved. No Codex usage resumes until you approve a higher observed-token ceiling."
                : "The Mission already uses the maximum supported observed-token ceiling. Provider limits remain controlled by the Codex account."}
            </p>
          </span>
          {run.definition.tokenBudget < maximumMissionBudget && (
            <>
              <label>
                <small>NEW MISSION CEILING</small>
                <input
                  aria-label="Approved Mission token ceiling"
                  type="number"
                  min={minimumMissionBudget}
                  max={maximumMissionBudget}
                  step={100_000}
                  value={approvedMissionBudget}
                  onChange={(event) => setApprovedMissionBudget(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                className="is-primary"
                onClick={() => onApproveMissionLimits(approvedMissionBudget)}
                disabled={
                  busy
                  || approvedMissionBudget < minimumMissionBudget
                  || approvedMissionBudget > maximumMissionBudget
                }
              >
                <ShieldCheck size={14} /> Approve {approvedMissionBudget.toLocaleString()} ceiling
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function MissionOutcomePanel({
  run,
  collapsed,
  onToggle
}: {
  run: MissionRun;
  collapsed: boolean;
  onToggle(): void;
}) {
  const outcome = run.outcome;
  if (!outcome) return null;
  return (
    <section className="outcome-summary mission-outcome" data-testid="mission-outcome">
      <div className="outcome-intro">
        <span className="eyebrow">REALITY OUTCOME</span>
        <h2>{outcome.title}</h2>
        <p>{outcome.summary}</p>
      </div>
      <div className="outcome-results">
        <div><BrainCircuit size={19} /><span><b>{outcome.metrics.realitiesExplored} Dreams lived</b><small>Maximum depth {outcome.metrics.maximumDepth}; {outcome.metrics.subjectsReturned} Subjects returned.</small></span></div>
        <div><Fingerprint size={19} /><span><b>{outcome.metrics.memoriesVerified} memories admitted</b><small>{outcome.metrics.interventionsDetected} injected faults detected; {outcome.metrics.memoriesQuarantined} unsafe memories quarantined.</small></span></div>
        <div><ShieldCheck size={19} /><span><b>{outcome.metrics.proofsPassed} of {outcome.metrics.proofsTotal} proofs passed</b><small>{outcome.metrics.changedFiles} Reality files changed.</small></span></div>
      </div>
      <p className="outcome-boundary"><LockKeyhole size={15} /><span><b>Risk prevented</b> {outcome.preventedRisk}</span></p>
      <div className="outcome-actions">
        <button type="button" onClick={onToggle}>
          <Minimize2 size={15} /> {collapsed ? "Reveal lived Realities" : "Collapse Dreams into Reality"}
        </button>
        <span><BrainCircuit size={14} /> {outcome.generalisedInvariants.length} inherited truths</span>
      </div>
    </section>
  );
}

function RealityMirrorBand({ reflections }: { reflections: MissionRun["reflections"] }) {
  const reflection = reflections.at(-1);
  if (!reflection) return null;
  return (
    <section
      className="reality-mirror workspace-band workspace-band-reflection"
      id="reality-reflection"
      data-testid="reality-mirror"
      tabIndex={-1}
    >
      <header>
        <span><BrainCircuit size={16} /> REALITY MIRROR / SIBLING COMPARISON</span>
        <b>{Math.round(reflection.confidence * 100)}% EVIDENCE COVERAGE</b>
      </header>
      <div>
        {reflection.evidenceMatrix.map((entry) => (
          <article key={entry.realityId}>
            <small>{entry.realityName}</small>
            <strong>{entry.evidenceTitles.length} evidence signals</strong>
            <p>{entry.invariants[0] ?? entry.remainingUncertainty[0] ?? "No invariant survived this world."}</p>
          </article>
        ))}
      </div>
      <footer>
        <span><ShieldCheck size={13} /> {reflection.sharedInvariants.length} invariants survived every sibling</span>
        <span><CircleDot size={13} /> {reflection.disagreements.length} disagreements remain visible</span>
      </footer>
    </section>
  );
}

function MemoryAscentBand({
  realities,
  seals,
  interventions
}: {
  realities: Reality[];
  seals: MissionRun["memoryIntegrity"];
  interventions: MissionRun["interventions"];
}) {
  if (!seals.length) return null;
  return (
    <section
      className="memory-ascent workspace-band workspace-band-memory"
      id="reality-memory-ascent"
      data-testid="memory-ascent"
      tabIndex={-1}
    >
      <header><ArrowUpFromLine size={16} /><span><b>MEMORY ASCENT</b><small>Every Kick is judged before knowledge moves upward</small></span></header>
      <div>
        {seals.map((seal) => {
          const source = realities.find((reality) => reality.id === seal.realityId);
          const parent = realities.find((reality) => reality.id === seal.parentRealityId);
          const intervention = interventions.find((entry) => entry.realityId === seal.realityId);
          return (
            <article className={`memory-ascent-row is-${seal.verdict}`} key={seal.id}>
              <span><strong>{source ? realityDisplayName(source) : "Dream"}</strong><small>Depth {source?.depth ?? "?"}</small></span>
              <ChevronRight size={14} />
              <span><strong>{seal.verdict === "verified" ? "Totem Check admitted memory" : "Totem Check quarantined memory"}</strong><small>{seal.checks.filter((check) => check.status === "passed").length} / {seal.checks.length} checks passed</small></span>
              <ChevronRight size={14} />
              <span>
                <strong>{seal.verdict === "verified"
                  ? parent ? realityDisplayName(parent) : "Parent"
                  : "No parent change"}</strong>
                <small>
                  {intervention?.assessment
                    ? `Adversarial Subject: ${intervention.assessment.outcome}${intervention.containedAt ? " / mutation contained" : ""}`
                    : seal.verdict === "verified" ? "Knowledge propagated" : "Unsafe assumption contained"}
                </small>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MissionActionDock({
  snapshot,
  busy,
  replaying,
  phaseSteps,
  onAction
}: {
  snapshot: MissionSnapshot;
  busy: boolean;
  replaying: boolean;
  phaseSteps: RealityPhaseStep[];
  onAction(action: MissionAction): void;
}) {
  const ceilingReached = (snapshot.run.observedTokens
    ?? observedMissionTokens(snapshot.run.events)) >= snapshot.run.definition.tokenBudget;
  const next = ceilingReached ? null : snapshot.nextAction;
  const blocked = busy
    || Boolean(snapshot.operation)
    || replaying
    || ceilingReached
    || missionAutopilot(snapshot.run).mode === "running";
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
              ? snapshot.run.definition.tokenBudget < 30_000_000
                ? "Observed SDK token ceiling reached; approve a higher ceiling above to preserve and continue this Reality"
                : "Maximum observed SDK token ceiling reached; no further Codex action can enter this Mission"
              : canonicalProductCopy(snapshot.operation?.label ?? next?.label ?? "Reality stabilised")}
        </strong>
        <div><i style={{ width: `${progress}%` }} /></div>
      </div>
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
        <ArrowUpFromLine size={17} /> {isKick ? "Kick: return memory" : "Kick"}
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
  onAppendEvents,
  onDeleted
}: {
  snapshot: MissionSnapshot;
  runtime: RuntimeInfo;
  onReload(snapshot: MissionSnapshot): void;
  onAppendEvents(events: RealityEvent[]): void;
  onDeleted(): void;
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
  const [dreamGateOpen, setDreamGateOpen] = useState(false);
  const [collapsedDreams, setCollapsedDreams] = useState(false);
  const [wakeStage, setWakeStage] = useState<"collecting" | "sealing" | "returning" | null>(null);
  const [wakeRealityName, setWakeRealityName] = useState<string | undefined>();
  const [hasMoreEvents, setHasMoreEvents] = useState(
    missionEventCount(snapshot.run) > snapshot.run.events.length
  );
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);
  const reconcileTimer = useRef<number | null>(null);
  const wakeClearTimer = useRef<number | null>(null);
  const realityNames = useRef(new Map(
    snapshot.run.realities.map((entry) => [entry.id, entry.name])
  ));
  const run = snapshot.run;
  const reality = snapshot.activeReality;
  // Browser state may outlive a schema migration during local development.
  const interventions = run.interventions ?? [];
  const memoryIntegrity = run.memoryIntegrity ?? [];
  const interventionContract = run.definition.intervention;
  const usedTokens = run.observedTokens ?? observedMissionTokens(run.events);
  const totalEvents = missionEventCount(run);
  const autopilotMode = missionAutopilot(run).mode;
  const root = run.realities.find((entry) => entry.depth === 0);
  const pendingProposal = reality.proposals.find((proposal) => proposal.status === "open") ?? null;

  useEffect(() => {
    if (timelineIndex === null) setSelectedRealityId(run.activeRealityId);
  }, [run.activeRealityId, timelineIndex]);

  useEffect(() => {
    realityNames.current = new Map(run.realities.map((entry) => [entry.id, entry.name]));
  }, [run.realities]);

  useEffect(() => {
    setHasMoreEvents(totalEvents > run.events.length);
  }, [run.events.length, totalEvents]);

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
      let value: RealityEvent | { type: "connected" };
      try {
        value = JSON.parse(event.data) as RealityEvent | { type: "connected" };
      } catch {
        return;
      }
      if (value.type === "connected" || !("realityId" in value)) return;
      onAppendEvents([value]);
      if (
        value.realityId
        && ["kick.triggered", "memory.returned", "memory.quarantined", "reality.stabilised"].includes(value.type)
      ) {
        setPulseRealityId(value.realityId);
        window.setTimeout(() => setPulseRealityId(null), 1_400);
      }
      if (value.type === "wake.collecting" || value.type === "kick.triggered") {
        setWakeStage("collecting");
      } else if (value.type === "wake.sealing") {
        setWakeStage("sealing");
      } else if (value.type === "wake.returning") {
        setWakeStage("returning");
      }
      if (value.type.startsWith("wake.") || value.type === "kick.triggered") {
        setWakeRealityName(
          realityNames.current.get(value.realityId)
        );
      }
      if (value.type === "wake.returning" || value.type === "memory.quarantined") {
        if (wakeClearTimer.current) window.clearTimeout(wakeClearTimer.current);
        wakeClearTimer.current = window.setTimeout(() => {
          setWakeStage(null);
          setWakeRealityName(undefined);
        }, 2_000);
      }
      if (value.type !== "codex.progress") {
        if (reconcileTimer.current) window.clearTimeout(reconcileTimer.current);
        reconcileTimer.current = window.setTimeout(() => void load(), 180);
      }
    };
    return () => {
      stream.close();
      if (reconcileTimer.current) window.clearTimeout(reconcileTimer.current);
      if (wakeClearTimer.current) window.clearTimeout(wakeClearTimer.current);
    };
  }, [load, onAppendEvents, run.id]);

  useEffect(() => {
    if (!snapshot.operation && !busy && autopilotMode !== "running") return;
    const poll = window.setInterval(() => void load(), 5_000);
    return () => window.clearInterval(poll);
  }, [autopilotMode, busy, load, snapshot.operation]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      snapshot.operation ? 1_000 : 15_000
    );
    return () => window.clearInterval(timer);
  }, [snapshot.operation?.id]);

  const act = async (action: MissionAction) => {
    if (action === "create_dream") {
      setDreamGateOpen(true);
      return;
    }
    if (action === "kick") {
      setWakeStage("collecting");
      setWakeRealityName(realityDisplayName(reality));
    }
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
      setWakeStage(null);
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const confirmDream = async () => {
    setDreamGateOpen(false);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(run.id)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_dream" })
      });
      const body = await readJson<MissionSnapshot & { error?: string }>(
        response,
        "The Dream could not be created."
      );
      if (!response.ok) throw new Error(body.error ?? "The Dream could not be created.");
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

  const controlAutopilot = async (command: AutopilotCommand) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(run.id)}/autopilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const body = await readJson<MissionSnapshot & { error?: string }>(
        response,
        "Guided auto mode could not change state."
      );
      if (!response.ok) throw new Error(body.error ?? "Guided auto mode could not change state.");
      onReload(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const approveInterventionBudget = async (tokenBudget: number) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/missions/${encodeURIComponent(run.id)}/intervention-budget`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenBudget, retry: true })
        }
      );
      const body = await readJson<MissionSnapshot & { error?: string }>(
        response,
        "The bounded intervention budget could not be approved."
      );
      if (!response.ok) {
        throw new Error(body.error ?? "The bounded intervention budget could not be approved.");
      }
      onReload(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const approveMissionLimits = async (tokenBudget: number) => {
    setBusy(true);
    setError(null);
    try {
      const autopilot = missionAutopilot(run);
      const response = await fetch(`/api/missions/${encodeURIComponent(run.id)}/limits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenBudget,
          maxActions: autopilot.maxActions,
          maxMinutes: autopilot.maxMinutes
        })
      });
      const body = await readJson<MissionSnapshot & { error?: string }>(
        response,
        "The Mission limits could not be approved."
      );
      if (!response.ok) {
        throw new Error(body.error ?? "The Mission limits could not be approved.");
      }
      onReload(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const loadEarlierEvents = async () => {
    const earliest = run.events[0];
    if (!earliest) return;
    setLoadingMoreEvents(true);
    setError(null);
    try {
      const cursor = `${earliest.occurredAt}|${earliest.id}`;
      const response = await fetch(
        `/api/missions/${encodeURIComponent(run.id)}/events?limit=200&before=${encodeURIComponent(cursor)}`,
        { cache: "no-store" }
      );
      const body = await readJson<{
        events?: RealityEvent[];
        nextCursor?: string | null;
        error?: string;
      }>(response, "Earlier Reality events could not be loaded.");
      if (!response.ok) throw new Error(body.error ?? "Earlier Reality events could not be loaded.");
      onAppendEvents(body.events ?? []);
      setHasMoreEvents(Boolean(body.nextCursor));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingMoreEvents(false);
    }
  };

  const loadCompleteReplayHistory = async (): Promise<RealityEvent[]> => {
    if (!hasMoreEvents) return run.events;
    const earliest = run.events[0];
    if (!earliest) return run.events;
    setLoadingMoreEvents(true);
    setError(null);
    try {
      const merged = new Map(run.events.map((event) => [event.id, event]));
      let before: string | null = `${earliest.occurredAt}|${earliest.id}`;
      for (let page = 0; before && page < 200; page += 1) {
        const response: Response = await fetch(
          `/api/missions/${encodeURIComponent(run.id)}/events?limit=500&before=${encodeURIComponent(before)}`,
          { cache: "no-store" }
        );
        const body: {
          events?: RealityEvent[];
          nextCursor?: string | null;
          error?: string;
        } = await readJson(response, "Complete Reality history could not be prepared for replay.");
        if (!response.ok) {
          throw new Error(body.error ?? "Complete Reality history could not be prepared for replay.");
        }
        for (const event of body.events ?? []) merged.set(event.id, event);
        before = body.nextCursor ?? null;
      }
      if (before) throw new Error("Reality history exceeded the bounded replay pagination limit.");
      const complete = [...merged.values()].sort((left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
      );
      if (complete.length !== totalEvents) {
        throw new Error(`Replay loaded ${complete.length} of ${totalEvents} persisted events.`);
      }
      onAppendEvents(complete);
      setHasMoreEvents(false);
      return complete;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setLoadingMoreEvents(false);
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
  const replaying = timelineIndex !== null;
  const replayActiveId = replayActiveRealityId(
    replayedRealities,
    visibleEvents,
    run.activeRealityId
  );
  const projectedInterventions = replayInterventions(
    interventions,
    visibleEvents,
    replaying
  );
  const projectedMemoryIntegrity = replayMemoryIntegrity(
    memoryIntegrity,
    visibleEvents,
    replaying
  );
  const projectedAnchorResults = replayAnchorResults(
    run.proofResults,
    visibleEvents,
    replaying
  );
  const projectedFinalDiff = replayFinalDiff(run.finalDiff, visibleEvents, replaying);
  const projectedReflections = replayReflections(
    run.reflections ?? [],
    visibleEvents,
    replaying
  );
  const projectedOutcome = replayOutcome(run.outcome, visibleEvents, replaying);
  const projectedIntervention = projectedInterventions.find((entry) =>
    entry.realityId === replayActiveId
  ) ?? projectedInterventions.at(-1);
  const projectedIntegritySeal = projectedMemoryIntegrity.find((entry) =>
    entry.realityId === replayActiveId
  ) ?? projectedMemoryIntegrity.at(-1);
  const activeOperation: PresentedRealityOperation | null = snapshot.operation
    ? {
        ...snapshot.operation,
        executor: ["create_dream", "verify", "stabilise"].includes(snapshot.operation.action)
          ? "orchestrator"
          : "codex"
      }
    : null;
  const displayedOperation = replaying ? null : activeOperation;
  const phaseSteps = missionPhaseSteps(run, replayedRealities, visibleEvents, replaying);
  const replayedRoot = replayedRealities.find((entry) => entry.depth === 0);
  const graphRealities = collapsedDreams && replayedRoot ? [replayedRoot] : replayedRealities;
  const displayedStatus = replaying
    ? visibleEvents.some((event) => event.type === "reality.stabilised")
      ? "STABILISED"
      : visibleEvents.slice().reverse().find((event) =>
          event.type === "reality.fractured" || event.type === "reality.recovered"
        )?.type === "reality.fractured"
        ? "FRACTURED"
        : visibleEvents.some((event) => event.type === "verification.started")
          ? "VERIFYING"
          : visibleEvents.some((event) => event.type !== "reality.created")
            ? "EXPLORING"
            : "CREATING"
    : statusLabel(run.status);

  useEffect(() => {
    if (timelineIndex !== null && replayActiveId) setSelectedRealityId(replayActiveId);
  }, [replayActiveId, timelineIndex]);

  return (
    <main className="app-shell mission-run">
      <RealityTopbar
        codexMode={runtime.mode}
        model={runtime.model}
        authSource={runtime.authSource}
        environment={`CODEX SDK ${runtime.sdkVersion}`}
        realityCount={replayedRealities.length}
        replaying={replaying}
        actions={(
          <>
            <a className="mission-link" href="/missions" title="Mission Control">
              <ArrowLeft size={13} />
              <span>MISSION CONTROL</span>
            </a>
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
        eyebrow={`${replaying ? "TIMELINE REPLAY" : "GENERALIZED MISSION"} / ${displayedStatus}`}
        title={run.definition.name}
        steps={phaseSteps}
      />

      <RealityJourneyBand
        realities={replayedRealities}
        events={visibleEvents}
        stabilised={visibleEvents.some((event) => event.type === "reality.stabilised")}
      />

      <MissionOutcomePanel
        run={{ ...run, outcome: projectedOutcome }}
        collapsed={collapsedDreams}
        onToggle={() => {
          setCollapsedDreams((current) => !current);
          if (!collapsedDreams && root) setSelectedRealityId(root.id);
        }}
      />

      <section className="mission-context-band" data-testid="mission-context">
        <p>{run.definition.mission}</p>
        <dl>
          <div><dt>MODEL</dt><dd>{runtime.model}</dd></div>
          <div><dt>OBSERVED SDK TOKENS</dt><dd>{(replaying ? observedMissionTokens(visibleEvents) : usedTokens).toLocaleString()} / {run.definition.tokenBudget.toLocaleString()}</dd></div>
          <div><dt>DEPTH BUDGET</dt><dd>{Math.max(0, ...replayedRealities.map((entry) => entry.depth))} / {run.definition.maxDreamDepth}</dd></div>
        </dl>
      </section>

      {!replaying && (
        <MissionAutoModeBar
          run={run}
          busy={busy}
          onControl={(command) => void controlAutopilot(command)}
          onApproveMissionLimits={(tokenBudget) =>
            void approveMissionLimits(tokenBudget)}
          onApproveInterventionBudget={(tokenBudget) =>
            void approveInterventionBudget(tokenBudget)}
        />
      )}

      {error && !replaying && (
        <div className="mission-error">
          <XCircle size={16} />
          <span><b>Reality fractured</b>{canonicalProductCopy(error)}</span>
        </div>
      )}

      {displayedOperation && (
        <OperationMonitor
          operation={displayedOperation}
          realities={run.realities}
          events={run.events}
          now={now}
        />
      )}

      {!replaying && <WakeTransition stage={wakeStage} realityName={wakeRealityName} />}

      <RealityTimeline
        events={run.events}
        realities={run.realities}
        index={timelineIndex}
        now={now}
        replayIncomplete={hasMoreEvents}
        onPrepareReplay={loadCompleteReplayHistory}
        onChange={(index) => {
          setTimelineIndex(index);
          if (index !== null) {
            setCollapsedDreams(false);
            setRevealCode(false);
          }
        }}
      />

      <RealityWorkspace
        realities={replayedRealities}
        sourceRealities={run.realities}
        events={visibleEvents}
        activeRealityId={replayActiveId}
        selectedRealityId={selectedRealityId}
        onSelectReality={setSelectedRealityId}
        inspectorTab={inspectorTab}
        onInspectorTab={setInspectorTab}
        operation={displayedOperation}
        now={now}
        pulseRealityId={replaying ? null : pulseRealityId}
        graphRealities={graphRealities}
        memoryIntegrity={projectedMemoryIntegrity}
        anchorResults={projectedAnchorResults}
        finalDiff={projectedFinalDiff}
        revealCode={revealCode}
        onToggleCode={() => setRevealCode((current) => !current)}
        hasMoreEvents={replaying ? false : hasMoreEvents}
        loadingMoreEvents={loadingMoreEvents}
        onLoadMoreEvents={() => void loadEarlierEvents()}
        totalEventCount={replaying ? visibleEvents.length : totalEvents}
        requirementsSupplement={(
          <article className="mission-parent-policy" data-testid="mission-parent-policy">
            <span><Fingerprint size={15} /></span>
            <div>
              <small>PARENT POLICY / ARMED BEFORE DREAMING</small>
              <strong>{run.definition.memoryPolicy.replaceAll("-", " ")}</strong>
              <p>{run.definition.runtimeLaws[0] ?? "Only validated, evidence-backed memory may move upward to its parent."}</p>
            </div>
          </article>
        )}
        reflectionContent={<RealityMirrorBand reflections={projectedReflections} />}
        integrityContent={(
          <>
            <header className="mission-chapter-heading">
              <span><Fingerprint size={18} /></span>
              <div><small>TOTEM CHECK</small><strong>Integrity verdict and sealed adversarial intervention</strong></div>
              <b>{projectedMemoryIntegrity.length} SEALED MEMORIES</b>
            </header>
            <div className="mission-guardrail-band">
              {projectedIntervention && interventionContract && (
                <article className={`mission-intervention intervention-${projectedIntervention.status}`} data-testid="intervention-ledger">
                  <div className="mission-intervention-heading">
                    <span>
                      <strong><ShieldAlert size={14} /> {interventionContract.subject.name} / {interventionContract.subject.role}</strong>
                      <small>ADVERSARIAL SUBJECT / {projectedIntervention.containedAt ? "CONTAINED" : projectedIntervention.status.toUpperCase()} / REVEAL AFTER DIAGNOSIS</small>
                    </span>
                    <b>{interventionContract.maxChangedFiles} FILES / {interventionContract.maxPatchLines} LINES</b>
                  </div>
                  {projectedIntervention.status === "armed" && <p>No mutation has run. The operator-owned contract is armed for an explicit action.</p>}
                  {projectedIntervention.status === "sealed" && <p>{projectedIntervention.changedFileCount ?? 0} changed file{projectedIntervention.changedFileCount === 1 ? "" : "s"} sealed. Cause and paths remain hidden until Kick.</p>}
                  {projectedIntervention.status === "rejected" && <p>{projectedIntervention.rejectionReason ?? "The mutation breached its contract and the Dream was restored."}</p>}
                  {projectedIntervention.status === "rejected" && projectedIntervention.lastAttemptTokens !== undefined && (
                    <dl>
                      <div><dt>ATTEMPT USED</dt><dd>{projectedIntervention.lastAttemptTokens.toLocaleString()} tokens</dd></div>
                      <div><dt>APPROVED CEILING</dt><dd>{interventionContract.tokenBudget.toLocaleString()} tokens</dd></div>
                      <div><dt>APPROVALS</dt><dd>{projectedIntervention.budgetApprovals?.length ?? 0} recorded</dd></div>
                    </dl>
                  )}
                  {projectedIntervention.status === "revealed" && projectedIntervention.report && projectedIntervention.assessment && (
                    <p>
                      {projectedIntervention.assessment.outcome.toUpperCase()}: {projectedIntervention.report.summary}
                      {projectedIntervention.containedAt && (
                        <> The Dream baseline was restored before memory ascent; {projectedIntervention.excludedArtefactPaths?.length ?? 0} injected artefact path{projectedIntervention.excludedArtefactPaths?.length === 1 ? " was" : "s were"} excluded.</>
                      )}
                    </p>
                  )}
                </article>
              )}
              <article
                className={`mission-integrity integrity-${projectedIntegritySeal?.verdict ?? "pending"}`}
                data-testid="memory-integrity"
              >
                <div className="mission-intervention-heading">
                  <span>
                    <strong><Fingerprint size={14} /> {projectedIntegritySeal?.verdict === "verified" ? "Memory verified" : projectedIntegritySeal?.verdict === "quarantined" ? "Memory quarantined" : "Parent policy armed"}</strong>
                    <small>{projectedIntegritySeal ? `${projectedIntegritySeal.policyVersion.toUpperCase()} / ${projectedIntegritySeal.checks.filter((check) => check.status === "passed").length} OF ${projectedIntegritySeal.checks.length} CHECKS PASSED` : "NO MEMORY HAS CROSSED A KICK"}</small>
                  </span>
                  <b>{projectedIntegritySeal ? `${projectedIntegritySeal.descendantSealIds.length} DESCENDANT SEALS` : `${replayedRealities.find((entry) => entry.id === replayActiveId)?.anchors.length ?? reality.anchors.length} REALITY ANCHORS`}</b>
                </div>
                {projectedIntegritySeal && (
                  <div className="mission-integrity-checks">
                    {projectedIntegritySeal.checks.map((check) => (
                      <span className={`integrity-check is-${check.status}`} key={check.name} title={check.summary}>
                        {check.status === "passed" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {check.name.replaceAll("-", " ")}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </>
        )}
        memoryAscentContent={(
          <MemoryAscentBand
            realities={replayedRealities}
            seals={projectedMemoryIntegrity}
            interventions={projectedInterventions}
          />
        )}
      />

      <AdminDrawer
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onStateChanged={load}
        mission={{
          id: run.id,
          name: run.definition.name,
          status: statusLabel(run.status),
          eventCount: totalEvents,
          realityCount: run.realities.length
        }}
        onMissionDeleted={onDeleted}
      />
      {dreamGateOpen && pendingProposal && (
        <DreamGate
          proposal={pendingProposal}
          owner={realityDisplayName(reality)}
          onCancel={() => setDreamGateOpen(false)}
          onConfirm={() => void confirmDream()}
        />
      )}
      <MissionActionDock
        snapshot={snapshot}
        busy={busy}
        replaying={replaying}
        phaseSteps={phaseSteps}
        onAction={(action) => void act(action)}
      />
    </main>
  );
}

export function MissionComposer({ initialMissionId }: { initialMissionId?: string }) {
  const router = useRouter();
  const [composer, setComposer] = useState(initialState);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<TrainingTargetStatus[]>([]);
  const [targetBusy, setTargetBusy] = useState(false);
  const [composerAdminOpen, setComposerAdminOpen] = useState(false);

  const mergeSnapshot = useCallback((next: MissionSnapshot) => {
    setSnapshot((current) => {
      if (!current || current.run.id !== next.run.id) return next;
      const events = new Map<string, RealityEvent>();
      for (const event of [...current.run.events, ...next.run.events]) events.set(event.id, event);
      return {
        ...next,
        run: {
          ...next.run,
          events: [...events.values()].sort((left, right) =>
            left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
          )
        }
      };
    });
  }, []);

  const appendEvents = useCallback((incoming: RealityEvent[]) => {
    if (!incoming.length) return;
    setSnapshot((current) => {
      if (!current) return current;
      const events = new Map(current.run.events.map((event) => [event.id, event]));
      for (const event of incoming) events.set(event.id, event);
      return {
        ...current,
        run: {
          ...current.run,
          events: [...events.values()].sort((left, right) =>
            left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
          )
        }
      };
    });
  }, []);

  const loadIndex = useCallback(async () => {
    const response = await fetch("/api/missions", { cache: "no-store" });
    const body = await readJson<{
      runs?: MissionSummary[];
      library?: MissionSummary[];
      runtime?: RuntimeInfo;
      enabled?: boolean;
      error?: string;
    }>(response, "Could not load Mission Composer.");
    if (!response.ok || !body.runtime) throw new Error(body.error ?? "Could not load Mission Composer.");
    setRuntime(body.runtime);
    setMissions(body.library ?? body.runs ?? []);
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
    if (initialMissionId) {
      void openRun(initialMissionId);
      return;
    }
    const legacyMissionId = new URLSearchParams(window.location.search).get("mission");
    if (legacyMissionId) {
      router.replace(`/missions/${encodeURIComponent(legacyMissionId)}`, { scroll: true });
    }
  }, [initialMissionId, openRun, router]);

  useEffect(() => {
    if (!snapshot) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [snapshot?.run.id]);

  const formMission = async () => {
    const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
    const requiredFields: Array<readonly [string, string]> = [
      ["Reality name", composer.name],
      ["Local Git repository", composer.repositoryPath],
      ["Mission", composer.mission],
      ["Scope", composer.scope],
      ["Initial belief to challenge", composer.premise],
      ["Constitution constraints", composer.constraints],
      ["Wake contract", composer.wakeContract],
      ...composer.proofs.flatMap((proof, index) => [
        [`Proof ${index + 1} name`, proof.name] as const,
        [`Proof ${index + 1} executable`, proof.executable] as const
      ]),
      ...composer.subjects.flatMap((subject, index) => [
        [`Subject ${index + 1} name`, subject.name] as const,
        [`Subject ${index + 1} role`, subject.role] as const,
        [`Subject ${index + 1} mission`, subject.mission] as const
      ])
    ];
    if (composer.interventionEnabled) {
      requiredFields.push(
        ["Intervention hypothesis", composer.interventionHypothesis],
        ["Intervention allowed paths", composer.interventionAllowedPaths]
      );
    }
    if (composer.dependencyBootstrapEnabled) {
      requiredFields.push(
        ["Dependency manifest", composer.dependencyManifestPath]
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
      wakeContract: lines(composer.wakeContract),
      runtimeLaws: lines(composer.runtimeLaws),
      safetyProfile: composer.safetyProfile,
      memoryPolicy: composer.memoryPolicy,
      dreamStrategy: composer.dreamStrategy,
      maxSiblingDreams: composer.maxSiblingDreams,
      proofs: composer.proofs.map((proof) => ({
        name: proof.name.trim(),
        executable: proof.executable.trim(),
        args: lines(proof.args)
      })),
      subjects: composer.subjects.map((subject) => ({
        name: subject.name.trim(),
        role: subject.role.trim(),
        mission: subject.mission.trim()
      })),
      dependencyBootstrap: composer.dependencyBootstrapEnabled
        ? composer.dependencyBootstrapKind === "python-venv"
          ? {
              kind: "python-venv",
              manifestPath: composer.dependencyManifestPath.trim(),
              pythonExecutable: "auto",
              virtualEnvironmentPath: ".venv",
              indexUrl: "https://pypi.org/simple",
              requiredPythonVersion: composer.requiredPythonVersion.trim() || undefined,
              targetDepth: composer.dependencyTargetDepth
            }
          : {
              kind: "node-npm",
              manifestPath: "package-lock.json",
              nodeExecutable: "node",
              packageManagerExecutable: "npm",
              dependencyPath: "node_modules",
              indexUrl: "https://registry.npmjs.org/",
              requiredNodeVersion: composer.requiredNodeVersion.trim() || undefined,
              targetDepth: composer.dependencyTargetDepth
            }
        : undefined,
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
        "Could not create the Mission."
      );
      if (!response.ok) throw new Error(body.error ?? "Could not create the Mission.");
      setSnapshot(body);
      router.push(`/missions/${encodeURIComponent(body.run.id)}`, { scroll: true });
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
          onReload={mergeSnapshot}
          onAppendEvents={appendEvents}
          onDeleted={() => {
            setSnapshot(null);
            router.replace("/missions", { scroll: true });
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
          authSource={runtime?.authSource}
          environment={runtime ? `CODEX SDK ${runtime.sdkVersion}` : "Runtime checking"}
          realityCount={missions.reduce((total, mission) => total + mission.realityCount, 0)}
          actions={(
            <>
              <a className="mission-link" href="/missions/password-reset" title="Open the Password Reset Demo Mission">
                <Play size={13} />
                <span>DEMO MISSION</span>
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
            <span className="eyebrow">MISSION CONTROL / TRUSTED LOCAL MODE</span>
            <h1>Create a Mission</h1>
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
            <span><b>Real mode required</b>Run <code>npm run dev:real</code>. Creating a Mission never starts Codex; only an explicit Reality action does.</span>
          </div>
        )}

        <div className="mission-composer-grid">
          <section className="mission-form">
            <div className="mission-section-title">
              <span><CircleDot size={16} /> REALITY / ROOT</span>
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
              <textarea required value={composer.mission} onChange={(event) => setComposer({ ...composer, mission: event.target.value })} placeholder="What must Reality achieve?" />
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
            <label>
              <span>Authorization profile</span>
              <select
                value={composer.safetyProfile}
                onChange={(event) => setComposer({
                  ...composer,
                  safetyProfile: event.target.value as MissionSafetyProfile
                })}
              >
                <option value="authorized-local-defensive-review">Authorized local defensive review</option>
                <option value="general-development">General local development</option>
              </select>
            </label>
            <label>
              <span>Memory admission policy</span>
              <select
                value={composer.memoryPolicy}
                onChange={(event) => setComposer({
                  ...composer,
                  memoryPolicy: event.target.value as MissionMemoryPolicy
                })}
              >
                <option value="verified-reports-and-artefacts">Verified reports and artefacts</option>
                <option value="verified-invariants-only">Verified invariants only</option>
              </select>
            </label>
            <label className="mission-field-wide">
              <span>Wake contract / one requirement per line</span>
              <textarea required value={composer.wakeContract} onChange={(event) => setComposer({ ...composer, wakeContract: event.target.value })} />
            </label>
            <label className="mission-field-wide">
              <span>World laws / one per line</span>
              <textarea value={composer.runtimeLaws} onChange={(event) => setComposer({ ...composer, runtimeLaws: event.target.value })} />
            </label>

            <div className="mission-section-title mission-form-divider">
              <span><LockKeyhole size={16} /> DEPENDENCY ENVIRONMENT</span>
              <b>PARENT-AUTHORIZED / HOST-PRESERVING</b>
            </div>
            <label className="mission-toggle mission-field-wide">
              <input
                type="checkbox"
                checked={composer.dependencyBootstrapEnabled}
                onChange={(event) => setComposer({
                  ...composer,
                  dependencyBootstrapEnabled: event.target.checked
                })}
              />
              <span>Bootstrap pinned dependencies inside target Dreams and the base Reality before synthesis</span>
            </label>
            {composer.dependencyBootstrapEnabled && (
              <>
                <label>
                  <span>Environment kind</span>
                  <select
                    value={composer.dependencyBootstrapKind}
                    onChange={(event) => {
                      const kind = event.target.value as ComposerState["dependencyBootstrapKind"];
                      setComposer({
                        ...composer,
                        dependencyBootstrapKind: kind,
                        dependencyManifestPath: kind === "python-venv"
                          ? "requirements-reality.txt"
                          : "package-lock.json"
                      });
                    }}
                  >
                    <option value="python-venv">Python / .venv</option>
                    <option value="node-npm">Node / locked node_modules</option>
                  </select>
                </label>
                <label>
                  <span>Exact dependency manifest</span>
                  <input
                    required
                    value={composer.dependencyManifestPath}
                    readOnly={composer.dependencyBootstrapKind === "node-npm"}
                    onChange={(event) => setComposer({
                      ...composer,
                      dependencyManifestPath: event.target.value
                    })}
                  />
                </label>
                {composer.dependencyBootstrapKind === "python-venv" && (
                  <label>
                    <span>Required Python version / optional</span>
                    <input
                      value={composer.requiredPythonVersion}
                      placeholder="Auto-detect any installed Python 3"
                      onChange={(event) => setComposer({
                        ...composer,
                        requiredPythonVersion: event.target.value
                      })}
                    />
                  </label>
                )}
                {composer.dependencyBootstrapKind === "node-npm" && (
                  <label>
                    <span>Required Node version / optional exact version</span>
                    <input
                      value={composer.requiredNodeVersion}
                      placeholder="22.15.0"
                      onChange={(event) => setComposer({
                        ...composer,
                        requiredNodeVersion: event.target.value
                      })}
                    />
                  </label>
                )}
                <fieldset>
                  <legend>Bootstrap Dream depth</legend>
                  <div className="mission-segments">
                    {[1, 2, 3, 4, 5]
                      .filter((depth) => depth <= composer.maxDreamDepth)
                      .map((depth) => (
                        <button
                          type="button"
                          className={composer.dependencyTargetDepth === depth ? "is-selected" : ""}
                          onClick={() => setComposer({
                            ...composer,
                            dependencyTargetDepth: depth
                          })}
                          key={depth}
                        >
                          {depth}
                        </button>
                      ))}
                  </div>
                </fieldset>
                <div className="mission-trust-warning mission-field-wide">
                  <ShieldCheck size={18} />
                  <span>
                    <b>HOST RUNTIME PRESERVED</b>
                    {composer.dependencyBootstrapKind === "python-venv"
                      ? "Any installed Python 3 is auto-detected from python3 or python by default. Exact package pins install into this Reality's .venv; Python itself is never replaced."
                      : "npm ci verifies package-lock integrity, installs only into ignored node_modules, disables lifecycle scripts, and never changes host Node."}
                  </span>
                </div>
              </>
            )}

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
              <span>Inject one bounded Adversarial Subject at Dream depth {composer.interventionTargetDepth}</span>
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
                    {[1, 2, 3, 4, 5].filter((depth) => depth <= composer.maxDreamDepth).map((depth) => (
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
              <span><LockKeyhole size={16} /> IMMUTABLE PROOF SUITE</span>
              <b>{composer.proofs.length} PARENT-OWNED</b>
            </div>
            {composer.proofs.map((proof, proofIndex) => (
              <div className="mission-repeat-row mission-field-wide" key={proof.key}>
                <label>
                  <span>Proof {proofIndex + 1} name</span>
                  <input
                    required
                    value={proof.name}
                    onChange={(event) => setComposer({
                      ...composer,
                      proofs: composer.proofs.map((entry) => entry.key === proof.key
                        ? { ...entry, name: event.target.value }
                        : entry)
                    })}
                  />
                </label>
                <label>
                  <span>Executable</span>
                  <input
                    required
                    value={proof.executable}
                    onChange={(event) => setComposer({
                      ...composer,
                      proofs: composer.proofs.map((entry) => entry.key === proof.key
                        ? { ...entry, executable: event.target.value }
                        : entry)
                    })}
                  />
                </label>
                <label className="mission-field-wide">
                  <span>Arguments / one per line</span>
                  <textarea
                    value={proof.args}
                    onChange={(event) => setComposer({
                      ...composer,
                      proofs: composer.proofs.map((entry) => entry.key === proof.key
                        ? { ...entry, args: event.target.value }
                        : entry)
                    })}
                  />
                </label>
                {composer.proofs.length > 1 && (
                  <button
                    type="button"
                    className="mission-repeat-remove"
                    onClick={() => setComposer({
                      ...composer,
                      proofs: composer.proofs.filter((entry) => entry.key !== proof.key)
                    })}
                    aria-label={`Remove proof ${proofIndex + 1}`}
                    title="Remove proof"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {composer.proofs.length < 20 && (
              <button
                type="button"
                className="mission-add-row mission-field-wide"
                onClick={() => setComposer({
                  ...composer,
                  proofs: [...composer.proofs, {
                    key: crypto.randomUUID(),
                    name: "",
                    executable: "",
                    args: ""
                  }]
                })}
              >
                <Plus size={14} /> Add immutable proof
              </button>
            )}

            <div className="mission-section-title mission-form-divider">
              <span><Network size={16} /> EXPLORATION BUDGET</span>
            </div>
            <label>
              <span>Observed SDK token ceiling</span>
              <input type="number" min={10_000} max={30_000_000} step={10_000} value={composer.tokenBudget} onChange={(event) => setComposer({ ...composer, tokenBudget: Number(event.target.value) })} />
            </label>
            <label>
              <span>Dream exploration strategy</span>
              <select
                value={composer.dreamStrategy}
                onChange={(event) => setComposer({
                  ...composer,
                  dreamStrategy: event.target.value as MissionDreamStrategy
                })}
              >
                <option value="competing-siblings">Compare sibling Dreams</option>
                <option value="single-chain">Follow one nested chain</option>
              </select>
            </label>
            {composer.dreamStrategy === "competing-siblings" && (
              <label>
                <span>Maximum sibling Dreams per Reality</span>
                <input
                  type="number"
                  min={2}
                  max={3}
                  value={composer.maxSiblingDreams}
                  onChange={(event) => setComposer({
                    ...composer,
                    maxSiblingDreams: Number(event.target.value)
                  })}
                />
              </label>
            )}
            <fieldset>
              <legend>Maximum Dream depth</legend>
              <div className="mission-segments">
                {[1, 2, 3, 4, 5].map((depth) => (
                  <button
                    type="button"
                    className={composer.maxDreamDepth === depth ? "is-selected" : ""}
                    onClick={() => setComposer({
                      ...composer,
                      maxDreamDepth: depth,
                      dependencyTargetDepth: Math.min(composer.dependencyTargetDepth, depth),
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
              <GitBranch size={17} /> {busy ? "Creating Mission" : "Create Mission"}
            </button>
          </section>

          <aside className="mission-roster">
            <div className="mission-section-title">
              <span><UsersRound size={16} /> SUBJECT CHARTERS</span>
              <b>{composer.subjects.length} DIRECT THREADS</b>
            </div>
            {composer.subjects.map((subject, subjectIndex) => (
              <article className="mission-subject-editor" key={subject.key}>
                <span><UsersRound size={15} /></span>
                <div>
                  <input
                    aria-label={`Subject ${subjectIndex + 1} name`}
                    value={subject.name}
                    onChange={(event) => setComposer({
                      ...composer,
                      subjects: composer.subjects.map((entry) => entry.key === subject.key
                        ? { ...entry, name: event.target.value }
                        : entry)
                    })}
                  />
                  <input
                    aria-label={`Subject ${subjectIndex + 1} role`}
                    value={subject.role}
                    onChange={(event) => setComposer({
                      ...composer,
                      subjects: composer.subjects.map((entry) => entry.key === subject.key
                        ? { ...entry, role: event.target.value }
                        : entry)
                    })}
                  />
                  <textarea
                    aria-label={`Subject ${subjectIndex + 1} mission`}
                    value={subject.mission}
                    onChange={(event) => setComposer({
                      ...composer,
                      subjects: composer.subjects.map((entry) => entry.key === subject.key
                        ? { ...entry, mission: event.target.value }
                        : entry)
                    })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setComposer({
                    ...composer,
                    subjects: composer.subjects.filter((entry) => entry.key !== subject.key)
                  })}
                  aria-label={`Remove Subject ${subject.name || subjectIndex + 1}`}
                  title="Remove Subject"
                >
                  <Trash2 size={13} />
                </button>
              </article>
            ))}
            {composer.subjects.length < 6 && (
              <button
                type="button"
                className="mission-add-subject"
                onClick={() => setComposer({
                  ...composer,
                  subjects: [...composer.subjects, {
                    key: crypto.randomUUID(),
                    name: "",
                    role: "",
                    mission: ""
                  }]
                })}
              >
                <Plus size={14} /> Add Subject charter
              </button>
            )}
            <div className="mission-section-title mission-history-title">
              <span><Clock3 size={16} /> MISSION LIBRARY</span>
              <b>{missions.length}</b>
            </div>
            <div className="mission-history">
              {missions.map((mission) => (
                <a href={mission.href} key={`${mission.kind}:${mission.id}`}>
                  <span>
                    <strong>{mission.name}</strong>
                    <small>
                      {mission.kind === "demo" ? "DEMO / IMMUTABLE" : "SAVED"}
                      {" / "}
                      {mission.status.toUpperCase()}
                    </small>
                  </span>
                  {mission.kind === "demo" ? <LockKeyhole size={15} /> : <ChevronRight size={15} />}
                </a>
              ))}
              {!missions.length && <p className="mission-empty">No Missions available.</p>}
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
