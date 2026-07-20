import { randomUUID } from "node:crypto";
import { RealityEntity, type Reality, type WakeReport } from "@inception/domain";

export class SynthesisService {
  synthesise(parent: Reality, reports: WakeReport[]): Reality {
    const entity = RealityEntity.hydrate(parent);
    const evidenceIds: string[] = [];

    for (const report of reports) {
      const memoryEvidence = entity.addEvidence({
        id: randomUUID(),
        kind: "invariant",
        title: report.artefacts[0]?.name
          ? `Memory returned with ${report.artefacts[0].name}`
          : "Memory returned with validated invariants",
        summary: [...report.invariants, report.recommendation].join(" "),
        source: `wake-report:${report.realityId}`,
        provenance: "inherited"
      });
      evidenceIds.push(memoryEvidence.id);
    }

    const currentBelief = parent.beliefs.at(-1);
    const returnedChanges = reports.flatMap((report) => report.changedBeliefs);
    const strongestChange = returnedChanges.reduce<(typeof returnedChanges)[number] | undefined>(
      (strongest, change) => !strongest || change.confidence > strongest.confidence ? change : strongest,
      undefined
    );
    entity.addBelief({
      id: randomUUID(),
      statement: strongestChange?.to ?? reports.map((report) => report.recommendation).join(" "),
      confidence: strongestChange?.confidence ?? 0.9,
      origin: "synthesised",
      supersedesBeliefId: currentBelief?.id,
      evidenceIds
    });
    entity
      .advanceTime(18, "Integrating returned memories", "Dream knowledge has been incorporated into Reality's implementation.")
      .setImplementationState("Layered abuse controls ready for anchor verification")
      .setStatus("exploring", "Reality integrating memories");
    return entity.snapshot();
  }
}
