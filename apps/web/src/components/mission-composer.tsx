"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  ExternalLink,
  FileDiff,
  Fingerprint,
  FolderGit2,
  GitBranch,
  Layers3,
  LockKeyhole,
  MoonStar,
  Network,
  Play,
  Radio,
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
import type {
  MissionAction,
  MissionSnapshot
} from "@inception/orchestrator";

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
  name: "VAmPI Authorization Breach",
  repositoryPath: "",
  mission: "Penetration-test VAmPI's book-secret and user-management authorization boundaries. Reproduce the highest-impact cross-user flaw using only local bundled data, return an executable regression test at tests/test_authorization_regression.py, and synthesise the smallest remediation that preserves the API contract.",
  scope: "VAmPI Flask API authorization for users, books, and secret content",
  premise: "A valid token prevents one ordinary user from reading or changing another user's private resources.",
  constraints: "Work only inside the deliberately vulnerable local VAmPI clone.\nSend test traffic only to localhost and use bundled or synthetic data.\nDo not use real credentials, accounts, or external systems.\nPreserve the documented OpenAPI shape unless evidence requires a compatible correction.\nReturn reproducible exploit evidence without exposing hidden model reasoning.",
  parentTruths: "This target is intentionally vulnerable and authorized for local security training.\nPrivate book secrets require owner authorization.\nOnly administrators may delete users.\nEvery security conclusion must cite executable or source evidence.",
  proofName: "Authorization regression",
  proofExecutable: "python3",
  proofArgs: "tests/test_authorization_regression.py",
  tokenBudget: 160_000,
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
    role: "Authorization investigator",
    mission: "Trace identity, ownership, and privilege checks from the API boundary to persisted data."
  },
  {
    name: "Saito",
    role: "Red team operator",
    mission: "Attempt bounded cross-user attacks using only localhost, synthetic identities, and the authorized training target."
  },
  {
    name: "Eames",
    role: "Security test engineer",
    mission: "Turn the highest-impact finding into the smallest decisive executable regression test."
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

function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function eventMetadata(event: RealityEvent): Record<string, unknown> {
  const metadata = event.payload.metadata;
  return metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown>
    : {};
}

function eventDetail(event: RealityEvent): string | null {
  const metadata = eventMetadata(event);
  if (typeof metadata.subjectRole === "string") {
    const thread = typeof metadata.subjectThreadId === "string"
      ? ` / thread ${metadata.subjectThreadId.slice(0, 12)}`
      : "";
    return `${metadata.subjectRole}${thread}`;
  }
  if (typeof metadata.command === "string") return metadata.command;
  if (typeof metadata.model === "string") {
    return `${metadata.model}${typeof metadata.sdkVersion === "string" ? ` / SDK ${metadata.sdkVersion}` : ""}`;
  }
  if (typeof metadata.diagnostic === "string") return metadata.diagnostic;
  return null;
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

function RealityTree({ run }: { run: MissionRun }) {
  return (
    <div className="mission-tree" data-testid="mission-reality-tree">
      {run.realities.map((reality, index) => (
        <div className="mission-node-wrap" key={reality.id}>
          {index > 0 && <ChevronRight size={17} className="mission-tree-arrow" />}
          <article className={`mission-node ${run.activeRealityId === reality.id ? "is-active" : ""} ${reality.status === "kicked" ? "is-returned" : ""}`}>
            <span>{reality.kind === "dream" ? <MoonStar size={14} /> : <CircleDot size={14} />}</span>
            <div>
              <small>DEPTH {reality.depth} / {reality.kind.toUpperCase()}</small>
              <strong>{reality.name}</strong>
              <em>{reality.status === "kicked" ? "Memory returned" : reality.worldState.status}</em>
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}

function MissionRunView({
  snapshot,
  runtime,
  onReload,
  onDeleted
}: {
  snapshot: MissionSnapshot;
  runtime: RuntimeInfo;
  onReload(snapshot: MissionSnapshot): void;
  onDeleted(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const usedTokens = useMemo(() => run.events.reduce((total, event) => {
    const metadata = eventMetadata(event);
    return total
      + (typeof metadata.inputTokens === "number" ? metadata.inputTokens : 0)
      + (typeof metadata.outputTokens === "number" ? metadata.outputTokens : 0)
      + (typeof metadata.reasoningTokens === "number" ? metadata.reasoningTokens : 0);
  }, 0), [run.events]);

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
      const value = JSON.parse(event.data) as { type?: string };
      if (value.type !== "connected") void load();
    };
    return () => stream.close();
  }, [load, run.id]);

  useEffect(() => {
    if (!snapshot.operation && !busy) return;
    const poll = window.setInterval(() => void load(), 2_000);
    return () => window.clearInterval(poll);
  }, [busy, load, snapshot.operation]);

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

  const visibleEvents = [...run.events].reverse();
  return (
    <main className="mission-run">
      <section className="mission-run-header">
        <div>
          <span className="eyebrow">MISSION / {statusLabel(run.status)}</span>
          <h1>{run.definition.name}</h1>
          <p>{run.definition.mission}</p>
        </div>
        <dl>
          <div><dt>MODEL</dt><dd>{runtime.model}</dd></div>
          <div><dt>TOKEN EVIDENCE</dt><dd>{usedTokens.toLocaleString()} / {run.definition.tokenBudget.toLocaleString()}</dd></div>
          <div><dt>DEPTH BUDGET</dt><dd>{Math.max(...run.realities.map((entry) => entry.depth))} / {run.definition.maxDreamDepth}</dd></div>
        </dl>
      </section>

      <section className="mission-tree-band">
        <div className="mission-section-title">
          <span><Network size={16} /> REALITY TREE</span>
          <b>{run.realities.length} WORLDS / {run.memories.length} MEMORIES</b>
        </div>
        <RealityTree run={run} />
      </section>

      {error && (
        <div className="mission-error">
          <XCircle size={16} />
          <span><b>Reality fracture</b>{error}</span>
        </div>
      )}

      <div className="mission-action-dock">
        <div>
          <small>{snapshot.operation ? "CODEX OPERATION" : "NEXT REALITY ACTION"}</small>
          <strong>{snapshot.operation?.label ?? snapshot.nextAction?.label ?? "Reality stabilised"}</strong>
          {snapshot.operation && <span><Clock3 size={13} /> Began at {timeLabel(snapshot.operation.startedAt)}</span>}
        </div>
        <button
          type="button"
          disabled={busy || Boolean(snapshot.operation) || !snapshot.nextAction}
          onClick={() => snapshot.nextAction && void act(snapshot.nextAction.id)}
        >
          {snapshot.nextAction?.id === "create_dream"
            ? <MoonStar size={17} />
            : snapshot.nextAction?.id === "intervene"
              ? <ShieldAlert size={17} />
              : <Play size={17} />}
          {busy || snapshot.operation ? "Reality shifting" : snapshot.nextAction?.label ?? "Reality stabilised"}
        </button>
        <button type="button" className="mission-delete" onClick={remove} disabled={busy || Boolean(snapshot.operation)} title="Delete mission and clean up worktrees" aria-label="Delete mission and clean up worktrees">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mission-grid">
        <section className="mission-locus">
          <div className="mission-section-title">
            <span><Layers3 size={16} /> CURRENT REALITY</span>
            <b>DEPTH {reality.depth}</b>
          </div>
          <h2>{reality.name}</h2>
          <p className="mission-premise">{reality.premise}</p>
          <dl className="mission-world-state">
            <div><dt>STATE</dt><dd>{reality.worldState.status}</dd></div>
            <div><dt>FOCUS</dt><dd>{reality.worldState.currentFocus}</dd></div>
            <div><dt>DREAM TIME</dt><dd>{reality.worldState.simulatedMinutes} minutes</dd></div>
            <div><dt>THREAD</dt><dd>{reality.codexThreadId?.startsWith("unbound:") ? "Not started" : reality.codexThreadId?.slice(0, 18)}</dd></div>
          </dl>

          {intervention && interventionContract && (
            <div className="mission-subsection" data-testid="intervention-ledger">
              <h3><ShieldAlert size={15} /> Sealed intervention</h3>
              <article className={`mission-intervention intervention-${intervention.status}`}>
                <div className="mission-intervention-heading">
                  <span>
                    <strong>{adversarialSubject.name} / {adversarialSubject.role}</strong>
                    <small>{intervention.status.toUpperCase()} / REVEAL AFTER DIAGNOSIS</small>
                  </span>
                  <b>{interventionContract.maxChangedFiles} FILES / {interventionContract.maxPatchLines} LINES</b>
                </div>
                {intervention.status === "armed" && (
                  <p>No mutation has run. The operator-owned contract is armed for an explicit action.</p>
                )}
                {intervention.status === "sealed" && (
                  <p>{intervention.changedFileCount ?? 0} changed file{intervention.changedFileCount === 1 ? "" : "s"} sealed. Cause, paths, and private Subject report remain hidden until Kick.</p>
                )}
                {intervention.status === "rejected" && (
                  <p>{intervention.rejectionReason ?? "The mutation breached its contract and the Dream was restored."}</p>
                )}
                {intervention.diagnosis && intervention.status !== "revealed" && (
                  <p>Investigator diagnosis returned at {Math.round(intervention.diagnosis.confidence * 100)}% model-reported confidence. The exact comparison remains sealed until Kick.</p>
                )}
                {intervention.status === "revealed" && intervention.report && intervention.assessment && (
                  <>
                    <p>{intervention.report.summary}</p>
                    <dl>
                      <div><dt>OUTCOME</dt><dd>{intervention.assessment.outcome.toUpperCase()}</dd></div>
                      <div><dt>FAULT</dt><dd>{intervention.report.faultClass}</dd></div>
                      <div><dt>FILES</dt><dd>{intervention.report.changedFiles.join(", ")}</dd></div>
                    </dl>
                  </>
                )}
              </article>
            </div>
          )}

          <div className="mission-subsection" data-testid="memory-integrity">
            <h3><Fingerprint size={15} /> Reality totem / memory integrity</h3>
            {integritySeal ? (
              <article className={`mission-integrity integrity-${integritySeal.verdict}`}>
                <div className="mission-intervention-heading">
                  <span>
                    <strong>{integritySeal.verdict === "verified" ? "Memory verified" : "Memory quarantined"}</strong>
                    <small>{integritySeal.policyVersion.toUpperCase()} / {integritySeal.checks.filter((check) => check.status === "passed").length} OF {integritySeal.checks.length} CHECKS PASSED</small>
                  </span>
                  <b>{integritySeal.descendantSealIds.length} DESCENDANT SEALS</b>
                </div>
                <div className="mission-integrity-checks">
                  {integritySeal.checks.map((check) => (
                    <span className={`integrity-check is-${check.status}`} key={check.name} title={check.summary}>
                      {check.status === "passed" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {check.name.replaceAll("-", " ")}
                    </span>
                  ))}
                </div>
                <code>REPORT {integritySeal.reportDigest.slice(0, 16)} / STATE {integritySeal.sourceStateDigest.slice(0, 16)}</code>
              </article>
            ) : (
              <article className="mission-integrity integrity-pending">
                <div className="mission-intervention-heading">
                  <span>
                    <strong>Parent policy armed</strong>
                    <small>NO MEMORY HAS CROSSED A KICK</small>
                  </span>
                  <b>{reality.anchors.length} REALITY ANCHOR{reality.anchors.length === 1 ? "" : "S"}</b>
                </div>
              </article>
            )}
          </div>

          <div className="mission-subsection">
            <h3><UsersRound size={15} /> Subjects</h3>
            {reality.subjects.length ? (
              <div className="mission-subjects">
                {reality.subjects.map((subject) => {
                  const threadEvent = [...run.events].reverse().find((event) =>
                    eventMetadata(event).subjectId === subject.id
                  );
                  const metadata = threadEvent ? eventMetadata(threadEvent) : {};
                  return (
                    <article key={subject.id}>
                      <span className={`subject-state subject-${String(metadata.subjectState ?? subject.status)}`} />
                      <div>
                        <strong>{subject.name}</strong>
                        <small>{subject.role} / {String(metadata.subjectState ?? subject.status).toUpperCase()}</small>
                        {typeof metadata.subjectThreadId === "string" && (
                          <code>Codex thread {metadata.subjectThreadId}</code>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="mission-empty">Subjects enter child Realities.</p>}
          </div>

          <div className="mission-subsection">
            <h3><BrainCircuit size={15} /> Beliefs and uncertainty</h3>
            {reality.beliefs.slice(-3).map((belief) => (
              <article className="mission-belief" key={belief.id}>
                <span>{Math.round(belief.confidence * 100)}%</span>
                <p>{belief.statement}</p>
                <small>MODEL-REPORTED CONFIDENCE / {belief.origin.toUpperCase()}</small>
              </article>
            ))}
            {reality.proposals.filter((proposal) => proposal.status === "open").map((proposal) => (
              <article className="mission-proposal" key={proposal.id}>
                <small>OPEN DREAM PROPOSAL / MODEL ESTIMATE</small>
                <strong>{proposal.title}</strong>
                <p>{proposal.uncertainty}</p>
              </article>
            ))}
          </div>

          <div className="mission-subsection">
            <h3><Code2 size={15} /> Evidence</h3>
            <div className="mission-evidence">
              {reality.evidence.map((entry) => (
                <article key={entry.id}>
                  <small>{entry.kind.toUpperCase()} / {(entry.provenance ?? "UNSPECIFIED").toUpperCase()}</small>
                  <strong>{entry.title}</strong>
                  <p>{entry.summary}</p>
                  {entry.artefactPath && <code>{entry.artefactPath}</code>}
                </article>
              ))}
              {!reality.evidence.length && <p className="mission-empty">No evidence has returned.</p>}
            </div>
          </div>
        </section>

        <aside className="mission-events">
          <div className="mission-section-title">
            <span><Radio size={16} /> LIVE EVENTS</span>
            <b>{run.events.length} VALIDATED</b>
          </div>
          <div className="mission-event-list">
            {visibleEvents.map((event) => (
              <article key={event.id} className={`mission-event event-${event.type.split(".")[0]}`}>
                <time>{timeLabel(event.occurredAt)}</time>
                <div>
                  <small>{event.type.replace(".", " / ")}</small>
                  <strong>{event.summary}</strong>
                  {eventDetail(event) && <code>{eventDetail(event)}</code>}
                  <em>{run.realities.find((entry) => entry.id === event.realityId)?.name}</em>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <section className="mission-results">
        <div>
          <div className="mission-section-title">
            <span><LockKeyhole size={16} /> IMMUTABLE PROOFS</span>
            <b>{run.proofResults.filter((result) => result.status === "passed").length} / {run.definition.proofs.length} PASSED</b>
          </div>
          {run.definition.proofs.map((proof) => {
            const result = run.proofResults.find((entry) => entry.anchorId === proof.id);
            return (
              <article className="mission-proof" key={proof.id}>
                {result?.status === "passed" ? <CheckCircle2 size={16} /> : <LockKeyhole size={16} />}
                <span>
                  <strong>{proof.name}</strong>
                  <code>{proof.executable} {proof.args.join(" ")}</code>
                </span>
                <b>{result ? result.status.toUpperCase() : "UNVERIFIED"}</b>
              </article>
            );
          })}
        </div>
        <div>
          <div className="mission-section-title">
            <span><FileDiff size={16} /> WAKING DIFF</span>
            <b>{run.finalDiff ? `${run.finalDiff.split("\n").length} LINES` : "NOT SYNTHESISED"}</b>
          </div>
          <pre className="mission-diff">{run.finalDiff || "The waking worktree has not received returned memory."}</pre>
        </div>
      </section>

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

  const openRun = async (id: string) => {
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
  };

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
        <nav className="mission-nav">
          <a href="/"><ArrowLeft size={15} /> Canonical demo</a>
          <span><BrainCircuit size={14} /> {runtime.model.toUpperCase()} / CODEX SDK {runtime.sdkVersion}</span>
        </nav>
        <MissionRunView
          snapshot={snapshot}
          runtime={runtime}
          onReload={setSnapshot}
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
      <nav className="mission-nav">
        <a href="/"><ArrowLeft size={15} /> Canonical demo</a>
        <span><BrainCircuit size={14} /> {runtime?.model.toUpperCase() ?? "REAL CODEX REQUIRED"}</span>
      </nav>
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
        {runtime?.mode !== "real" && (
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
              <span>Token evidence limit</span>
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
    </div>
  );
}
