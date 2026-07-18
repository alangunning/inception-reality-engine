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
  FileDiff,
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
}

const initialState: ComposerState = {
  name: "Dependency Boundary",
  repositoryPath: "",
  mission: "Make dependency loading resilient when the primary package registry is partially unavailable.",
  scope: "Package resolution and registry fallback behavior",
  premise: "The fallback registry always preserves package integrity and freshness during a partial outage.",
  constraints: "Preserve public behavior unless evidence proves a change is required.\nDo not weaken signature or integrity verification.\nPrefer executable evidence over speculation.",
  parentTruths: "Existing callers remain compatible.\nResolved packages must pass integrity verification.",
  proofName: "Repository test suite",
  proofExecutable: "npm",
  proofArgs: "test",
  tokenBudget: 120_000,
  maxDreamDepth: 2
};

const subjectCharters = [
  {
    name: "Ariadne",
    role: "Investigator",
    mission: "Map the implementation boundary, assumptions, and concrete evidence."
  },
  {
    name: "Saito",
    role: "Skeptic",
    mission: "Challenge the leading belief with an independent counterexample."
  },
  {
    name: "Eames",
    role: "Test engineer",
    mission: "Create the smallest decisive executable proof."
  }
];

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
          {snapshot.nextAction?.id === "create_dream" ? <MoonStar size={17} /> : <Play size={17} />}
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

  const loadIndex = useCallback(async () => {
    const response = await fetch("/api/missions", { cache: "no-store" });
    const body = await readJson<{
      runs?: MissionSummary[];
      runtime?: RuntimeInfo;
      enabled?: boolean;
      defaultRepositoryPath?: string;
      error?: string;
    }>(response, "Could not load Mission Composer.");
    if (!response.ok || !body.runtime) throw new Error(body.error ?? "Could not load Mission Composer.");
    setRuntime(body.runtime);
    setRuns(body.runs ?? []);
    if (body.defaultRepositoryPath) {
      setComposer((current) => current.repositoryPath
        ? current
        : { ...current, repositoryPath: body.defaultRepositoryPath! });
    }
  }, []);

  useEffect(() => {
    void loadIndex().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [loadIndex]);

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
    const requiredFields = [
      ["Reality name", composer.name],
      ["Local Git repository", composer.repositoryPath],
      ["Mission", composer.mission],
      ["Scope", composer.scope],
      ["Initial belief to challenge", composer.premise],
      ["Constitution constraints", composer.constraints],
      ["Proof name", composer.proofName],
      ["Proof executable", composer.proofExecutable]
    ] as const;
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
                  <button type="button" className={composer.maxDreamDepth === depth ? "is-selected" : ""} onClick={() => setComposer({ ...composer, maxDreamDepth: depth })} key={depth}>
                    {depth}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className="mission-form-submit"
              disabled={busy || runtime?.mode !== "real"}
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
