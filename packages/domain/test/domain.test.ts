import { describe, expect, it } from "vitest";
import { RealityEntity, WakeReportSchema, buildDreamPrompt } from "../src";

const constitution = {
  mission: "Improve password reset safely",
  premise: "Per-IP rate limiting may be sufficient",
  constraints: ["Do not leak account existence"],
  wakeContract: ["Return changed beliefs", "Return test artefacts"],
  parentTruths: ["Reset tokens expire"]
};

describe("Reality domain", () => {
  it("creates an isolated dream with inherited immutable anchors", () => {
    const reality = RealityEntity.create({
      depth: 1,
      kind: "dream",
      name: "Under coordinated attack",
      premise: constitution.premise,
      constitution,
      inheritedAnchors: [{
        id: "anchor-1",
        realityId: "parent",
        name: "Generic response",
        description: "Never disclose account existence",
        testCommand: "vitest anchors",
        immutable: true,
        hidden: true,
        status: "pending"
      }]
    }).snapshot();

    expect(reality.depth).toBe(1);
    expect(reality.anchors[0]?.immutable).toBe(true);
    expect(reality.anchors[0]?.realityId).toBe(reality.id);
  });

  it("builds a prompt containing constitution, history, evidence, anchors and wake contract", () => {
    const entity = RealityEntity.create({
      depth: 0,
      kind: "waking",
      name: "Waking Reality",
      premise: constitution.premise,
      constitution,
      initialBeliefs: [{ statement: "IP limiting prevents abuse", confidence: 0.7, origin: "initial" }]
    });
    const prompt = buildDreamPrompt(entity.snapshot());
    expect(prompt).toContain("CONSTITUTION");
    expect(prompt).toContain("CURRENT BELIEFS");
    expect(prompt).toContain("WAKE CONTRACT");
    expect(prompt).not.toContain("chain-of-thought");
  });

  it("validates structured wake memories", () => {
    const parsed = WakeReportSchema.parse({
      realityId: "dream-1",
      initialBeliefs: [{ statement: "IP limiting is enough", confidence: 0.7 }],
      experiences: ["Rotated source IPs"],
      changedBeliefs: [{
        from: "IP limiting is enough",
        to: "Identifier-level controls are also required",
        confidence: 0.96,
        evidenceIds: ["e-1"]
      }],
      invariants: ["Responses must remain generic"],
      artefacts: [{ name: "attack.spec.ts", path: "tests/attack.spec.ts", kind: "test", summary: "Fails before fix" }],
      remainingUncertainty: [],
      recommendation: "Combine per-IP and per-account controls",
      generatedAt: new Date().toISOString()
    });
    expect(parsed.changedBeliefs).toHaveLength(1);
  });
});
