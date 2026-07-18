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
        ownerRealityId: "parent",
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
    expect(reality.anchors[0]?.ownerRealityId).toBe("parent");
  });

  it("prevents a child Reality from mutating parent-owned anchors", () => {
    const entity = RealityEntity.create({
      depth: 1,
      kind: "dream",
      name: "Child",
      premise: constitution.premise,
      constitution,
      inheritedAnchors: [{
        id: "anchor-1",
        realityId: "parent",
        ownerRealityId: "parent",
        name: "Generic response",
        description: "Never disclose account existence",
        testCommand: "vitest anchors",
        immutable: true,
        hidden: true,
        status: "pending"
      }]
    });

    expect(() => entity.replaceAnchors(entity.snapshot().anchors)).toThrow(
      "Child Realities cannot mutate parent-owned anchors."
    );
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
    expect(prompt).toContain(`Reality ID: ${entity.snapshot().id}`);
    expect(prompt).toContain(`set realityId exactly to "${entity.snapshot().id}"`);
    expect(prompt).toContain("must never create one yourself");
    expect(prompt).toContain("Label simulated or hypothetical observations as synthetic evidence");
    expect(prompt).not.toContain("chain-of-thought");
  });

  it("applies each Reality's time-dilation law to experienced world time", () => {
    const entity = RealityEntity.create({
      depth: 2,
      kind: "dream",
      name: "Fast world",
      premise: constitution.premise,
      constitution: { ...constitution, timeDilation: 120 }
    });
    entity.advanceTime(2, "Running the decisive experiment");
    expect(entity.snapshot().worldState.simulatedMinutes).toBe(240);
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

  it("normalises a structured-output null for optional artefact content", () => {
    const parsed = WakeReportSchema.parse({
      realityId: "dream-1",
      initialBeliefs: [],
      experiences: [],
      changedBeliefs: [],
      invariants: [],
      artefacts: [{
        name: "attack.spec.ts",
        path: "tests/attack.spec.ts",
        kind: "test",
        summary: "Fails before fix",
        content: null
      }],
      remainingUncertainty: [],
      recommendation: "Retain the test",
      generatedAt: new Date().toISOString()
    });
    expect(parsed.artefacts[0]).not.toHaveProperty("content", null);
    expect(parsed.artefacts[0]?.content).toBeUndefined();
  });
});
