import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  AdversarialInterventionLedger,
  AnchorResult,
  DreamReflection,
  MemoryIntegritySeal,
  MissionOutcome,
  Reality,
  RealityEvent,
  RegressionResult
} from "@inception/domain";
import {
  interventionArtefactsThatAscended,
  replayActiveRealityId,
  replayAnchorResults,
  replayFinalDiff,
  replayInterventions,
  replayMemoryIntegrity,
  replayOutcome,
  replayRealities,
  replayReflections,
  replayRegressionResult
} from "./replay-projection";

const at = (minute: number) => `2026-07-20T10:${String(minute).padStart(2, "0")}:00.000Z`;
const root = { id: "root", parentId: null, depth: 0 } as Reality;
const dream = { id: "dream", parentId: "root", depth: 1 } as Reality;
const event = (
  type: RealityEvent["type"],
  minute: number,
  realityId = dream.id,
  payload: Record<string, unknown> = {}
): RealityEvent => ({
  id: `${type}-${minute}`,
  realityId,
  type,
  summary: type,
  dreamTime: minute,
  payload,
  occurredAt: at(minute)
});

describe("Reality timeline projection", () => {
  it("replays the preserved VAmPI topology and Subjects only after their causal events", () => {
    const fixturePath = fileURLToPath(new URL(
      "../../../../examples/run-exports/vampi-real-mission-history-2026-07-20.json",
      import.meta.url
    ));
    const history = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      snapshot: { run: { realities: Reality[]; events: RealityEvent[] } };
    };
    const { realities, events } = history.snapshot.run;
    const rootEventIndex = events.findIndex((entry) => entry.type === "reality.created");
    expect(rootEventIndex).toBeGreaterThanOrEqual(0);
    expect(replayRealities(realities, events, rootEventIndex)).toHaveLength(1);

    const createdIds = new Set<string>();
    for (const [eventIndex, entry] of events.entries()) {
      if (entry.type !== "reality.created" && entry.type !== "dream.created") continue;
      createdIds.add(entry.realityId);
      expect(replayRealities(realities, events, eventIndex).map((reality) => reality.id))
        .toEqual(realities.filter((reality) => createdIds.has(reality.id)).map((reality) => reality.id));
    }

    for (const reality of realities.filter((entry) => entry.depth === 3)) {
      const createdAt = events.findIndex((entry) =>
        entry.type === "dream.created" && entry.realityId === reality.id
      );
      expect(replayRealities(realities, events, createdAt)
        .find((entry) => entry.id === reality.id)?.subjects).toHaveLength(0);

      const firstStarts = reality.subjects.map((subject) => events.findIndex((entry) => {
        const metadata = entry.payload.metadata;
        const subjectId = entry.payload.subjectId
          ?? (metadata && typeof metadata === "object" && "subjectId" in metadata
            ? metadata.subjectId
            : undefined);
        return (entry.type === "subject.started" || entry.type === "subject.entered")
          && subjectId === subject.id;
      }));
      expect(firstStarts.every((index) => index > createdAt)).toBe(true);
      const afterAllSubjectsEntered = replayRealities(
        realities,
        events,
        Math.max(...firstStarts)
      ).find((entry) => entry.id === reality.id);
      expect(afterAllSubjectsEntered?.subjects.map((subject) => subject.id))
        .toEqual(reality.subjects.map((subject) => subject.id));
    }

    expect(replayRealities(realities, events, events.length - 1)
      .reduce((total, reality) => total + reality.subjects.length, 0)).toBe(44);
  });

  it("counts only planted artefacts returned by the intervention Reality", () => {
    const intervention = {
      id: "ledger",
      contractId: "contract",
      realityId: dream.id,
      status: "revealed",
      armedAt: at(1),
      containedAt: at(2),
      report: {
        contractId: "contract",
        realityId: dream.id,
        subjectId: "mal",
        faultClass: "boundary-condition",
        summary: "Bounded fault",
        changedFiles: ["src/rate-limit.ts"],
        expectedSymptoms: ["One excess delivery"],
        generatedAt: at(1)
      },
      budgetApprovals: []
    } satisfies AdversarialInterventionLedger;
    const safeTest = {
      name: "Independent regression",
      path: "tests/rate-limit.test.ts",
      kind: "test" as const,
      summary: "Proves the observable boundary."
    };
    const sourceDream = {
      ...dream,
      wakeReport: {
        realityId: dream.id,
        initialBeliefs: [],
        experiences: [],
        changedBeliefs: [],
        invariants: [],
        artefacts: [safeTest],
        remainingUncertainty: [],
        recommendation: "Return only the independent regression.",
        generatedAt: at(2)
      }
    } as Reality;
    const synthesisedRoot = {
      ...root,
      wakeReport: {
        realityId: root.id,
        initialBeliefs: [],
        experiences: [],
        changedBeliefs: [],
        invariants: [],
        artefacts: [{
          name: "Independently synthesised implementation",
          path: "src/rate-limit.ts",
          kind: "patch",
          summary: "A verified parent implementation at the same repository path."
        }],
        remainingUncertainty: [],
        recommendation: "Adopt the verified parent implementation.",
        generatedAt: at(3)
      }
    } as Reality;

    expect(interventionArtefactsThatAscended(
      [synthesisedRoot, sourceDream],
      [intervention]
    )).toEqual([]);
    expect(interventionArtefactsThatAscended(
      [{
        ...sourceDream,
        wakeReport: {
          ...sourceDream.wakeReport!,
          artefacts: [
            safeTest,
            {
              name: "Planted source",
              path: "src/rate-limit.ts",
              kind: "patch",
              summary: "This must never ascend."
            }
          ]
        }
      } as Reality],
      [intervention]
    )).toEqual(["src/rate-limit.ts"]);
  });

  it("reveals intervention, Totem Check, synthesis, proof, and outcome state only after causal events", () => {
    const intervention = {
      id: "ledger",
      contractId: "contract",
      realityId: dream.id,
      status: "revealed",
      armedAt: at(2),
      startedAt: at(3),
      sealedAt: at(4),
      revealedAt: at(5),
      containedAt: at(6),
      changedFileCount: 1,
      patchLineCount: 2,
      report: {
        contractId: "contract",
        realityId: dream.id,
        subjectId: "mal",
        faultClass: "permission",
        summary: "Bounded fault",
        changedFiles: ["src/owner.ts"],
        expectedSymptoms: ["Owner check fails"],
        generatedAt: at(4)
      },
      diagnosis: {
        faultClass: "permission",
        rootCause: "The owner predicate was removed.",
        suspectedChangedFiles: ["src/owner.ts"],
        evidenceTitles: ["Owner test"],
        confidence: 1,
        remainingUncertainty: []
      },
      assessment: {
        outcome: "detected",
        faultClassMatched: true,
        identifiedFiles: ["src/owner.ts"],
        missedFiles: [],
        evidenceTitles: ["Owner test"],
        assessedAt: at(5)
      },
      excludedArtefactPaths: ["src/owner.ts"],
      budgetApprovals: []
    } satisfies AdversarialInterventionLedger;
    const seal = {
      id: "seal",
      realityId: dream.id,
      parentRealityId: root.id,
      reportDigest: "a".repeat(64),
      sourceStateDigest: "b".repeat(64),
      sourceCommit: "c".repeat(40),
      anchorFingerprint: "d".repeat(64),
      parentAnchorFingerprint: "e".repeat(64),
      descendantSealIds: [],
      descendantRealityIds: [],
      checks: [],
      verdict: "verified",
      policyVersion: "memory-integrity/v1",
      sealedAt: at(7)
    } satisfies MemoryIntegritySeal;
    const reflection = {
      id: "reflection",
      parentRealityId: root.id,
      realityIds: ["dream", "sibling"],
      sharedInvariants: [],
      disagreements: [],
      evidenceMatrix: [
        { realityId: "dream", realityName: "Dream", evidenceTitles: [], invariants: [], remainingUncertainty: [] },
        { realityId: "sibling", realityName: "Sibling", evidenceTitles: [], invariants: [], remainingUncertainty: [] }
      ],
      confidence: 1,
      createdAt: at(8)
    } satisfies DreamReflection;
    const anchor = {
      anchorId: "anchor",
      name: "Immutable owner proof",
      status: "passed",
      output: "passed"
    } satisfies AnchorResult;
    const regression = {
      status: "passed",
      output: "passed",
      command: "npm test",
      durationMs: 10,
      testFiles: ["owner.test.ts"]
    } satisfies RegressionResult;
    const outcome = {
      title: "Reality stabilised",
      summary: "Validated memories survived proof.",
      initialBelief: "Ownership works.",
      finalBelief: "Ownership requires object checks.",
      preventedRisk: "Cross-user access",
      generalisedInvariants: [],
      remainingUncertainty: [],
      metrics: {
        realitiesExplored: 2,
        maximumDepth: 1,
        subjectsReturned: 1,
        memoriesVerified: 1,
        memoriesQuarantined: 0,
        interventionsDetected: 1,
        interventionsMissed: 0,
        proofsPassed: 1,
        proofsTotal: 1,
        changedFiles: 1
      },
      generatedAt: at(12)
    } satisfies MissionOutcome;
    const events = [
      event("reality.created", 0, root.id),
      event("dream.created", 1),
      event("intervention.armed", 2, dream.id, { contractId: "contract" }),
      event("intervention.started", 3, dream.id, { contractId: "contract" }),
      event("intervention.sealed", 4, dream.id, { contractId: "contract" }),
      event("intervention.revealed", 5, dream.id, { contractId: "contract" }),
      event("intervention.contained", 6, dream.id, { contractId: "contract" }),
      event("memory.verified", 7, dream.id, { sealId: "seal" }),
      event("reflection.created", 8, root.id, { reflectionId: "reflection" }),
      event("synthesis.completed", 9, root.id),
      event("anchor.passed", 10, root.id, { anchorId: "anchor" }),
      event("verification.passed", 11, root.id),
      event("reality.stabilised", 12, root.id)
    ];

    expect(replayInterventions([intervention], events.slice(0, 2), true)).toEqual([]);
    const armed = replayInterventions([intervention], events.slice(0, 3), true)[0];
    expect(armed?.status).toBe("armed");
    expect(armed?.report).toBeUndefined();
    const sealed = replayInterventions([intervention], events.slice(0, 5), true)[0];
    expect(sealed?.status).toBe("sealed");
    expect(sealed?.report).toBeUndefined();
    expect(sealed?.containedAt).toBeUndefined();
    expect(replayInterventions([intervention], events.slice(0, 6), true)[0]).toMatchObject({
      status: "revealed",
      report: intervention.report,
      containedAt: undefined
    });
    expect(replayInterventions([intervention], events.slice(0, 7), true)[0]?.containedAt).toBe(at(6));
    expect(replayMemoryIntegrity([seal], events.slice(0, 7), true)).toEqual([]);
    expect(replayMemoryIntegrity([seal], events.slice(0, 8), true)).toEqual([seal]);
    expect(replayReflections([reflection], events.slice(0, 8), true)).toEqual([]);
    expect(replayReflections([reflection], events.slice(0, 9), true)).toEqual([reflection]);
    expect(replayFinalDiff("diff --git", events.slice(0, 9), true)).toBe("");
    expect(replayFinalDiff("diff --git", events.slice(0, 10), true)).toBe("diff --git");
    expect(replayAnchorResults([anchor], events.slice(0, 10), true)).toEqual([]);
    expect(replayAnchorResults([anchor], events.slice(0, 11), true)).toEqual([anchor]);
    expect(replayRegressionResult(regression, events.slice(0, 11), true)).toBeUndefined();
    expect(replayRegressionResult(regression, events.slice(0, 12), true)).toEqual(regression);
    expect(replayOutcome(outcome, events.slice(0, 12), true)).toBeUndefined();
    expect(replayOutcome(outcome, events, true)).toEqual(outcome);
    expect(replayActiveRealityId([root, dream], events.slice(0, 7), root.id)).toBe(dream.id);
    expect(replayActiveRealityId(
      [root, dream],
      [...events.slice(0, 7), event("memory.returned", 7, dream.id)],
      dream.id
    )).toBe(root.id);
  });
});
