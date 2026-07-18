import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockCodexRuntime } from "@inception/codex-runtime";
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
  async writeFile(worktreePath: string, relativePath: string, content: string): Promise<void> {
    const target = path.join(worktreePath, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  async diff(): Promise<string> { return "diff --git a/password-reset.ts b/password-reset.ts\n+layered controls"; }
  async run(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return { stdout: "3 tests passed", stderr: "", exitCode: 0 };
  }
}

describe("RealityOrchestrator", () => {
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
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
