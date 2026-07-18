"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Reality, RealityEvent } from "@inception/domain";
import type { DemoAction, DemoSnapshot } from "@inception/orchestrator";

type LoadingState = "idle" | "acting" | "resetting";

const graphPositions: Record<number, { x: number; y: number; left: string; top: string }> = {
  0: { x: 165, y: 210, left: "4%", top: "39%" },
  1: { x: 500, y: 120, left: "37%", top: "15%" },
  2: { x: 820, y: 250, left: "68%", top: "50%" }
};

function statusLabel(status: Reality["status"]): string {
  const labels: Record<Reality["status"], string> = {
    forming: "Forming",
    exploring: "Exploring",
    waking: "Waking",
    kicked: "Memory returned",
    stabilised: "Stabilised"
  };
  return labels[status];
}

function formatThread(threadId?: string): string {
  if (!threadId || threadId.startsWith("unbound:")) return "Thread not entered";
  return threadId.length > 24 ? `${threadId.slice(0, 12)}…${threadId.slice(-6)}` : threadId;
}

function RealityGraph({ realities, activeRealityId, pulseRealityId }: {
  realities: Reality[];
  activeRealityId: string | null;
  pulseRealityId: string | null;
}) {
  return (
    <div className="graph-shell">
      <div className="graph-grid" />
      <div className="depth-label depth-0">WAKING</div>
      <div className="depth-label depth-1">DREAM · 1</div>
      <div className="depth-label depth-2">DREAM · 2</div>
      <svg className="graph-links" viewBox="0 0 1000 390" preserveAspectRatio="none" aria-hidden="true">
        {realities.map((reality) => {
          if (!reality.parentId) return null;
          const parent = realities.find((entry) => entry.id === reality.parentId);
          if (!parent) return null;
          const from = graphPositions[parent.depth];
          const to = graphPositions[reality.depth];
          if (!from || !to) return null;
          return (
            <g key={`${parent.id}-${reality.id}`}>
              <path
                className="reality-link-shadow"
                d={`M ${from.x + 80} ${from.y} C ${from.x + 180} ${from.y}, ${to.x - 160} ${to.y}, ${to.x - 70} ${to.y}`}
              />
              <path
                className="reality-link"
                d={`M ${from.x + 80} ${from.y} C ${from.x + 180} ${from.y}, ${to.x - 160} ${to.y}, ${to.x - 70} ${to.y}`}
              />
              <circle cx={to.x - 72} cy={to.y} r="4" className="memory-dot" />
            </g>
          );
        })}
      </svg>

      {realities.map((reality) => {
        const position = graphPositions[reality.depth] ?? graphPositions[2]!;
        const active = reality.id === activeRealityId;
        const pulsing = reality.id === pulseRealityId;
        return (
          <article
            key={reality.id}
            className={`reality-node depth-node-${reality.depth} ${active ? "active" : ""} ${pulsing ? "wake-pulse" : ""}`}
            style={{ left: position.left, top: position.top }}
          >
            <div className="node-rings" aria-hidden="true"><i /><i /><i /></div>
            <div className="node-topline">
              <span className="node-depth">L{reality.depth}</span>
              <span className={`status-dot status-${reality.status}`} />
              <span>{statusLabel(reality.status)}</span>
            </div>
            <h3>{reality.name}</h3>
            <p>{reality.worldState.currentFocus}</p>
            <div className="node-meta">
              <span>⧖ {reality.worldState.simulatedMinutes}m</span>
              <span>{reality.evidence.length} evidence</span>
            </div>
          </article>
        );
      })}

      {pulseRealityId && <div className="wake-wave" aria-hidden="true" />}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

function EventFeed({ events }: { events: RealityEvent[] }) {
  const visible = events.slice(-8).reverse();
  return (
    <div className="event-feed">
      {visible.map((event) => (
        <div className="event-row" key={event.id}>
          <span className={`event-glyph event-${event.type.split(".")[0]}`} />
          <div>
            <strong>{event.summary}</strong>
            <small>T+{event.dreamTime}m · {event.type.replaceAll(".", " / ")}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionControls({ snapshot, loading, onAction, onReset }: {
  snapshot: DemoSnapshot;
  loading: LoadingState;
  onAction: (action: DemoAction) => void;
  onReset: () => void;
}) {
  const next = snapshot.nextAction;
  const busy = loading !== "idle";
  const progress = Math.min(100, snapshot.session.phase * 10);
  return (
    <div className="action-dock">
      <div className="phase-progress">
        <span>Reality coherence</span>
        <strong>{progress}%</strong>
        <div><i style={{ width: `${progress}%` }} /></div>
      </div>
      <button className="secondary-button" onClick={onReset} disabled={busy}>↺ Reset</button>
      <button
        className="dream-button"
        onClick={() => next && onAction(next.id)}
        disabled={busy || next?.kind !== "dream"}
        title={next?.kind === "dream" ? next.label : "No unresolved uncertainty requires a child Reality"}
      >
        <span className="button-orbit">◉</span> Dream
      </button>
      <button
        className="kick-button"
        onClick={() => next && onAction(next.id)}
        disabled={busy || next?.kind !== "kick"}
        title={next?.kind === "kick" ? next.label : "The current Reality is not ready to wake"}
      >
        <span>↟</span> Kick
      </button>
      <button
        className="primary-button"
        onClick={() => next && onAction(next.id)}
        disabled={busy || !next || next.kind === "dream" || next.kind === "kick"}
      >
        {busy ? "Reality shifting…" : next?.label ?? "Reality stabilised"}
      </button>
    </div>
  );
}

export function RealityEngine() {
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pulseRealityId, setPulseRealityId] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    const response = await fetch("/api/demo", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not enter the Reality Engine.");
    setSnapshot(body);
  }, []);

  useEffect(() => {
    loadSnapshot().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const source = new EventSource("/api/events");
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as RealityEvent | { type: string };
      if ("realityId" in event && ["kick.triggered", "memory.returned", "reality.stabilised"].includes(event.type)) {
        setPulseRealityId(event.realityId);
        window.setTimeout(() => setPulseRealityId(null), 1500);
      }
      loadSnapshot().catch(() => undefined);
    };
    return () => source.close();
  }, [loadSnapshot]);

  const act = async (action: DemoAction) => {
    setLoading("acting");
    setError(null);
    try {
      const response = await fetch("/api/demo/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The Reality rejected that action.");
      setSnapshot(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading("idle");
    }
  };

  const reset = async () => {
    setLoading("resetting");
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The Reality could not be reset.");
      setSnapshot(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading("idle");
    }
  };

  const root = snapshot?.realities.find((reality) => reality.depth === 0) ?? null;
  const current = snapshot?.activeReality ?? null;
  const allProposals = useMemo(() => snapshot?.realities.flatMap((reality) => reality.proposals.map((proposal) => ({ ...proposal, owner: reality.name }))) ?? [], [snapshot]);
  const wakeReports = useMemo(() => snapshot?.realities.flatMap((reality) => reality.wakeReport ? [{ reality, report: reality.wakeReport }] : []) ?? [], [snapshot]);
  const initialBelief = root?.beliefs.find((belief) => belief.origin === "initial") ?? root?.beliefs[0];
  const finalBelief = root?.beliefs.at(-1);

  if (!snapshot || !current) {
    return (
      <main className="loading-screen">
        <div className="loading-rings"><i /><i /><i /></div>
        <h1>Entering Inception</h1>
        <p>{error ?? "Forming the waking Reality and its immutable anchors…"}</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><i /><i /><b>∞</b></div>
          <div>
            <span>INCEPTION</span>
            <small>REALITY ENGINE</small>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="live-indicator"><i /> LIVE MEMORY STREAM</span>
          <span>MODE · {process.env.NEXT_PUBLIC_INCEPTION_MODE ?? "DETERMINISTIC"}</span>
          <span>REALITIES · {snapshot.realities.length}</span>
        </div>
      </header>

      {error && <div className="error-banner">Reality fracture: {error}</div>}

      <section className="hero-grid">
        <section className="panel graph-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REALITY TOPOLOGY</span>
              <h1>Nested counterfactual worlds</h1>
            </div>
            <div className="active-world-chip">
              <span>Current Reality</span>
              <strong>{current.name}</strong>
            </div>
          </div>
          <RealityGraph realities={snapshot.realities} activeRealityId={snapshot.session.activeRealityId} pulseRealityId={pulseRealityId} />
          <div className="graph-legend">
            <span><i className="legend-waking" /> Waking world</span>
            <span><i className="legend-dream" /> Child Reality</span>
            <span><i className="legend-memory" /> Returned memory</span>
          </div>
        </section>

        <aside className="panel current-panel">
          <div className="panel-heading compact">
            <div>
              <span className="eyebrow">CURRENT REALITY · L{current.depth}</span>
              <h2>{current.name}</h2>
            </div>
            <span className={`reality-state state-${current.status}`}>{statusLabel(current.status)}</span>
          </div>
          <div className="dream-time">
            <div><span>SIMULATED DREAM-TIME</span><strong>{current.worldState.simulatedMinutes}</strong><em>minutes</em></div>
            <div className="time-rings"><i /><i /><i /></div>
          </div>
          <div className="detail-block">
            <span>PREMISE</span>
            <p>{current.premise}</p>
          </div>
          <div className="detail-block">
            <span>CONSTITUTION</span>
            <p className="mission">{current.constitution.mission}</p>
            <ul>{current.constitution.constraints.slice(0, 3).map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
          </div>
          <div className="runtime-strip">
            <span><small>CODEX THREAD</small>{formatThread(current.codexThreadId)}</span>
            <span><small>WORKTREE</small>{current.branchName ?? "Preparing isolation"}</span>
          </div>
        </aside>
      </section>

      <section className="middle-grid">
        <section className="panel uncertainty-panel">
          <div className="panel-heading compact">
            <div><span className="eyebrow">UNRESOLVED COUNTERFACTUALS</span><h2>Dream proposals</h2></div>
            <span className="count-badge">{allProposals.filter((proposal) => proposal.status !== "resolved").length}</span>
          </div>
          <div className="card-stack">
            {allProposals.length ? allProposals.map((proposal) => (
              <article className={`uncertainty-card proposal-${proposal.status}`} key={proposal.id}>
                <div><span>{proposal.owner}</span><b>{proposal.status}</b></div>
                <h3>{proposal.uncertainty}</h3>
                <p>{proposal.rationale}</p>
                <small>{proposal.title}</small>
              </article>
            )) : <EmptyState>No uncertainty has been made concrete yet.</EmptyState>}
          </div>
        </section>

        <section className="panel subjects-panel">
          <div className="panel-heading compact">
            <div><span className="eyebrow">BOUNDED INVESTIGATION</span><h2>Subjects</h2></div>
            <span className="count-badge">{current.subjects.length}</span>
          </div>
          <div className="subject-list">
            {current.subjects.length ? current.subjects.map((subject) => (
              <article className="subject-card" key={subject.id}>
                <div className="subject-avatar">{subject.name.slice(0, 1)}</div>
                <div><h3>{subject.name}</h3><span>{subject.role}</span><p>{subject.findings[0] ?? subject.mission}</p></div>
                <b className={`subject-status subject-${subject.status}`}>{subject.status}</b>
              </article>
            )) : <EmptyState>Subjects enter only for bounded, independent work inside one Dream.</EmptyState>}
          </div>
        </section>

        <section className="panel evidence-panel">
          <div className="panel-heading compact">
            <div><span className="eyebrow">WORLD EXPERIENCE</span><h2>Evidence</h2></div>
            <span className="count-badge">{current.evidence.length}</span>
          </div>
          <div className="evidence-list">
            {current.evidence.length ? current.evidence.slice(-5).reverse().map((evidence) => (
              <article key={evidence.id}>
                <span className={`evidence-kind kind-${evidence.kind}`}>{evidence.kind}</span>
                <div><h3>{evidence.title}</h3><p>{evidence.summary}</p><small>{evidence.source}</small></div>
              </article>
            )) : <EmptyState>This world has not experienced decisive evidence yet.</EmptyState>}
          </div>
        </section>
      </section>

      <section className="bottom-grid">
        <section className="panel memories-panel">
          <div className="panel-heading compact">
            <div><span className="eyebrow">MEMORIES</span><h2>Belief transformation</h2></div>
            <span className="memory-count">{wakeReports.length} returned</span>
          </div>
          <div className="belief-comparison">
            <article className="belief-before">
              <span>INITIAL BELIEF</span>
              <p>{initialBelief?.statement ?? "No initial belief recorded."}</p>
              <div><i style={{ width: `${(initialBelief?.confidence ?? 0) * 100}%` }} /><b>{Math.round((initialBelief?.confidence ?? 0) * 100)}%</b></div>
            </article>
            <div className="belief-arrow"><span>MEMORIES</span>⟶</div>
            <article className="belief-after">
              <span>STABILISED BELIEF</span>
              <p>{finalBelief?.statement ?? "Awaiting returned memory."}</p>
              <div><i style={{ width: `${(finalBelief?.confidence ?? 0) * 100}%` }} /><b>{Math.round((finalBelief?.confidence ?? 0) * 100)}%</b></div>
            </article>
          </div>
          <div className="memory-capsules">
            {wakeReports.map(({ reality, report }) => (
              <article key={reality.id}>
                <span>L{reality.depth} MEMORY</span>
                <h3>{reality.name}</h3>
                <p>{report.recommendation}</p>
                <small>{report.artefacts.length} artefact · {report.invariants.length} invariants · {report.remainingUncertainty.length} uncertainty</small>
              </article>
            ))}
            {!wakeReports.length && <EmptyState>Kick a Dream to return a validated Wake Report.</EmptyState>}
          </div>
        </section>

        <section className="panel events-panel">
          <div className="panel-heading compact">
            <div><span className="eyebrow">LIVE REALITY EVENTS</span><h2>Experience stream</h2></div>
            <span className="live-dot" />
          </div>
          <EventFeed events={snapshot.events} />
        </section>
      </section>

      {(snapshot.session.anchorResults.length > 0 || snapshot.session.finalDiff) && (
        <section className="result-grid">
          <section className="panel anchor-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">REALITY ANCHORS</span><h2>Immutable test results</h2></div></div>
            <div className="anchor-list">
              {snapshot.session.anchorResults.map((anchor) => (
                <article key={anchor.anchorId} className={`anchor-${anchor.status}`}>
                  <span>{anchor.status === "passed" ? "✓" : "×"}</span>
                  <div><h3>{anchor.name}</h3><p>{anchor.status === "passed" ? "Parent-owned invariant survived synthesis." : "Reality diverged from an immutable requirement."}</p></div>
                </article>
              ))}
            </div>
          </section>
          <section className="panel diff-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">FINAL GIT DIFF</span><h2>Waking implementation</h2></div><span className="diff-badge">WORKTREE</span></div>
            <pre>{snapshot.session.finalDiff || "Diff appears after memory synthesis."}</pre>
          </section>
        </section>
      )}

      <ActionControls snapshot={snapshot} loading={loading} onAction={act} onReset={reset} />
    </main>
  );
}
