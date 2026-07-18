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
        title: `Memory inherited from ${report.realityId.slice(0, 8)}`,
        summary: [...report.invariants, report.recommendation].join(" "),
        source: `wake-report:${report.realityId}`
      });
      evidenceIds.push(memoryEvidence.id);
    }

    const currentBelief = parent.beliefs.at(-1);
    entity.addBelief({
      id: randomUUID(),
      statement: "Password-reset abuse resistance requires layered IP, identifier, and global controls with enumeration-safe responses.",
      confidence: 0.99,
      origin: "synthesised",
      supersedesBeliefId: currentBelief?.id,
      evidenceIds
    });
    entity
      .advanceTime(18, "Integrating returned memories", "Dream knowledge has been incorporated into the waking implementation.")
      .setImplementationState("Layered abuse controls ready for anchor verification")
      .setStatus("exploring", "Reality integrating memories");
    return entity.snapshot();
  }
}
