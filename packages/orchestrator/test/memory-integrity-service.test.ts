import { describe, expect, it } from "vitest";
import { RealityEntity, type WakeReport } from "@inception/domain";
import { MemoryIntegrityService } from "../src/memory-integrity-service";

const constitution = {
  mission: "Protect authorization memory",
  premise: "Ownership checks are complete.",
  constraints: ["Return executable evidence."],
  wakeContract: ["Return changed beliefs."],
  parentTruths: ["Private data requires owner authorization."]
};

function wakeReport(realityId: string): WakeReport {
  return {
    realityId,
    initialBeliefs: [{ statement: "Ownership checks are complete.", confidence: 0.7 }],
    experiences: ["Observed a cross-user request."],
    changedBeliefs: [],
    invariants: ["Private data requires owner authorization."],
    artefacts: [{
      name: "Finding",
      path: "evidence/finding.md",
      kind: "note",
      summary: "Reproducible local finding."
    }],
    remainingUncertainty: [],
    recommendation: "Retain the authorization invariant.",
    generatedAt: new Date().toISOString()
  };
}

function worlds() {
  const root = RealityEntity.create({
    depth: 0,
    kind: "waking",
    name: "Reality",
    premise: constitution.premise,
    constitution,
    inheritedAnchors: [{
      id: "anchor-owner",
      realityId: "root",
      ownerRealityId: "root",
      name: "Owner authorization",
      description: "Cross-user access is denied.",
      testCommand: "python3 tests/authorization.py",
      immutable: true,
      hidden: true,
      status: "pending"
    }]
  }).snapshot();
  const child = RealityEntity.create({
    parentId: root.id,
    depth: 1,
    kind: "dream",
    name: "Attack",
    premise: constitution.premise,
    constitution,
    inheritedAnchors: root.anchors
  }).snapshot();
  const nested = RealityEntity.create({
    parentId: child.id,
    depth: 2,
    kind: "dream",
    name: "Nested attack",
    premise: constitution.premise,
    constitution,
    inheritedAnchors: child.anchors
  }).snapshot();
  return { root, child, nested };
}

describe("MemoryIntegrityService", () => {
  it("binds a report to its source and detects post-seal mutation", () => {
    const { root, child } = worlds();
    const report = wakeReport(child.id);
    const service = new MemoryIntegrityService();
    const seal = service.seal({
      reality: child,
      parent: root,
      report,
      realities: [root, child],
      inheritedMemories: [],
      priorSeals: [],
      sourceState: "diff --git a/api.py b/api.py",
      sourceCommit: "a".repeat(40),
      artefactsResolvable: true
    });

    expect(seal.verdict).toBe("verified");
    expect(service.matchesReport(seal, report)).toBe(true);
    expect(service.matchesSealedSource(seal, "a".repeat(40), true)).toBe(true);
    expect(service.matchesSealedSource(seal, "b".repeat(40), true)).toBe(false);
    expect(service.matchesSealedSource(seal, "a".repeat(40), false)).toBe(false);
    expect(service.matchesReport(seal, {
      ...report,
      recommendation: "A planted recommendation."
    })).toBe(false);
    expect(service.quarantine(
      seal,
      "report-digest",
      "The report changed after its Kick."
    )).toMatchObject({
      verdict: "quarantined",
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "report-digest", status: "failed" })
      ])
    });
  });

  it("quarantines anchor drift and a missing descendant-memory seal", () => {
    const { root, child, nested } = worlds();
    const service = new MemoryIntegrityService();
    const alteredChild = {
      ...child,
      anchors: child.anchors.map((anchor) => ({
        ...anchor,
        testCommand: "true"
      }))
    };
    const seal = service.seal({
      reality: alteredChild,
      parent: root,
      report: wakeReport(child.id),
      realities: [root, alteredChild, nested],
      inheritedMemories: [wakeReport(nested.id)],
      priorSeals: [],
      sourceState: "",
      sourceCommit: "b".repeat(40),
      artefactsResolvable: true
    });

    expect(seal.verdict).toBe("quarantined");
    expect(seal.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "anchor-fingerprint", status: "failed" }),
      expect.objectContaining({ name: "descendant-lineage", status: "failed" })
    ]));
  });

  it("quarantines a parent memory when a verified descendant source changed after Kick", () => {
    const { root, child, nested } = worlds();
    const service = new MemoryIntegrityService();
    const nestedReport = wakeReport(nested.id);
    const nestedSeal = service.seal({
      reality: nested,
      parent: child,
      report: nestedReport,
      realities: [root, child, nested],
      inheritedMemories: [],
      priorSeals: [],
      sourceState: "nested diff",
      sourceCommit: "d".repeat(40),
      artefactsResolvable: true
    });
    const parentSeal = service.seal({
      reality: child,
      parent: root,
      report: wakeReport(child.id),
      realities: [root, child, nested],
      inheritedMemories: [nestedReport],
      priorSeals: [nestedSeal],
      sourceState: "parent diff",
      sourceCommit: "e".repeat(40),
      artefactsResolvable: true,
      descendantSourcesValid: false
    });

    expect(parentSeal.verdict).toBe("quarantined");
    expect(parentSeal.checks).toContainEqual(expect.objectContaining({
      name: "descendant-lineage",
      status: "failed"
    }));
  });
});
