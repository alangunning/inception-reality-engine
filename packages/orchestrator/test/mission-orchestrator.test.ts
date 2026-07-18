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
    return [];
  }
  async diff(): Promise<string> {
    return "";
  }
  async run(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return { stdout: "passed", stderr: "", exitCode: 0 };
  }
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
    snapshot = await orchestrator.act(snapshot.run.id, "kick");
    expect(snapshot.activeReality.depth).toBe(0);
    expect(snapshot.run.memories).toHaveLength(2);
    expect(snapshot.nextAction?.id).toBe("synthesise");
    expect(await repository.getMissionRun(snapshot.run.id)).not.toBeNull();
  });
});
