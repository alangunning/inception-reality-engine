import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MockCodexRuntime,
  WakeReportValidationError,
  type CodexExecutionResult,
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexWakeResult
} from "@inception/codex-runtime";
import type { Reality } from "@inception/domain";
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
  async writeFile(worktreePath: string, relativePath: string, content: string): Promise<void> {
    const target = path.join(worktreePath, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  async diff(): Promise<string> { return "diff --git a/password-reset.ts b/password-reset.ts\n+layered controls"; }
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
});
