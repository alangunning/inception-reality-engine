export const DEMO_VIDEO_SCENARIOS = {
  "password-reset": {
    title: "Password Reset Demo Mission",
    durationMs: 178_000,
    route: { kind: "password-reset" },
    exportPath: "examples/run-exports/password-reset-real-mission-history-2026-07-20.json",
    outputDirectory: "docs/demo/password-reset",
    voiceCues: [
      {
        id: "PR-01",
        startMs: 0,
        endMs: 18_000,
        text: "In the film Inception, an idea planted deep inside nested dreams can survive every return to reality. Coding agents have the same failure mode: one unsupported assumption can propagate through plans, tests, and code. Reality Engine makes that risk visible and enforceable."
      },
      {
        id: "PR-02",
        startMs: 18_000,
        endMs: 38_000,
        text: "The protected repository is Reality, marked ROOT. Each Dream is a counterfactual world with its own premise, persistent Codex thread, and isolated Git worktree. Rewinding the validated timeline shows that no Dream exists until Codex finds an uncertainty worth experiencing."
      },
      {
        id: "PR-03",
        startMs: 38_000,
        endMs: 56_000,
        text: "This is a preserved real run, not generated demo data. The event inspector records GPT-5.6-sol, Codex SDK execution, CLI authentication, the persisted Reality thread, and its worktree. It exposes concise evidence and identifiers, never hidden model reasoning."
      },
      {
        id: "PR-04",
        startMs: 56_000,
        endMs: 76_000,
        text: "The initial belief says per-IP limiting prevents password-reset abuse. Codex discovers two gaps: rotating sources can repeatedly target one identifier, and public responses can reveal whether an account exists. Instead of editing Reality, the engine creates an isolated coordinated-attack Dream."
      },
      {
        id: "PR-05",
        startMs: 76_000,
        endMs: 98_000,
        text: "Seven native Subject returns audit implementation, proof, attack behavior, and tests. Their evidence creates two sibling Nested Dreams. One tests transactional SQLite contention and crash recovery. The other asks whether an attacker can spread a campaign across independent identifiers."
      },
      {
        id: "PR-06",
        startMs: 98_000,
        endMs: 123_000,
        text: "Now the deliberate inception attempt: Mal enters the campaign Dream under a sealed two-line contract and plants an off-by-one boundary fault. An investigator who is not told what changed identifies the exact file and symptom. At the Kick, the Totem Check compares that diagnosis with the real Git mutation."
      },
      {
        id: "PR-07",
        startMs: 123_000,
        endMs: 143_000,
        text: "The planted change is rolled back before Memory can ascend. No injected file enters Reality, but the independently discovered regression evidence is admitted. Three structured Wake Reports show the initial belief, lived evidence, changed belief, safe artefacts, and remaining uncertainty."
      },
      {
        id: "PR-08",
        startMs: 143_000,
        endMs: 166_000,
        text: "Only verified Memory is synthesised. Before, rotating sources deliver twelve resets out of twelve. After, an atomic shared identifier budget delivers three, known and unknown accounts receive the same public payload, all nine regression tests pass, and all four parent-owned Anchors survive. The final diff is the proof-backed implementation."
      },
      {
        id: "PR-09",
        startMs: 166_000,
        endMs: 178_000,
        text: "Mission Control applies the same engine to any trusted repository. Codex can explore at full power inside Dreams; useful discoveries return, while planted changes never become Reality."
      }
    ],
    actions: [
      { atMs: 0, label: "Open on the stabilised outcome", kind: "scroll-top" },
      { atMs: 18_000, label: "Rewind to the ROOT Reality", kind: "timeline-event", match: { type: "reality.created" }, scrollTo: "#reality-topology" },
      { atMs: 30_000, label: "Reveal the first Dream edge", kind: "timeline-event", match: { type: "dream.created", summaryIncludes: "atomic shared identifier budget" }, scrollTo: "#reality-topology" },
      { atMs: 38_000, label: "Open the real GPT-5.6 execution evidence", kind: "timeline-event", match: { type: "codex.progress", metadataStage: "model" } },
      { atMs: 40_000, label: "Inspect the selected model milestone", kind: "inspect-timeline" },
      { atMs: 54_000, label: "Close execution evidence", kind: "close-event" },
      { atMs: 56_000, label: "Show the surfaced password-reset uncertainty", kind: "timeline-event", match: { type: "uncertainty.discovered", summaryIncludes: "atomic identifier budget" }, scrollTo: "#reality-investigation" },
      { atMs: 76_000, label: "Show the parent Dream and its Subjects", kind: "timeline-event", match: { type: "subject.started", summaryIncludes: "Ariadne" }, scrollTo: "#reality-topology" },
      { atMs: 80_000, label: "Inspect one native Subject thread", kind: "inspect-timeline" },
      { atMs: 94_000, label: "Close Subject evidence", kind: "close-event" },
      { atMs: 96_000, label: "Reveal both sibling Nested Dreams", kind: "timeline-event", match: { type: "dream.created", summaryIncludes: "Independent-identifier campaign" }, scrollTo: "#reality-topology" },
      { atMs: 101_000, label: "Show Mal entering under the sealed contract", kind: "timeline-event", match: { type: "subject.started", summaryIncludes: "Mal" }, scrollTo: "#reality-integrity" },
      { atMs: 111_000, label: "Show the intervention sealed in one file", kind: "timeline-event", match: { type: "intervention.sealed" }, scrollTo: "#reality-integrity" },
      { atMs: 121_000, label: "Show exact detection and containment", kind: "timeline-event", match: { type: "intervention.contained" }, scrollTo: "#reality-integrity" },
      { atMs: 127_000, label: "Show the three returned Memory reports", kind: "timeline-event", match: { type: "memory.returned", summaryIncludes: "coordinated-attack" }, scrollTo: "#reality-memories" },
      { atMs: 143_000, label: "Return to the stabilised outcome", kind: "timeline-event", match: { type: "reality.stabilised" } },
      { atMs: 148_000, label: "Show four passing Anchor proofs", kind: "scroll", selector: "#reality-requirements" },
      { atMs: 157_000, label: "Reveal the final proof-backed Git diff", kind: "scroll", selector: "#reality-diff" },
      { atMs: 159_000, label: "Reveal code", kind: "reveal-code" },
      { atMs: 166_000, label: "Cut to Mission Control", kind: "mission-control" },
      { atMs: 174_000, label: "Return to the stabilised Reality", kind: "return-to-run" }
    ]
  },
  vampi: {
    title: "VAmPI Generalized Mission",
    durationMs: 178_000,
    route: { kind: "saved-mission", name: "VAmPI Ownership Regression" },
    exportPath: "examples/run-exports/vampi-real-mission-history-2026-07-20.json",
    outputDirectory: "docs/demo/vampi",
    voiceCues: [
      {
        id: "VA-01",
        startMs: 0,
        endMs: 17_000,
        text: "Coding agents usually explore and edit one shared reality. A persuasive mistake made deep in that process can become an accepted requirement. Reality Engine lets Codex dream first, then requires evidence before anything can return to the protected repository, rather than asking one context to grade its own work."
      },
      {
        id: "VA-02",
        startMs: 17_000,
        endMs: 38_000,
        text: "This completed graph is a real authorized review of the local VAmPI educational fixture: fifteen isolated Realities, fourteen Dreams, and three levels deep. Every node owns a premise, persistent Codex thread, Git worktree, inherited requirements, evidence, and history. The topology makes every branch and Subject auditable."
      },
      {
        id: "VA-03",
        startMs: 38_000,
        endMs: 57_000,
        text: "The replay begins at ROOT and proves the runtime, not just the diagram. The inspector records GPT-5.6-sol, the Codex SDK, CLI authentication, persisted thread identifiers, and isolated worktrees. Raw reasoning is neither persisted nor displayed."
      },
      {
        id: "VA-04",
        startMs: 57_000,
        endMs: 78_000,
        text: "The Mission asks whether VAmPI really enforces book ownership and administrator-only deletion. Codex does not patch the root immediately. It creates competing Dreams for handler boundaries, model boundaries, framework-backed integration, mutation sensitivity, and fail-closed identity behavior. No child can mutate its parent's Anchors."
      },
      {
        id: "VA-05",
        startMs: 78_000,
        endMs: 103_000,
        text: "Forty-four native Subjects enter those worlds as investigators, boundary reviewers, and negative-test engineers. Their child threads produce one hundred fifteen evidence records. The expanding graph shows sibling Dreams inside sibling Dreams, while every parent remains isolated from changes below it."
      },
      {
        id: "VA-06",
        startMs: 103_000,
        endMs: 124_000,
        text: "Mal also enters under a bounded, sealed intervention contract and plants one authorization fault. Independent Subjects identify it without seeing the mutation ledger. The Totem Check reveals the match, restores the baseline, and prevents the injected path from crossing the Kick."
      },
      {
        id: "VA-07",
        startMs: 124_000,
        endMs: 144_000,
        text: "Fourteen verified Memories ascend level by level. Seven Reality Mirrors compare sibling evidence, admit only shared invariants, and keep disagreements visible. Disagreement remains uncertainty, not artificial consensus. This is the difference from simply asking many agents: conclusions need provenance and must survive competing worlds."
      },
      {
        id: "VA-08",
        startMs: 144_000,
        endMs: 166_000,
        text: "The final Reality records seven changed files. Its judge-facing diff shows four product and test files because engine-owned controls are excluded. It removes the unscoped secret lookup, enforces owner-qualified access, fails closed on missing identities, preserves administrator deletion, and adds twelve service-free authorization tests. The immutable proof passes, so Reality stabilises."
      },
      {
        id: "VA-09",
        startMs: 166_000,
        endMs: 178_000,
        text: "Mission Control can apply this counterfactual runtime to any trusted repository. Good code and knowledge return; unsupported or planted Memory does not. Codex dreams before it changes Reality."
      }
    ],
    actions: [
      { atMs: 0, label: "Open on the completed VAmPI outcome", kind: "scroll-top" },
      { atMs: 17_000, label: "Show all fifteen Reality nodes", kind: "scroll", selector: "#reality-topology" },
      { atMs: 22_000, label: "Pan across the complete Reality topology", kind: "pan-graph", position: "end" },
      { atMs: 28_000, label: "Rewind the graph to ROOT", kind: "timeline-event", match: { type: "reality.created" }, scrollTo: "#reality-topology" },
      { atMs: 38_000, label: "Open the real GPT-5.6 execution evidence", kind: "timeline-event", match: { type: "codex.progress", metadataStage: "model" } },
      { atMs: 40_000, label: "Inspect the selected model milestone", kind: "inspect-timeline" },
      { atMs: 54_000, label: "Close execution evidence", kind: "close-event" },
      { atMs: 57_000, label: "Create the first ownership-boundary Dream", kind: "timeline-event", match: { type: "dream.created", summaryIncludes: "book handler boundary" }, scrollTo: "#reality-topology" },
      { atMs: 69_000, label: "Reveal the Branch-only counterfactual", kind: "timeline-event", match: { type: "dream.created", summaryIncludes: "Branch-only counterfactual" }, scrollTo: "#reality-topology" },
      { atMs: 78_000, label: "Show Mal as a native Subject", kind: "timeline-event", match: { type: "subject.started", summaryIncludes: "Mal" }, scrollTo: "#reality-topology" },
      { atMs: 81_000, label: "Inspect Mal's native Subject thread", kind: "inspect-timeline" },
      { atMs: 94_000, label: "Close Subject evidence", kind: "close-event" },
      { atMs: 96_000, label: "Expand replay to the complete depth-three graph and its Subjects", kind: "timeline-event", match: { type: "subject.started", summaryIncludes: "Eames", occurrence: "last" }, scrollTo: "#reality-topology" },
      { atMs: 98_000, label: "Pan to the Level 3 Dreams and their Subjects", kind: "pan-graph", position: "end" },
      { atMs: 103_000, label: "Show the planted fault contained", kind: "timeline-event", match: { type: "intervention.contained" }, scrollTo: "#reality-integrity" },
      { atMs: 124_000, label: "Show late-stage Memory ascent", kind: "timeline-event", match: { type: "memory.returned", summaryIncludes: "Encode owned-book lookup" }, scrollTo: "#reality-memory-ascent" },
      { atMs: 133_000, label: "Show the final sibling Reality Mirror", kind: "timeline-event", match: { type: "reflection.created", occurrence: "last" }, scrollTo: "#reality-reflection" },
      { atMs: 144_000, label: "Return to the stabilised outcome", kind: "timeline-event", match: { type: "reality.stabilised" } },
      { atMs: 150_000, label: "Show the immutable authorization proof", kind: "scroll", selector: "#reality-requirements" },
      { atMs: 157_000, label: "Reveal the final four-file judge-facing Git diff", kind: "scroll", selector: "#reality-diff" },
      { atMs: 159_000, label: "Reveal code", kind: "reveal-code" },
      { atMs: 166_000, label: "Cut to Mission Control", kind: "mission-control" },
      { atMs: 174_000, label: "Return to the stabilised VAmPI Reality", kind: "return-to-run" }
    ]
  }
};

export function splitSubtitleText(text) {
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

export function wrapSubtitle(text, width = 42) {
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

export function subtitleEntries(scenario) {
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
  return entries;
}

export function eventMetadata(event) {
  const payloadMetadata = event?.payload?.metadata;
  if (payloadMetadata && typeof payloadMetadata === "object") return payloadMetadata;
  const metadata = event?.metadata;
  return metadata && typeof metadata === "object" ? metadata : {};
}

export function isTimelineMilestone(event) {
  if (event.type === "codex.progress") {
    const stage = eventMetadata(event).stage;
    return stage === "model" || stage === "thread";
  }
  return event.type !== "anchor.started";
}

export function exportedEvents(document) {
  return document.snapshot?.run?.events ?? document.events ?? [];
}

export function matchingEvent(events, match) {
  const matches = events.filter((event) => {
    if (match.type && event.type !== match.type) return false;
    if (match.summaryIncludes && !event.summary?.includes(match.summaryIncludes)) return false;
    if (match.metadataStage && eventMetadata(event).stage !== match.metadataStage) return false;
    return true;
  });
  return match.occurrence === "last" ? matches.at(-1) : matches[0];
}
