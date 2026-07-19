import { describe, expect, it } from "vitest";
import { MockCodexRuntime } from "@inception/codex-runtime";
import type { CodexRuntime } from "../src/codex-port";
import { InMemoryRealityEventBus } from "../src/event-bus";
import { InMemoryRealityRepository } from "../src/in-memory-repository";
import { MissionOrchestrator } from "../src/mission-orchestrator";
import type {
  MissionWorkspaceFactoryPort,
  WorktreeDescriptor,
  WorktreeManagerPort
} from "../src/worktree-port";

class FakeMissionWorktrees implements WorktreeManagerPort {
  readonly files = new Map<string, string>();
  changedFiles: string[] = [];
  changedDiff = "";
  restoreCalls = 0;
  dirtyWorktrees = new Set<string>();

  async discoverRepoRoot(): Promise<string> {
    return "/repo";
  }
  async create(realityId: string): Promise<WorktreeDescriptor> {
    return {
      path: `/mission-worktrees/${realityId}`,
      branchName: `mission/${realityId}`
    };
  }
  async remove(): Promise<void> {}
  async cleanupAll(): Promise<number> {
    return 0;
  }
  async isPresent(): Promise<boolean> {
    return true;
  }
  async writeFile(worktreePath: string, relativePath: string, content: string): Promise<void> {
    this.files.set(`${worktreePath}/${relativePath}`, content);
  }
  async readFile(worktreePath: string, relativePath: string): Promise<string> {
    const value = this.files.get(`${worktreePath}/${relativePath}`);
    if (value === undefined) throw new Error("Missing file");
    return value;
  }
  async listChangedFiles(): Promise<string[]> {
    return this.changedFiles;
  }
  async diff(): Promise<string> {
    return this.changedDiff;
  }
  async checkpoint(): Promise<string> {
    return "a".repeat(40);
  }
  async currentCommit(): Promise<string> {
    return "a".repeat(40);
  }
  async isClean(worktreePath: string): Promise<boolean> {
    return !this.dirtyWorktrees.has(worktreePath);
  }
  async sealChanges(): Promise<string> {
    return "b".repeat(40);
  }
  async restoreCheckpoint(): Promise<void> {
    this.restoreCalls += 1;
    this.changedFiles = [];
    this.changedDiff = "";
  }
  async run(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return { stdout: "passed", stderr: "", exitCode: 0 };
  }
}

function basicMission() {
  return {
    name: "Authorization review",
    repositoryPath: "/repo",
    mission: "Find the smallest authorization uncertainty without changing the waking baseline.",
    scope: "book ownership",
    premise: "Book lookups enforce ownership.",
    constraints: ["Use only local synthetic evidence."],
    parentTruths: ["Only owners may retrieve private books."],
    wakeContract: ["Return reproducible evidence."],
    proofs: [{
      name: "Authorization regression",
      executable: "python3",
      args: ["tests/authorization.py"]
    }],
    subjects: [],
    tokenBudget: 100_000,
    maxDreamDepth: 2
  };
}

