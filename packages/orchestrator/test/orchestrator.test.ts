import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CodexOutputValidationError,
  MockCodexRuntime,
  WakeReportValidationError,
  type CodexExecutionResult,
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexWakeResult
} from "@inception/codex-runtime";
import type { Reality, RealityEvent } from "@inception/domain";
import type { WorktreeDescriptor, WorktreeManager } from "@inception/worktree-manager";
import {
  InMemoryRealityEventBus,
  InMemoryRealityRepository,
  RealityOrchestrator,
  SynthesisService,
  type DemoAction
} from "../src";

class FakeWorktreeManager implements WorktreeManager {
  restoreCalls = 0;
  private interventionCheckpointActive = false;

  constructor(private readonly root: string) {}
  async discoverRepoRoot(): Promise<string> { return this.root; }
  async create(realityId: string): Promise<WorktreeDescriptor> {
    const target = path.join(this.root, realityId);
    await mkdir(target, { recursive: true });
    return { path: target, branchName: `inception/${realityId}` };
  }
  async remove(): Promise<void> {}
  async cleanupAll(): Promise<number> { return 0; }
  async isPresent(worktreePath?: string): Promise<boolean> {
    if (!worktreePath) return false;
    return access(worktreePath).then(() => true, () => false);
  }
  async writeFile(worktreePath: string, relativePath: string, content: string): Promise<void> {
    const target = path.join(worktreePath, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  async readFile(worktreePath: string, relativePath: string): Promise<string> {
    return readFile(path.join(worktreePath, relativePath), "utf8");
  }
  async listChangedFiles(): Promise<string[]> {
    if (this.interventionCheckpointActive) {
      return ["demo/password-reset/src/password-reset.ts"];
    }
    return [
      "demo/password-reset/src/password-reset.ts",
      "demo/password-reset/tests/rotating-ip.attack.spec.ts",
      "demo/password-reset/tests/enumeration.attack.spec.ts"
    ];
  }
  async diff(): Promise<string> { return "diff --git a/password-reset.ts b/password-reset.ts\n+layered controls"; }
  async checkpoint(_worktreePath: string, message?: string): Promise<string> {
    this.interventionCheckpointActive = message?.includes("before sealed intervention") ?? false;
    return "a".repeat(40);
  }
  async currentCommit(): Promise<string> { return "a".repeat(40); }
  async isClean(): Promise<boolean> { return true; }
  async sealChanges(): Promise<string> {
    this.interventionCheckpointActive = false;
    return "b".repeat(40);
  }
  async restoreCheckpoint(): Promise<void> {
    this.interventionCheckpointActive = false;
    this.restoreCalls += 1;
  }
  async run(_worktreePath: string, _command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (args.some((arg) =>
      arg.includes("rotating-ip.attack.spec.ts")
      || arg.includes("enumeration.attack.spec.ts")
    )) {
      return { stdout: "1 test failed", stderr: "", exitCode: 1 };
    }
    return { stdout: "3 tests passed", stderr: "", exitCode: 0 };
  }
}

class FailFirstAnchorWorktreeManager extends FakeWorktreeManager {
  private failedAnchor = false;

  override async run(
    worktreePath: string,
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.failedAnchor && args.some((arg) => arg.includes("anchors.spec.ts"))) {
      this.failedAnchor = true;
      return { stdout: "1 test failed", stderr: "", exitCode: 1 };
    }
    return super.run(worktreePath, command, args);
  }
}

class InvalidWakeRuntime extends MockCodexRuntime implements CodexRuntime {
  override async wake(_reality: Reality): Promise<CodexWakeResult> {
    throw new WakeReportValidationError();
  }
}

class EvidenceAliasFirstWakeRuntime extends MockCodexRuntime {
  inspectCalls = 0;
  wakeCalls = 0;

