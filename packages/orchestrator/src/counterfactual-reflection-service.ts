import { randomUUID } from "node:crypto";
import {
  DreamReflectionSchema,
  MissionOutcomeSchema,
  type DreamReflection,
  type MissionOutcome,
  type MissionRun,
  type Reality,
  type WakeReport
} from "@inception/domain";

function normalise(statement: string): string {
  return statement.trim().replace(/\s+/g, " ").toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Map(values.map((value) => [normalise(value), value.trim()])).values()];
}

function changedFileCount(diff: string): number {
  return new Set(
    diff
      .split("\n")
      .filter((line) => line.startsWith("diff --git "))
      .map((line) => line.split(" b/")[1])
      .filter((value): value is string => Boolean(value))
  ).size;
}

export class CounterfactualReflectionService {
  compare(
    parent: Reality,
    siblings: Array<{ reality: Reality; report: WakeReport }>,
    createdAt: string
  ): DreamReflection {
    if (siblings.length < 2) {
      throw new Error("A Reality Mirror requires at least two sibling memories.");
    }
    const counts = new Map<string, { statement: string; count: number }>();
    for (const { report } of siblings) {
      for (const invariant of unique(report.invariants)) {
        const key = normalise(invariant);
        const current = counts.get(key);
        counts.set(key, {
          statement: current?.statement ?? invariant,
          count: (current?.count ?? 0) + 1
        });
      }
    }
    const sharedInvariants = [...counts.values()]
      .filter((entry) => entry.count === siblings.length)
      .map((entry) => entry.statement);
    const disagreements = [...counts.entries()]
      .filter(([, entry]) => entry.count < siblings.length)
      .map(([key, entry]) => {
        const owners = siblings.filter(({ report }) =>
          report.invariants.some((invariant) => normalise(invariant) === key)
        );
        return {
          statement: entry.statement,
          realityIds: owners.map(({ reality }) => reality.id),
          evidenceTitles: unique(owners.flatMap(({ reality }) =>
            reality.evidence.map((evidence) => evidence.title)
          ))
        };
      });
    const evidenceMatrix = siblings.map(({ reality, report }) => ({
      realityId: reality.id,
      realityName: reality.name,
      evidenceTitles: unique(reality.evidence.map((evidence) => evidence.title)),
      invariants: unique(report.invariants),
      remainingUncertainty: unique(report.remainingUncertainty)
    }));
    const evidenceBearingWorlds = evidenceMatrix.filter((entry) =>
      entry.evidenceTitles.length > 0 || entry.invariants.length > 0
    ).length;
    return DreamReflectionSchema.parse({
      id: randomUUID(),
      parentRealityId: parent.id,
      realityIds: siblings.map(({ reality }) => reality.id),
      sharedInvariants,
      disagreements,
      evidenceMatrix,
      confidence: siblings.length
        ? Math.min(1, evidenceBearingWorlds / siblings.length)
        : 0,
      createdAt
    });
  }

  outcome(run: MissionRun, root: Reality, generatedAt: string): MissionOutcome {
    const verified = run.memoryIntegrity.filter((seal) => seal.verdict === "verified");
    const quarantined = run.memoryIntegrity.filter((seal) => seal.verdict === "quarantined");
    const reflectedRealityIds = new Set(
      run.reflections.flatMap((reflection) => reflection.realityIds)
    );
    const invariants = unique([
      ...run.reflections.flatMap((reflection) => reflection.sharedInvariants),
      ...run.memories
        .filter((memory) => !reflectedRealityIds.has(memory.realityId))
        .flatMap((memory) => memory.invariants)
    ]);
    const uncertainty = unique(run.memories.flatMap((memory) => memory.remainingUncertainty));
    const detectedInterventions = run.interventions.filter((entry) =>
      entry.assessment?.outcome === "detected"
    ).length;
    const missedInterventions = run.interventions.filter((entry) =>
      entry.assessment?.outcome === "partial" || entry.assessment?.outcome === "missed"
    ).length;
    const finalBelief = root.beliefs.at(-1)?.statement ?? run.definition.premise;
    const proofsPassed = run.proofResults.filter((proof) => proof.status === "passed").length;
    const changedFiles = changedFileCount(run.finalDiff);
    const preventedRisk = quarantined.length
      ? `${quarantined.length} unverified ${quarantined.length === 1 ? "Memory was" : "Memories were"} quarantined before synthesis could change Reality's implementation.`
      : detectedInterventions
        ? `${detectedInterventions} sealed adversarial ${detectedInterventions === 1 ? "fault was" : "faults were"} independently detected before Memory crossed its Kick boundary; only verified conclusions reached Reality's implementation.`
        : `${verified.length} returned ${verified.length === 1 ? "memory was" : "memories were"} integrity-checked before ${proofsPassed} parent-owned ${proofsPassed === 1 ? "proof" : "proofs"} admitted the implementation.`;

    return MissionOutcomeSchema.parse({
      title: `${run.definition.name} stabilised`,
      summary: `${run.realities.length - 1} counterfactual ${run.realities.length - 1 === 1 ? "Reality" : "Realities"} tested the initial belief; ${verified.length} verified ${verified.length === 1 ? "memory" : "memories"} changed ${changedFiles} ${changedFiles === 1 ? "file" : "files"} and survived every immutable proof.`,
      initialBelief: run.definition.premise,
      finalBelief,
      preventedRisk,
      generalisedInvariants: invariants,
      remainingUncertainty: uncertainty,
      metrics: {
        realitiesExplored: Math.max(0, run.realities.length - 1),
        maximumDepth: Math.max(0, ...run.realities.map((reality) => reality.depth)),
        subjectsReturned: run.realities.reduce(
          (total, reality) => total + reality.subjects.filter((subject) => subject.status === "returned").length,
          0
        ),
        memoriesVerified: verified.length,
        memoriesQuarantined: quarantined.length,
        interventionsDetected: detectedInterventions,
        interventionsMissed: missedInterventions,
        proofsPassed,
        proofsTotal: run.proofResults.length,
        changedFiles
      },
      generatedAt
    });
  }
}