describe("MissionOrchestrator", () => {
  it("forms without Codex usage, then supports auditable nested real-mode Dreams", async () => {
    const mock = new MockCodexRuntime();
    let inspections = 0;
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: async (...args) => {
        inspections += 1;
        return mock.inspect(...args);
      },
      intervene: (...args) => mock.intervene(...args),
      wake: (...args) => mock.wake(...args),
      synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
    };
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const workspaces: MissionWorkspaceFactoryPort = {
      open: async () => ({ repoRoot: "/repo", worktrees })
    };
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      workspaces
    );

    let snapshot = await orchestrator.create({
      name: "Dependency boundary",
      repositoryPath: "/repo",
      mission: "Make the dependency boundary resilient.",
      scope: "dependency loading",
      premise: "The fallback path is safe under partial failure.",
      constraints: ["Preserve the public API."],
      parentTruths: ["Existing callers remain compatible."],
      wakeContract: ["Return evidence and uncertainty."],
      proofs: [{
        name: "Repository tests",
        executable: "npm",
        args: ["test"]
      }],
      subjects: [
        {
          name: "Ariadne",
          role: "Investigator",
          mission: "Map the implementation boundary."
        },
        {
          name: "Eames",
          role: "Test engineer",
          mission: "Create a decisive test."
        }
      ],
      tokenBudget: 120_000,
      maxDreamDepth: 2
    });

    expect(inspections).toBe(0);
    expect(snapshot.nextAction?.id).toBe("inspect");
    expect(snapshot.run.realities).toHaveLength(1);

    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    expect(inspections).toBe(1);
    expect(snapshot.nextAction?.id).toBe("create_dream");

    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
    expect(snapshot.activeReality.depth).toBe(1);
    expect(snapshot.activeReality.subjects).toHaveLength(2);
    expect(snapshot.nextAction?.id).toBe("inspect");

    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    expect(snapshot.run.events.filter((event) => event.type === "subject.started")).toHaveLength(2);
    expect(snapshot.run.events.filter((event) => event.type === "subject.completed")).toHaveLength(2);
    expect(snapshot.nextAction?.id).toBe("create_dream");

    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
    expect(snapshot.activeReality.depth).toBe(2);
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    expect(snapshot.nextAction?.id).toBe("kick");

    snapshot = await orchestrator.act(snapshot.run.id, "kick");
    expect(snapshot.activeReality.depth).toBe(1);
    expect(snapshot.run.memoryIntegrity).toHaveLength(1);
    expect(snapshot.run.memoryIntegrity[0]).toMatchObject({
      verdict: "verified",
      descendantSealIds: []
    });
    const nestedSealId = snapshot.run.memoryIntegrity[0]!.id;
    snapshot = await orchestrator.act(snapshot.run.id, "kick");
    expect(snapshot.activeReality.depth).toBe(0);
    expect(snapshot.run.memories).toHaveLength(2);
    expect(snapshot.run.memoryIntegrity).toHaveLength(2);
    expect(snapshot.run.memoryIntegrity.find((seal) =>
      seal.realityId === snapshot.run.memories.find((memory) =>
        snapshot.run.realities.find((reality) => reality.id === memory.realityId)?.depth === 1
      )?.realityId
    )?.descendantSealIds).toContain(nestedSealId);
    expect(snapshot.nextAction?.id).toBe("synthesise");
    expect(await repository.getMissionRun(snapshot.run.id)).not.toBeNull();
  });

  it("quarantines a memory when its sealed Dream worktree changes after Kick", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      {
        mode: "real",
        info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
        activeOperations: () => [],
        abortAll: () => 0,
        inspect: (...args) => mock.inspect(...args),
        intervene: (...args) => mock.intervene(...args),
        wake: (...args) => mock.wake(...args),
        synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
      },
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      name: "Tamper detection",
      repositoryPath: "/repo",
      mission: "Prove a sealed memory cannot change after Kick.",
      scope: "authorization boundary",
      premise: "Returned evidence remains unchanged.",
      constraints: ["Use synthetic local evidence."],
      parentTruths: ["Only integrity-sealed memory may be synthesised."],
      wakeContract: ["Return reproducible evidence."],
      proofs: [{ name: "Integrity proof", executable: "npm", args: ["test"] }],
      subjects: [{ name: "Ariadne", role: "Investigator", mission: "Trace evidence lineage." }],
      tokenBudget: 50_000,
      maxDreamDepth: 1
    });
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "kick");
    const source = snapshot.run.realities.find((reality) =>
      reality.id === snapshot.run.memories[0]?.realityId
    )!;
    worktrees.dirtyWorktrees.add(source.worktreePath!);

    await expect(orchestrator.act(snapshot.run.id, "synthesise"))
      .rejects.toThrow(/sealed Git source changed/i);
    const rejected = await orchestrator.snapshot(snapshot.run.id);
    expect(rejected.run.memoryIntegrity.find((seal) => seal.realityId === source.id))
      .toMatchObject({
        verdict: "quarantined",
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "source-state", status: "failed" })
        ])
      });
    expect(rejected.run.events.some((event) => event.type === "memory.quarantined")).toBe(true);
  });

  it("seals a bounded intervention, withholds its private report, and reveals an evidence-derived assessment after Kick", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: (...args) => mock.inspect(...args),
      intervene: async (reality, contract, onEvent) => {
        worktrees.changedFiles = ["src/sealed-intervention.ts"];
        worktrees.changedDiff = "diff --git a/src/sealed-intervention.ts b/src/sealed-intervention.ts\n+permission regression\n";
        return mock.intervene(reality, contract, onEvent);
      },
      wake: (...args) => mock.wake(...args),
      synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
    };
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );

    let snapshot = await orchestrator.create({
      name: "Authorization boundary",
      repositoryPath: "/repo",
      mission: "Prove and repair a cross-user authorization failure.",
      scope: "API authorization",
      premise: "A valid token prevents cross-user access.",
      constraints: ["Use only synthetic local data."],
      parentTruths: ["Private resources require owner authorization."],
      wakeContract: ["Return executable evidence."],
      proofs: [{ name: "Authorization regression", executable: "python3", args: ["tests/security.py"] }],
      subjects: [
        { name: "Ariadne", role: "Investigator", mission: "Trace authorization." },
        { name: "Eames", role: "Test engineer", mission: "Create a regression test." }
      ],
      intervention: {
        enabled: true,
        subject: {
          name: "Mal",
          role: "Bounded chaos engineer",
          mission: "Inject one reversible permission fault."
        },
        hypothesis: "Investigators can diagnose a minimal permission fault from behavior.",
        faultClasses: ["permission"],
        allowedPaths: ["src/**"],
        protectedPaths: ["tests/**"],
        maxChangedFiles: 1,
        maxPatchLines: 10,
        tokenBudget: 10_000,
        maxMinutes: 5,
        targetDepth: 1,
        revealPolicy: "after-diagnosis",
        requireRollbackCommit: true
      },
      tokenBudget: 100_000,
      maxDreamDepth: 1
    });
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");

    expect(snapshot.activeReality.subjects).toHaveLength(0);
    expect(snapshot.nextAction?.id).toBe("intervene");
    snapshot = await orchestrator.act(snapshot.run.id, "intervene");
    const sealed = snapshot.run.interventions[0]!;
    expect(sealed.status).toBe("sealed");
    expect(sealed.changedFileCount).toBe(1);
    expect(sealed.report).toBeUndefined();
    expect(sealed.interventionCommit).toBeUndefined();
    expect(snapshot.activeReality.subjects).toHaveLength(2);
    expect(snapshot.nextAction?.id).toBe("inspect");

    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    expect(snapshot.run.interventions[0]?.diagnosis?.faultClass).toBe("permission");
    expect(snapshot.nextAction?.id).toBe("kick");
    snapshot = await orchestrator.act(snapshot.run.id, "kick");

    const revealed = snapshot.run.interventions[0]!;
    expect(revealed.status).toBe("revealed");
    expect(revealed.report?.changedFiles).toEqual(["src/sealed-intervention.ts"]);
    expect(revealed.assessment).toMatchObject({
      outcome: "detected",
      faultClassMatched: true,
      missedFiles: []
    });
    expect(snapshot.run.events.some((event) => event.type === "intervention.revealed")).toBe(true);
  });

  it("restores the Dream baseline when an intervention changes a protected path", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: (...args) => mock.inspect(...args),
      intervene: async (reality, contract, onEvent) => {
        worktrees.changedFiles = ["tests/protected.py"];
        worktrees.changedDiff = "+tampered proof\n";
        const result = await mock.intervene(reality, contract, onEvent);
        return {
          ...result,
          report: {
            ...result.report,
            changedFiles: ["tests/protected.py"]
          }
        };
      },
      wake: (...args) => mock.wake(...args),
      synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
    };
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      name: "Protected proof",
      repositoryPath: "/repo",
      mission: "Protect security proofs.",
      scope: "authorization",
      premise: "The proof cannot be changed.",
      constraints: ["Preserve tests."],
      parentTruths: [],
      wakeContract: ["Return evidence."],
      proofs: [{ name: "Proof", executable: "python3", args: ["tests/protected.py"] }],
      subjects: [],
      intervention: {
        enabled: true,
        subject: { name: "Mal", role: "Bounded chaos engineer", mission: "Inject one fault." },
        hypothesis: "A bounded fault remains diagnosable.",
        faultClasses: ["permission"],
        allowedPaths: ["src/**"],
        protectedPaths: ["tests/**"],
        maxChangedFiles: 1,
        maxPatchLines: 10,
        tokenBudget: 10_000,
        maxMinutes: 5,
        targetDepth: 1,
        revealPolicy: "after-diagnosis",
        requireRollbackCommit: true
      },
      tokenBudget: 100_000,
      maxDreamDepth: 1
    });
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");

    await expect(orchestrator.act(snapshot.run.id, "intervene")).rejects.toThrow(
      "AdversarialInterventionReportSchema"
    );
    const rejected = await orchestrator.snapshot(snapshot.run.id);
    expect(worktrees.restoreCalls).toBe(2);
    expect(rejected.run.interventions[0]).toMatchObject({
      status: "rejected"
    });
    expect(rejected.run.events.some((event) => event.type === "intervention.rejected")).toBe(true);
  });

  it("quarantines a planted memory when Subjects only partially diagnose the sealed fault", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: async (reality, onEvent) => {
        const result = await mock.inspect(reality, onEvent);
        if (reality.depth > 0 && result.report.adversarialDiagnosis) {
          result.report.adversarialDiagnosis = {
            ...result.report.adversarialDiagnosis,
            suspectedChangedFiles: ["src/wrong-boundary.ts"]
          };
        }
        return result;
      },
      intervene: async (reality, contract, onEvent) => {
        worktrees.changedFiles = ["src/sealed-intervention.ts"];
        worktrees.changedDiff = "+permission regression\n";
        return mock.intervene(reality, contract, onEvent);
      },
      wake: (...args) => mock.wake(...args),
      synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
    };
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      name: "Memory integrity",
      repositoryPath: "/repo",
      mission: "Reject an incompletely diagnosed planted fault.",
      scope: "API authorization",
      premise: "A valid token enforces ownership.",
      constraints: ["Use synthetic local data."],
      parentTruths: ["Private resources require owner authorization."],
      wakeContract: ["Return executable evidence."],
      proofs: [{ name: "Authorization regression", executable: "python3", args: ["tests/security.py"] }],
      subjects: [{ name: "Ariadne", role: "Investigator", mission: "Trace authorization." }],
      intervention: {
        enabled: true,
        subject: {
          name: "Mal",
          role: "Bounded chaos engineer",
          mission: "Inject one reversible permission fault."
        },
        hypothesis: "Investigators can diagnose a minimal permission fault from behavior.",
        faultClasses: ["permission"],
        allowedPaths: ["src/**"],
        protectedPaths: ["tests/**"],
        maxChangedFiles: 1,
        maxPatchLines: 10,
        tokenBudget: 10_000,
        maxMinutes: 5,
        targetDepth: 1,
        revealPolicy: "after-diagnosis",
        requireRollbackCommit: true
      },
      tokenBudget: 100_000,
      maxDreamDepth: 1
    });
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
    snapshot = await orchestrator.act(snapshot.run.id, "intervene");
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "kick");

    expect(snapshot.activeReality.depth).toBe(0);
    expect(snapshot.run.memories).toHaveLength(0);
    expect(snapshot.run.interventions[0]?.assessment?.outcome).toBe("partial");
    expect(snapshot.run.events.some((event) => event.type === "memory.quarantined")).toBe(true);
    expect(snapshot.activeReality.proposals.some((proposal) => proposal.status === "open")).toBe(true);
    expect(snapshot.nextAction?.id).toBe("create_dream");
  });

  it("admits native opportunistic Subjects and restores the waking filesystem baseline", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: async (reality, onEvent) => {
        const result = await mock.inspect(reality);
        const threadId = "019f775b-ef89-7550-9834-e0f4244d2ac0";
        worktrees.changedFiles = ["api_views/books.py", "tests/authorization.py"];
        worktrees.changedDiff = "+waking mutation that must not survive\n";
        await onEvent?.({
          type: "progress",
          summary: "Codex thread entered the waking Reality worktree.",
          metadata: { stage: "thread", status: "started", threadId }
        });
        return {
          ...result,
          threadId,
          report: {
            ...result.report,
            subjectReports: [{
              subjectId: "019f775d-8629-7db0-8fca-de9bcac91c34",
              name: "Laplace",
              role: "Explorer",
              findings: ["The title-only lookup omits the authenticated owner."],
              artefactPaths: ["api_views/books.py"]
            }]
          },
          observedSubjects: [{
            id: "019f775d-8629-7db0-8fca-de9bcac91c34",
            name: "Laplace",
            role: "Explorer",
            mission: "Bounded independent investigation selected by Codex.",
            threadId: "019f775d-8629-7db0-8fca-de9bcac91c34"
          }]
        };
      },
      intervene: (...args) => mock.intervene(...args),
      wake: (...args) => mock.wake(...args),
      synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
    };
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );

    let snapshot = await orchestrator.create(basicMission());
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");

    expect(snapshot.activeReality.codexThreadId).toBe("019f775b-ef89-7550-9834-e0f4244d2ac0");
    expect(snapshot.activeReality.subjects).toEqual([
      expect.objectContaining({
        id: "019f775d-8629-7db0-8fca-de9bcac91c34",
        name: "Laplace",
        role: "Explorer",
        status: "returned"
      })
    ]);
    expect(worktrees.restoreCalls).toBe(1);
    expect(worktrees.changedFiles).toEqual([]);
    expect(snapshot.activeReality.worldState.implementationState).toContain("baseline preserved");
    expect(snapshot.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "codex.thread.bound" }),
      expect.objectContaining({
        type: "inspection.completed",
        payload: expect.objectContaining({
          baselineRestored: true,
          retainedChangedFiles: []
        })
      })
    ]));
    const root = snapshot.activeReality.worktreePath!;
    expect(worktrees.files.get(`${root}/.inception/reality/REALITY.md`))
      .toContain("Codex thread: 019f775b-ef89-7550-9834-e0f4244d2ac0");
    expect(worktrees.files.get(`${root}/.inception/reality/AGENTS.override.md`))
      .toContain("orchestrator will roll its filesystem back");
    expect(worktrees.files.get(`${root}/.inception/anchors/manifest.json`))
      .toContain('"immutable": true');
    expect(worktrees.files.has(`${root}/.inception/reality.json`)).toBe(false);
    expect(worktrees.files.has(`${root}/.inception/anchors.json`)).toBe(false);
  });

  it("rolls back a rejected report while retaining its SDK thread and safe issue code", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: async (reality, onEvent) => {
        const result = await mock.inspect(reality);
        const threadId = "thread-rejected-report";
        worktrees.changedFiles = ["api_views/books.py"];
        worktrees.changedDiff = "+rejected mutation\n";
        await onEvent?.({
          type: "progress",
          summary: "Codex thread entered the waking Reality worktree.",
          metadata: { stage: "thread", status: "started", threadId }
        });
        return {
          ...result,
          threadId,
          report: {
            ...result.report,
            subjectReports: [{
              subjectId: "unverified-subject",
              name: "Unverified",
              role: "Explorer",
              findings: ["This report has no native trace."],
              artefactPaths: []
            }]
          }
        };
      },
      intervene: (...args) => mock.intervene(...args),
      wake: (...args) => mock.wake(...args),
      synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
    };
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    const created = await orchestrator.create(basicMission());

    await expect(orchestrator.act(created.run.id, "inspect"))
      .rejects.toThrow(/subjectReports.*subject_identity_mismatch/);
    const rejected = await orchestrator.snapshot(created.run.id);

    expect(rejected.activeReality.codexThreadId).toBe("thread-rejected-report");
    expect(rejected.activeReality.evidence).toHaveLength(0);
    expect(rejected.activeReality.subjects).toHaveLength(0);
    expect(rejected.run.status).toBe("exploring");
    expect(rejected.nextAction?.id).toBe("inspect");
    expect(worktrees.restoreCalls).toBe(1);
    expect(worktrees.changedFiles).toEqual([]);
    expect(rejected.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "reality.recovered",
        payload: expect.objectContaining({
          threadId: "thread-rejected-report",
          validation: {
            contract: "InvestigationReportSchema",
            issues: [{
              path: "subjectReports",
              code: "subject_identity_mismatch"
            }]
          }
        })
      }),
      expect.objectContaining({
        type: "validation.rejected",
        summary: expect.stringContaining("subject_identity_mismatch"),
        payload: expect.objectContaining({
          validation: {
            contract: "InvestigationReportSchema",
            issues: [{
              path: "subjectReports",
              code: "subject_identity_mismatch"
            }]
          }
        })
      })
    ]));
  });

  it("rejects and rolls back a turn that crosses the observed SDK token ceiling", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: async (reality, onEvent) => {
        const result = await mock.inspect(reality);
        const threadId = "thread-over-token-ceiling";
        const usageEvent = {
          type: "progress" as const,
          summary: "Authorization review returned from the waking Reality.",
          metadata: {
            stage: "turn" as const,
            status: "completed" as const,
            inputTokens: 90_000,
            outputTokens: 20_001,
            reasoningTokens: 5_000
          }
        };
        worktrees.changedFiles = ["api_views/books.py"];
        await onEvent?.({
          type: "progress",
          summary: "Codex thread entered the waking Reality worktree.",
          metadata: { stage: "thread", status: "started", threadId }
        });
        await onEvent?.(usageEvent);
        return {
          ...result,
          threadId,
          events: [...result.events, usageEvent]
        };
      },
      intervene: (...args) => mock.intervene(...args),
      wake: (...args) => mock.wake(...args),
      synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
    };
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    const created = await orchestrator.create(basicMission());

    await expect(orchestrator.act(created.run.id, "inspect"))
      .rejects.toThrow(/usage\.totalTokens.*mission_token_ceiling_exceeded/);
    const rejected = await orchestrator.snapshot(created.run.id);

    expect(rejected.activeReality.codexThreadId).toBe("thread-over-token-ceiling");
    expect(rejected.activeReality.evidence).toHaveLength(0);
    expect(worktrees.restoreCalls).toBe(1);
    expect(rejected.run.events.at(-1)).toMatchObject({
      type: "validation.rejected",
      payload: {
        validation: {
          contract: "InvestigationReportSchema",
          issues: [{
            path: "usage.totalTokens",
            code: "mission_token_ceiling_exceeded"
          }]
        }
      }
    });
  });
});
