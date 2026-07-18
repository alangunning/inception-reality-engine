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
    return [
      "demo/password-reset/src/password-reset.ts",
      "demo/password-reset/tests/rotating-ip.attack.spec.ts"
    ];
  }
  async diff(): Promise<string> { return "diff --git a/password-reset.ts b/password-reset.ts\n+layered controls"; }
  async checkpoint(): Promise<string> { return "a".repeat(40); }
  async currentCommit(): Promise<string> { return "a".repeat(40); }
  async isClean(): Promise<boolean> { return true; }
  async sealChanges(): Promise<string> { return "b".repeat(40); }
  async restoreCheckpoint(): Promise<void> {}
  async run(_worktreePath: string, _command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (args.some((arg) => arg.includes("rotating-ip.attack.spec.ts"))) {
      return { stdout: "1 test failed", stderr: "", exitCode: 1 };
    }
    return { stdout: "3 tests passed", stderr: "", exitCode: 0 };
  }
}

class InvalidWakeRuntime extends MockCodexRuntime implements CodexRuntime {
  override async wake(_reality: Reality): Promise<CodexWakeResult> {
    throw new WakeReportValidationError();
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

class FailingRegressionWorktreeManager extends FakeWorktreeManager {
  override async run(worktreePath: string, command: string, args: string[]) {
    if (args.includes("demo/password-reset/tests")) {
      return { stdout: "1 inherited test failed", stderr: "", exitCode: 1 };
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
      const orchestrator = new RealityOrchestrator(
        repository,
        new InMemoryRealityEventBus(),
        runtime,
        new FakeWorktreeManager(temp),
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
        "wake_parent",
        "synthesise",
        "run_anchors",
        "stabilise"
      ];
      for (const action of actions) await orchestrator.act(action);

      const snapshot = await orchestrator.snapshot();
      expect(snapshot.session.phase).toBe(10);
      expect(snapshot.realities).toHaveLength(3);
      expect(snapshot.realities.map((reality) => reality.depth)).toEqual([0, 1, 2]);
      expect(snapshot.realities.filter((reality) => reality.wakeReport)).toHaveLength(2);
      expect(snapshot.activeReality?.status).toBe("stabilised");
      expect(snapshot.session.anchorResults.every((anchor) => anchor.status === "passed")).toBe(true);
      expect(snapshot.session.finalDiff).toContain("layered controls");
      expect(snapshot.events.some((event) => event.type === "memory.returned")).toBe(true);
      expect(snapshot.events.filter((event) => event.type === "memory.verified")).toHaveLength(2);
      expect(snapshot.session.memoryIntegrity).toHaveLength(2);
      const deepestSeal = snapshot.session.memoryIntegrity.find((seal) =>
        snapshot.realities.find((reality) => reality.id === seal.realityId)?.depth === 2
      )!;
      const parentSeal = snapshot.session.memoryIntegrity.find((seal) =>
        snapshot.realities.find((reality) => reality.id === seal.realityId)?.depth === 1
      )!;
      expect(deepestSeal.verdict).toBe("verified");
      expect(parentSeal.descendantSealIds).toContain(deepestSeal.id);
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
