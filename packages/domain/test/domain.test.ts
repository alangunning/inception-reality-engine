import { describe, expect, it } from "vitest";
import {
  AdversarialInterventionLedgerSchema,
  DemoSessionSchema,
  MemoryIntegritySealSchema,
  MissionDefinitionDraftSchema,
  RealityEntity,
  WakeReportSchema,
  buildDreamPrompt
} from "../src";

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

  it("binds Wake Report belief changes to exact retained evidence identifiers", () => {
    const entity = RealityEntity.create({
      depth: 1,
      kind: "dream",
      name: "Evidence-bound Dream",
      premise: constitution.premise,
      constitution
    });
    entity.addEvidence({
      id: "evidence-uuid-1",
      kind: "test",
      title: "Decisive regression",
      summary: "The inherited invariant fails under the counterfactual.",
      source: "focused-test"
    });

    const prompt = buildDreamPrompt(entity.snapshot());
    expect(prompt).toContain('EVIDENCE_ID "evidence-uuid-1"');
    expect(prompt).toContain("Never invent aliases such as E1");
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

  it("validates an operator-owned bounded intervention without making it mandatory", () => {
    const base = {
      name: "Authorization boundary",
      repositoryPath: "/tmp/vampi",
      mission: "Find and repair cross-user access.",
      scope: "API authorization",
      premise: "Tokens enforce resource ownership.",
      constraints: ["Use synthetic local data."],
      parentTruths: ["Private resources require owner authorization."],
      wakeContract: ["Return executable evidence."],
      proofs: [{ name: "Regression", executable: "python3", args: ["tests/security.py"] }],
      subjects: [],
      tokenBudget: 100_000,
      maxDreamDepth: 3
    };
    expect(MissionDefinitionDraftSchema.parse(base).intervention).toBeUndefined();
    const parsed = MissionDefinitionDraftSchema.parse({
      ...base,
      intervention: {
        enabled: true,
        subject: {
          name: "Mal",
          role: "Bounded chaos engineer",
          mission: "Inject one reversible permission fault."
        },
        hypothesis: "Investigators can diagnose the fault from observable evidence.",
        faultClasses: ["permission"],
        allowedPaths: ["api_views/**"],
        protectedPaths: ["tests/**"],
        maxChangedFiles: 2,
        maxPatchLines: 80,
        tokenBudget: 16_000,
        maxMinutes: 12,
        targetDepth: 1,
        revealPolicy: "after-diagnosis",
        requireRollbackCommit: true
      }
    });
    expect(parsed.intervention?.targetDepth).toBe(1);
    expect(() => AdversarialInterventionLedgerSchema.parse({
      id: "ledger-1",
      contractId: "contract-1",
      realityId: "dream-1",
      status: "unbounded",
      armedAt: new Date().toISOString()
    })).toThrow();
  });

  it("keeps legacy Demo sessions readable with an empty intervention ledger", () => {
    const timestamp = new Date().toISOString();
    const parsed = DemoSessionSchema.parse({
      id: "singleton",
      phase: 0,
      activeRealityId: null,
      finalDiff: "",
      anchorResults: [],
      memoryIntegrity: [],
      createdAt: timestamp,
      updatedAt: timestamp
    });
    expect(parsed.interventions).toEqual([]);
  });

  it("keeps v1 memory seals readable while requiring every v2 integrity check", () => {
    const checks = [
      "schema",
      "identity",
      "anchor-fingerprint",
      "evidence-lineage",
      "artefact-resolution",
      "descendant-lineage",
      "intervention-diagnosis"
    ] as const;
    const legacy = {
      id: "legacy-seal",
      realityId: "dream-1",
      parentRealityId: "root-1",
      reportDigest: "a".repeat(64),
      sourceStateDigest: "b".repeat(64),
      sourceCommit: "abcdef0",
      anchorFingerprint: "c".repeat(64),
      parentAnchorFingerprint: "c".repeat(64),
      descendantSealIds: [],
      descendantRealityIds: [],
      checks: checks.map((name) => ({ name, status: "passed" as const, summary: `${name} passed.` })),
      verdict: "verified" as const,
      policyVersion: "memory-integrity/v1" as const,
      sealedAt: new Date().toISOString()
    };
    expect(MemoryIntegritySealSchema.parse(legacy).policyVersion).toBe("memory-integrity/v1");
    expect(() => MemoryIntegritySealSchema.parse({
      ...legacy,
      policyVersion: "memory-integrity/v2"
    })).toThrow(/report-digest/);
  });
});