  override async inspect(
    reality: Reality,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexExecutionResult> {
    this.inspectCalls += 1;
    return super.inspect(reality, onEvent);
  }

  override async wake(
    reality: Reality,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexWakeResult> {
    this.wakeCalls += 1;
    const result = await super.wake(reality, onEvent);
    if (this.wakeCalls !== 1) return result;
    return {
      ...result,
      report: {
        ...result.report,
        changedBeliefs: result.report.changedBeliefs.map((change) => ({
          ...change,
          evidenceIds: ["E1"]
        }))
      }
    };
  }
}

class BlockingInspectRuntime extends MockCodexRuntime {
  readonly entered: Promise<void>;
  private markEntered!: () => void;
  private releaseGate!: () => void;
  private readonly gate: Promise<void>;

  constructor() {
    super();
    this.entered = new Promise((resolve) => {
      this.markEntered = resolve;
    });
    this.gate = new Promise((resolve) => {
      this.releaseGate = resolve;
    });
  }

  release(): void {
    this.releaseGate();
  }

  override async inspect(
    reality: Reality,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexExecutionResult> {
    this.markEntered();
    await this.gate;
    return super.inspect(reality, onEvent);
  }
}

class InvalidInspectionRuntime extends MockCodexRuntime {
  override async inspect(): Promise<CodexExecutionResult> {
    throw new CodexOutputValidationError("InvestigationReportSchema", [{
      path: "evidence",
      code: "invalid_type"
    }]);
  }
}

class MissedCanonicalInterventionRuntime extends MockCodexRuntime {
  override async inspect(
    reality: Reality,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexExecutionResult> {
    const result = await super.inspect(reality, onEvent);
    if (
      reality.depth === 2
      && (reality.constitution.runtimeLaws ?? []).some((law) =>
        law.includes("sealed controlled intervention")
      )
    ) {
      result.report.adversarialDiagnosis = {
        rootCause: "The observable fault could not be localized.",
        faultClass: "permission",
        suspectedChangedFiles: [],
        evidenceTitles: [],
        confidence: 0.25,
        remainingUncertainty: ["The planted boundary condition remains unidentified."]
      };
    }
    return result;
  }
}

class QuotaFailureRuntime extends MockCodexRuntime {
  override async inspect(): Promise<CodexExecutionResult> {
    throw new Error(
      "OpenAI API-key quota rejected this turn. Reality Engine used API-key authentication; "
      + "check that key's project budget, or set INCEPTION_CODEX_AUTH_MODE=cli to use the Codex CLI login."
    );
  }
}

class ThreadThenInvalidInspectionRuntime extends MockCodexRuntime {
  override async inspect(
    _reality: Reality,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexExecutionResult> {
    await onEvent?.({
      type: "progress",
      summary: "Codex thread entered the waking Reality worktree.",
      metadata: {
        stage: "thread",
        status: "started",
        threadId: "thread-retained-after-rejection"
      }
    });
    throw new CodexOutputValidationError("InvestigationReportSchema", [{
      path: "subjectReports",
      code: "subject_identity_mismatch"
    }]);
  }
}

class FailingRegressionWorktreeManager extends FakeWorktreeManager {
  override async run(worktreePath: string, command: string, args: string[]) {
    if (args.includes("demo/password-reset/tests")) {
      return { stdout: "1 inherited test failed", stderr: "", exitCode: 1 };
    }
    return super.run(worktreePath, command, args);
  }
}

class ConfigurationFailureWorktreeManager extends FakeWorktreeManager {
  override async run(worktreePath: string, command: string, args: string[]) {
    if (args.some((arg) => /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(arg))) {
      return {
        stdout: "",
        stderr: "failed to load config: module resolution error",
        exitCode: 1
      };
    }
    return super.run(worktreePath, command, args);
  }
}

describe("RealityOrchestrator", () => {
  it("serialises concurrent first-load seeding into one waking Reality", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-seed-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );

      await Promise.all(Array.from({ length: 8 }, () => orchestrator.snapshot()));

      expect(await repository.listRealities()).toHaveLength(1);
      expect((await repository.listEvents()).filter((event) => event.type === "reality.created")).toHaveLength(1);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("restores a persisted Reality worktree without starting Codex", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-recovery-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const seeded = await orchestrator.snapshot();
      const root = seeded.realities[0]!;
      await rm(root.worktreePath!, { recursive: true, force: true });

      const recovered = await orchestrator.snapshot();

      await expect(access(recovered.realities[0]!.worktreePath!)).resolves.toBeUndefined();
      expect(recovered.session.phase).toBe(0);
      expect(recovered.events.some((event) => event.type === "reality.fractured")).toBe(true);
      expect(recovered.events.some((event) => event.type === "reality.recovered")).toBe(true);
      expect(recovered.events.some((event) => event.type === "codex.progress")).toBe(false);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("returns an actionable quota failure without Codex process noise", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-quota-error-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new QuotaFailureRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      await orchestrator.snapshot();

      await expect(orchestrator.act("inspect")).rejects.toThrow(
        "OpenAI API-key quota rejected this turn."
      );
      const failed = await orchestrator.snapshot();
      const event = failed.events.find((entry) => entry.type === "reality.fractured");
      expect(event?.summary).toContain("OpenAI API-key quota rejected this turn.");
      expect(event?.summary).not.toContain("did not complete");
      expect(event?.summary).not.toContain("Reading prompt from stdin");
      expect(event?.payload.failureKind).toBe("codex_quota_unavailable");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("keeps the complete demo timeline after more than 80 runtime events", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-timeline-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const seeded = await orchestrator.snapshot();
      const rootId = seeded.realities[0]!.id;
      for (let index = 0; index < 90; index += 1) {
        const event: RealityEvent = {
          id: `progress-${index}`,
          realityId: rootId,
          type: "codex.progress",
          summary: `Runtime event ${index}`,
          dreamTime: 0,
          payload: {},
          occurredAt: new Date(Date.now() + index + 1).toISOString()
        };
        await repository.appendEvent(event);
      }

      const snapshot = await orchestrator.snapshot();
      expect(snapshot.events).toHaveLength(91);
      expect(snapshot.events[0]?.type).toBe("reality.created");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("exposes an in-flight operation through snapshots until it returns", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-operation-"));
    try {
      const repository = new InMemoryRealityRepository();
      const runtime = new BlockingInspectRuntime();
      const worktrees = new FakeWorktreeManager(temp);
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        runtime,
        worktrees,
        new SynthesisService(),
        temp
      );

      const action = orchestrator.act("inspect");
      await runtime.entered;
      const during = await orchestrator.snapshot();
      expect(during.operation).toMatchObject({
        action: "inspect",
        label: "Ask Codex to audit and improve password-reset security",
        executor: "codex",
        realityId: during.session.activeRealityId
      });
      expect(during.nextAction).toBeNull();

      runtime.release();
      await action;
      const after = await orchestrator.snapshot();
      expect(after.operation).toBeNull();
      expect(after.nextAction?.id).toBe("create_attack_dream");
      expect(worktrees.restoreCalls).toBe(1);
      expect(after.events.some((event) =>
        event.type === "inspection.completed"
        && event.payload.baselineRestored === true
      )).toBe(true);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("runs the complete deterministic nested-dream sequence", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-demo-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const actions: DemoAction[] = [
        "inspect",
        "create_attack_dream",
        "enter_subjects",
        "discover_abuse",
        "create_nested_dream",
        "wake_nested",
        "create_nested_dream",
        "intervene",
        "wake_nested",
        "wake_parent",
        "synthesise",
        "run_anchors"
      ];
      for (const action of actions) await orchestrator.act(action);
      const beforeStabilisation = await orchestrator.snapshot();
      const retainedSource = beforeStabilisation.realities.find((reality) => reality.depth === 2)!;
      const proposalTemplate = beforeStabilisation.realities
        .find((reality) => reality.depth === 1)!.proposals[0]!;
      const retainedProposal = {
        ...proposalTemplate,
        id: "retained-budget-proposal",
        realityId: retainedSource.id,
        status: "open" as const
      };
      await repository.saveReality({
        ...retainedSource,
        proposals: [
          retainedProposal,
          { ...retainedProposal, id: "duplicate-retry-proposal" }
        ]
      });
      await orchestrator.act("stabilise");

      const snapshot = await orchestrator.snapshot();
      expect(snapshot.session.phase).toBe(10);
      expect(snapshot.realities).toHaveLength(4);
      expect(snapshot.realities.map((reality) => reality.depth)).toEqual([0, 1, 2, 2]);
      expect(snapshot.realities.filter((reality) => reality.wakeReport)).toHaveLength(3);
      expect(snapshot.activeReality?.status).toBe("stabilised");
      expect(snapshot.session.anchorResults.every((anchor) => anchor.status === "passed")).toBe(true);
      expect(snapshot.session.anchorResults).toHaveLength(4);
      expect(snapshot.session.interventions).toHaveLength(1);
      expect(snapshot.session.interventions[0]).toMatchObject({
        status: "revealed",
        changedFileCount: 1,
        assessment: { outcome: "detected" },
        excludedArtefactPaths: [],
        containedAt: expect.any(String)
      });
      expect(snapshot.events.some((event) =>
        event.type === "intervention.contained"
        && event.payload.injectedFilesAscended === 0
      )).toBe(true);
      expect(snapshot.session.finalDiff).toContain("layered controls");
      expect(snapshot.events.some((event) => event.type === "memory.returned")).toBe(true);
      expect(snapshot.events.filter((event) => event.type === "memory.verified")).toHaveLength(3);
      expect(snapshot.session.memoryIntegrity).toHaveLength(3);
      const deepestSeals = snapshot.session.memoryIntegrity.filter((seal) =>
        snapshot.realities.find((reality) => reality.id === seal.realityId)?.depth === 2
      );
      const parentSeal = snapshot.session.memoryIntegrity.find((seal) =>
        snapshot.realities.find((reality) => reality.id === seal.realityId)?.depth === 1
      )!;
      expect(deepestSeals).toHaveLength(2);
      expect(deepestSeals.every((seal) => seal.verdict === "verified")).toBe(true);
      expect(parentSeal.descendantSealIds).toEqual(expect.arrayContaining(deepestSeals.map((seal) => seal.id)));
      expect(snapshot.realities.flatMap((reality) => reality.proposals)).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ status: "open" })])
      );
      for (const reality of snapshot.realities) {
        const retainedProposals = reality.proposals.filter((proposal) => proposal.status === "deferred");
        expect(new Set(retainedProposals.map((proposal) => `${proposal.title}\u0000${proposal.premise}`)).size)
          .toBe(retainedProposals.length);
      }
      expect(snapshot.realities[0]?.evidence.some((evidence) => evidence.title.startsWith("Memory inherited from "))).toBe(false);
      expect(snapshot.realities[0]?.evidence.some((evidence) => evidence.title.startsWith("Memory returned with "))).toBe(true);

      await orchestrator.reset();
      const archives = await orchestrator.listRunArchives();
      expect(archives).toHaveLength(1);
      expect(archives[0]?.session.phase).toBe(10);
      expect(archives[0]?.events.some((event) => event.type === "reality.stabilised")).toBe(true);
      expect((await orchestrator.snapshot()).session.phase).toBe(0);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("restores the planted change and quarantines canonical memory when the diagnosis misses", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-intervention-miss-"));
    try {
      const repository = new InMemoryRealityRepository();
      const worktrees = new FakeWorktreeManager(temp);
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MissedCanonicalInterventionRuntime(),
        worktrees,
        new SynthesisService(),
        temp
      );
      const setup: DemoAction[] = [
        "inspect",
        "create_attack_dream",
        "enter_subjects",
        "discover_abuse",
        "create_nested_dream",
        "wake_nested",
        "create_nested_dream",
        "intervene"
      ];
      for (const action of setup) await orchestrator.act(action);

      await expect(orchestrator.act("wake_nested")).rejects.toThrow(
        "Memory integrity gate quarantined"
      );
      const snapshot = await orchestrator.snapshot();
      expect(snapshot.session.phase).toBe(5);
      expect(snapshot.session.interventions[0]).toMatchObject({
        status: "revealed",
        assessment: { outcome: "missed" },
        containedAt: expect.any(String)
      });
      expect(snapshot.session.memoryIntegrity).toHaveLength(2);
      expect(snapshot.session.memoryIntegrity).toEqual(expect.arrayContaining([
        expect.objectContaining({ verdict: "verified" }),
        expect.objectContaining({
          realityId: snapshot.session.interventions[0]?.realityId,
          verdict: "quarantined",
          checks: expect.arrayContaining([
            expect.objectContaining({
              name: "intervention-diagnosis",
              status: "failed"
            })
          ])
        })
      ]));
      expect(snapshot.events.some((event) =>
        event.type === "intervention.contained"
        && event.payload.injectedFilesAscended === 0
      )).toBe(true);
      expect(snapshot.events.some((event) => event.type === "memory.quarantined")).toBe(true);
      expect(worktrees.restoreCalls).toBeGreaterThan(0);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("corrects an evidence-lineage quarantine without repeating the nested investigation", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-evidence-correction-"));
    try {
      const repository = new InMemoryRealityRepository();
      const runtime = new EvidenceAliasFirstWakeRuntime();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        runtime,
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const setup: DemoAction[] = [
        "inspect",
        "create_attack_dream",
        "enter_subjects",
        "discover_abuse",
        "create_nested_dream"
      ];
      for (const action of setup) await orchestrator.act(action);

      await expect(orchestrator.act("wake_nested")).rejects.toThrow(
        "Memory integrity gate quarantined"
      );
      const inspectionsAfterQuarantine = runtime.inspectCalls;
      expect((await orchestrator.snapshot()).session.memoryIntegrity[0]).toMatchObject({
        verdict: "quarantined"
      });

      await orchestrator.act("wake_nested");
      const corrected = await orchestrator.snapshot();
      expect(corrected.session.phase).toBe(5);
      expect(corrected.nextAction?.id).toBe("create_nested_dream");
      expect(runtime.inspectCalls).toBe(inspectionsAfterQuarantine);
      expect(runtime.wakeCalls).toBe(2);
      expect(corrected.session.memoryIntegrity[0]).toMatchObject({
        verdict: "verified"
      });
      expect(corrected.events.some((event) =>
        event.type === "wake.collecting"
        && event.summary.includes("exact evidence ledger")
      )).toBe(true);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("starts Demo recording auto mode only on command and completes the deterministic path", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-demo-auto-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const idle = await orchestrator.snapshot();
      expect(idle.session.phase).toBe(0);
      expect(idle.session.autopilot.mode).toBe("off");
      expect(idle.events.some((event) => event.type === "autopilot.started")).toBe(false);

      await orchestrator.controlAutopilot({
        command: "start",
        paceMilliseconds: 250
      });
      let completed = await orchestrator.snapshot();
      for (let attempt = 0; attempt < 80 && completed.session.autopilot.mode === "running"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        completed = await orchestrator.snapshot();
      }

      expect(completed.session.autopilot).toMatchObject({
        mode: "completed",
        actionsCompleted: 13
      });
      expect(completed.session.phase).toBe(10);
      expect(completed.events.some((event) => event.type === "autopilot.started")).toBe(true);
      expect(completed.events.some((event) => event.type === "autopilot.completed")).toBe(true);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }, 10_000);

  it("runs the real Demo Mission in bounded guided auto mode and pauses at Dream gates", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-demo-guided-real-"));
    try {
      const repository = new InMemoryRealityRepository();
      const runtime = new MockCodexRuntime();
      const inspect = runtime.inspect.bind(runtime);
      runtime.inspect = async (reality, onEvent) => {
        const result = await inspect(reality, onEvent);
        if (reality.depth >= 2 && reality.worktreePath) {
          const enumeration = /enumeration|response oracle/i.test(reality.name);
          const artefactPath = enumeration
            ? "demo/password-reset/tests/enumeration.attack.spec.ts"
            : "demo/password-reset/tests/rotating-ip.attack.spec.ts";
          result.report.evidence.push({
            kind: "test",
            title: enumeration ? "Response-equivalence regression" : "Rotating-source regression",
            summary: enumeration
              ? "A deterministic response-equivalence regression reproduces the account-state oracle."
              : "A deterministic rotating-source regression reproduces the missing identifier budget.",
            source: "guided-real-test-runtime",
            artefactPath,
            synthetic: false
          });
          result.report.changedFiles.push(artefactPath);
          const attackPath = path.join(
            reality.worktreePath,
            artefactPath
          );
          await mkdir(path.dirname(attackPath), { recursive: true });
          await writeFile(attackPath, "it('retains a decisive rotating-source regression', () => {});");
        }
        return result;
      };
      Object.defineProperty(runtime, "mode", { value: "real" });
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        runtime,
        new FailFirstAnchorWorktreeManager(temp),
        new SynthesisService(),
        temp
      );

      const idle = await orchestrator.snapshot();
      expect(idle.session.autopilot.mode).toBe("off");
      expect(idle.events.some((event) => event.type === "autopilot.started")).toBe(false);

      await orchestrator.controlAutopilot({
        command: "start",
        paceMilliseconds: 250,
        maxActions: 20,
        maxMinutes: 30,
        pauseOnDream: true
      });
      let firstGate = await orchestrator.snapshot();
      for (let attempt = 0; attempt < 80 && firstGate.session.autopilot.mode === "running"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        firstGate = await orchestrator.snapshot();
      }
      expect(firstGate.session.autopilot).toMatchObject({
        mode: "paused",
        kind: "guided-real",
        actionsCompleted: 1
      });
      expect(firstGate.nextAction?.id).toBe("create_attack_dream");
      expect(firstGate.session.autopilot.pauseReason).toContain("explicit approval");

      await orchestrator.controlAutopilot({ command: "resume" });
      let nestedGate = await orchestrator.snapshot();
      for (let attempt = 0; attempt < 120 && nestedGate.session.autopilot.mode === "running"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        nestedGate = await orchestrator.snapshot();
      }
      expect(nestedGate.session.autopilot.mode).toBe("paused");
      expect(nestedGate.nextAction?.id).toBe("create_nested_dream");

      await orchestrator.controlAutopilot({ command: "resume" });
      let siblingGate = await orchestrator.snapshot();
      for (let attempt = 0; attempt < 160 && siblingGate.session.autopilot.mode === "running"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        siblingGate = await orchestrator.snapshot();
      }
      expect(siblingGate.session.autopilot.mode).toBe("paused");
      expect(siblingGate.nextAction?.id).toBe("create_nested_dream");

      await orchestrator.controlAutopilot({ command: "resume" });
      let interventionGate = await orchestrator.snapshot();
      for (let attempt = 0; attempt < 200 && interventionGate.session.autopilot.mode === "running"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        interventionGate = await orchestrator.snapshot();
      }
      expect(interventionGate.session.autopilot.mode).toBe("paused");
      expect(interventionGate.nextAction?.id).toBe("intervene");
      expect(interventionGate.session.autopilot.pauseReason).toContain("controlled intervention");

      await orchestrator.controlAutopilot({ command: "resume" });
      let proofGate = await orchestrator.snapshot();
      for (let attempt = 0; attempt < 200 && proofGate.session.autopilot.mode === "running"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        proofGate = await orchestrator.snapshot();
      }
      expect(proofGate.session.autopilot.mode).toBe("paused");
      expect(proofGate.nextAction?.id).toBe("repair");
      expect(proofGate.session.autopilot.pauseReason).toContain("immutable anchor failed");

      await orchestrator.controlAutopilot({ command: "resume" });
      let completed = await orchestrator.snapshot();
      for (let attempt = 0; attempt < 80 && completed.session.autopilot.mode === "running"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        completed = await orchestrator.snapshot();
      }
      expect(completed.session.autopilot.mode).toBe("completed");
      expect(completed.session.phase).toBe(10);
      expect(completed.events.some((event) => event.type === "autopilot.completed")).toBe(true);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }, 15_000);

  it("revalidates a legacy nested memory before synthesis", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-memory-revalidation-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const actions: DemoAction[] = [
        "inspect",
        "create_attack_dream",
        "enter_subjects",
        "discover_abuse",
        "create_nested_dream",
        "wake_nested",
        "create_nested_dream",
        "intervene",
        "wake_nested",
        "wake_parent"
      ];
      for (const action of actions) await orchestrator.act(action);
      const before = await orchestrator.snapshot();
      const nested = before.realities.find((reality) => reality.depth === 2)!;
      await repository.saveReality({
        ...nested,
        wakeReport: {
          ...nested.wakeReport!,
          realityId: nested.name,
          artefacts: [{
            ...nested.wakeReport!.artefacts[0]!,
            path: "nested-worktree-path-not-supplied"
          }]
        }
      });
      await rm(
        path.join(nested.worktreePath!, "demo/password-reset/tests/rotating-ip.attack.spec.ts"),
        { force: true }
      );

      const recovered = await orchestrator.act("synthesise");
      const recoveredNested = recovered.realities.find((reality) => reality.depth === 2)!;

      expect(recovered.session.phase).toBe(8);
      expect(recoveredNested.wakeReport?.realityId).toBe(recoveredNested.id);
      expect(recoveredNested.wakeReport?.artefacts[0]?.path).toBe(
        "demo/password-reset/tests/rotating-ip.attack.spec.ts"
      );
      expect(recovered.events.some((event) =>
        event.type === "validation.rejected"
        && event.payload.issues !== undefined
      )).toBe(true);
      expect(recovered.events.some((event) =>
        event.summary.includes("Nested memory revalidated")
      )).toBe(true);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("records only a concise validation event when a Wake Report is invalid", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-validation-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new InvalidWakeRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const actions: DemoAction[] = [
        "inspect",
        "create_attack_dream",
        "enter_subjects",
        "discover_abuse",
        "create_nested_dream"
      ];
      for (const action of actions) await orchestrator.act(action);

      await expect(orchestrator.act("wake_nested")).rejects.toThrow(
        "Memory could not return because the Wake Report failed validation."
      );
      const validationEvent = (await repository.listEvents()).at(-1);
      expect(validationEvent?.type).toBe("validation.rejected");
      expect(validationEvent?.payload).toEqual({ contract: "WakeReportSchema" });
      expect(JSON.stringify(validationEvent)).not.toContain("raw");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("does not admit a configuration failure as decisive counterfactual evidence", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-test-evidence-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new ConfigurationFailureWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const actions: DemoAction[] = [
        "inspect",
        "create_attack_dream",
        "enter_subjects",
        "discover_abuse",
        "create_nested_dream"
      ];
      for (const action of actions) await orchestrator.act(action);

      await expect(orchestrator.act("wake_nested")).rejects.toThrow(
        "configuration or environment failures cannot become evidence"
      );
      const snapshot = await orchestrator.snapshot();
      expect(snapshot.session.phase).toBe(5);
      expect(snapshot.realities.find((reality) => reality.depth === 2)?.wakeReport).toBeUndefined();
      expect(snapshot.events.some((event) =>
        event.type === "evidence.discovered"
        && event.payload.verdict === "failed-as-expected"
      )).toBe(false);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("rejects invalid inspection output instead of substituting scripted evidence", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-inspection-validation-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new InvalidInspectionRuntime(),
        new FakeWorktreeManager(temp),
        new SynthesisService(),
        temp
      );

      await expect(orchestrator.act("inspect")).rejects.toThrow(
        "Investigation Report could not enter the Reality because validation failed"
      );
      const events = await repository.listEvents();
      expect(events.at(-1)).toMatchObject({
        type: "validation.rejected",
        payload: {
          contract: "InvestigationReportSchema",
          issues: [{ path: "evidence", code: "invalid_type" }]
        }
      });
      expect((await repository.listRealities())[0]?.evidence).toHaveLength(0);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("retains the Codex thread and restores the waking baseline when inspection is rejected", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-inspection-transaction-"));
    try {
      const repository = new InMemoryRealityRepository();
      const worktrees = new FakeWorktreeManager(temp);
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new ThreadThenInvalidInspectionRuntime(),
        worktrees,
        new SynthesisService(),
        temp
      );

      await expect(orchestrator.act("inspect")).rejects.toThrow(
        "Investigation Report could not enter the Reality because validation failed"
      );

      const root = (await repository.listRealities())[0]!;
      const events = await repository.listEvents();
      expect(root.codexThreadId).toBe("thread-retained-after-rejection");
      expect(root.evidence).toHaveLength(0);
      expect(worktrees.restoreCalls).toBe(1);
      expect(events.some((event) =>
        event.type === "codex.thread.bound"
        && event.payload.threadId === "thread-retained-after-rejection"
      )).toBe(true);
      expect(events.some((event) =>
        event.type === "reality.recovered"
        && event.payload.validation !== undefined
      )).toBe(true);
      expect(events.at(-1)).toMatchObject({
        type: "validation.rejected",
        payload: {
          contract: "InvestigationReportSchema",
          issues: [{
            path: "subjectReports",
            code: "subject_identity_mismatch"
          }]
        }
      });
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("blocks stabilisation when a returned regression artefact still fails", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "inception-proof-gate-"));
    try {
      const repository = new InMemoryRealityRepository();
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        new MockCodexRuntime(),
        new FailingRegressionWorktreeManager(temp),
        new SynthesisService(),
        temp
      );
      const actions: DemoAction[] = [
        "inspect",
        "create_attack_dream",
        "enter_subjects",
        "discover_abuse",
        "create_nested_dream",
        "wake_nested",
        "create_nested_dream",
        "intervene",
        "wake_nested",
        "wake_parent",
        "synthesise",
        "run_anchors"
      ];
      for (const action of actions) await orchestrator.act(action);

      const fractured = await orchestrator.snapshot();
      expect(fractured.session.regressionResult?.status).toBe("failed");
      expect(fractured.nextAction?.id).toBe("repair");
      expect(fractured.events.some((event) => event.type === "reality.fractured")).toBe(true);
      await expect(orchestrator.act("stabilise")).rejects.toThrow("expected repair");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
