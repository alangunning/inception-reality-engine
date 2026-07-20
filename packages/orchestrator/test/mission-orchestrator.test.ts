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
  cleanupCalls = 0;
  dirtyWorktrees = new Set<string>();
  missingWorktrees = new Set<string>();
  readonly createCalls: Array<{
    realityId: string;
    baseRef?: string;
    parentWorktreePath?: string;
  }> = [];
  readonly commands: Array<{ worktreePath: string; command: string; args: string[] }> = [];
  failDependencyInstall = false;

  async discoverRepoRoot(): Promise<string> {
    return "/repo";
  }
  async create(
    realityId: string,
    baseRef?: string,
    parentWorktreePath?: string
  ): Promise<WorktreeDescriptor> {
    this.createCalls.push({ realityId, baseRef, parentWorktreePath });
    const descriptor = {
      path: `/mission-worktrees/${realityId}`,
      branchName: `mission/${realityId}`
    };
    this.missingWorktrees.delete(descriptor.path);
    return descriptor;
  }
  async remove(): Promise<void> {}
  async cleanupAll(): Promise<number> {
    this.cleanupCalls += 1;
    return 1;
  }
  async isPresent(worktreePath?: string): Promise<boolean> {
    return worktreePath !== undefined && !this.missingWorktrees.has(worktreePath);
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
    for (const changedFile of this.changedFiles) {
      for (const key of this.files.keys()) {
        if (key.endsWith(`/${changedFile}`)) this.files.delete(key);
      }
    }
    this.changedFiles = [];
    this.changedDiff = "";
  }
  async run(
    worktreePath: string,
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.commands.push({ worktreePath, command, args });
    if ((command === "python3" || command === "python") && args[0] === "--version") {
      return { stdout: "Python 3.12.10", stderr: "", exitCode: 0 };
    }
    if (command === "node" && args[0] === "--version") {
      return { stdout: "v22.15.0", stderr: "", exitCode: 0 };
    }
    if (command === ".venv/bin/python" && args.includes("--format=json")) {
      return {
        stdout: JSON.stringify([
          { name: "Flask", version: "2.2.2" },
          { name: "Werkzeug", version: "2.2.3" }
        ]),
        stderr: "",
        exitCode: 0
      };
    }
    if (
      this.failDependencyInstall
      && command === ".venv/bin/python"
      && args[0] === "-m"
      && args[1] === "pip"
    ) {
      return { stdout: "", stderr: "dependency install failed", exitCode: 1 };
    }
    return { stdout: "passed", stderr: "", exitCode: 0 };
  }
}

function basicMission() {
  return {
    name: "Authorization review",
    repositoryPath: "/repo",
    mission: "Find the smallest authorization uncertainty without changing the Reality baseline.",
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

function realRuntime(mock = new MockCodexRuntime()): CodexRuntime {
  return {
    mode: "real",
    info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
    activeOperations: () => [],
    abortAll: () => 0,
    inspect: (...args) => mock.inspect(...args),
    intervene: (...args) => mock.intervene(...args),
    wake: (...args) => mock.wake(...args),
    synthesise: (reality, reports, onEvent) => mock.synthesise(reality, reports, onEvent)
  };
}

describe("MissionOrchestrator", () => {
  it("compares sibling Dreams and admits only conclusions that survive the Reality Mirror", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      ...basicMission(),
      dreamStrategy: "competing-siblings",
      maxSiblingDreams: 2,
      maxDreamDepth: 1
    });

    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    expect(snapshot.activeReality.proposals).toHaveLength(2);
    for (let sibling = 0; sibling < 2; sibling += 1) {
      snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
      snapshot = await orchestrator.act(snapshot.run.id, "inspect");
      snapshot = await orchestrator.act(snapshot.run.id, "kick");
      const returnedDream = snapshot.run.realities
        .filter((reality) => reality.depth === 1)
        .at(-1);
      expect(returnedDream?.proposals.every((proposal) => proposal.status === "resolved"))
        .toBe(true);
    }

    expect(snapshot.run.realities.filter((reality) => reality.parentId === snapshot.activeReality.id))
      .toHaveLength(2);
    expect(snapshot.run.reflections).toHaveLength(1);
    expect(snapshot.run.reflections[0]).toMatchObject({
      parentRealityId: snapshot.activeReality.id,
      realityIds: expect.arrayContaining(
        snapshot.run.realities
          .filter((reality) => reality.depth === 1)
          .map((reality) => reality.id)
      )
    });
    expect(snapshot.run.reflections[0]?.evidenceMatrix).toHaveLength(2);
    expect(snapshot.run.events.some((event) => event.type === "reflection.created")).toBe(true);
    expect(snapshot.nextAction?.id).toBe("synthesise");

    snapshot = await orchestrator.act(snapshot.run.id, "synthesise");
    snapshot = await orchestrator.act(snapshot.run.id, "verify");
    snapshot = await orchestrator.act(snapshot.run.id, "stabilise");
    expect(snapshot.run.realities.every((reality) =>
      reality.proposals.every((proposal) => proposal.status === "resolved")
    )).toBe(true);
    expect(snapshot.run.outcome).toMatchObject({
      metrics: {
        realitiesExplored: 2,
        maximumDepth: 1,
        memoriesVerified: 2,
        memoriesQuarantined: 0,
        interventionsDetected: 0,
        interventionsMissed: 0,
        proofsPassed: 1,
        proofsTotal: 1
      }
    });
    expect(snapshot.run.events.find((event) => event.type === "synthesis.completed")?.payload)
      .toMatchObject({
        siblingReflectionCount: 1,
        conclusionPolicy: "shared-invariants-only"
      });
  });

  it("forms a recursive sibling graph at every configured Dream level", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      ...basicMission(),
      dreamStrategy: "competing-siblings",
      maxSiblingDreams: 2,
      maxDreamDepth: 2
    });

    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    for (let rootSibling = 0; rootSibling < 2; rootSibling += 1) {
      snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
      const depthOneId = snapshot.activeReality.id;
      snapshot = await orchestrator.act(snapshot.run.id, "inspect");
      for (let nestedSibling = 0; nestedSibling < 2; nestedSibling += 1) {
        snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
        snapshot = await orchestrator.act(snapshot.run.id, "inspect");
        snapshot = await orchestrator.act(snapshot.run.id, "kick");
        expect(snapshot.activeReality.id).toBe(depthOneId);
      }
      snapshot = await orchestrator.act(snapshot.run.id, "kick");
      expect(snapshot.activeReality.depth).toBe(0);
    }

    const waking = snapshot.run.realities.find((reality) => reality.depth === 0)!;
    const depthOne = snapshot.run.realities.filter((reality) => reality.parentId === waking.id);
    const depthTwo = snapshot.run.realities.filter((reality) => reality.depth === 2);
    expect(snapshot.run.realities).toHaveLength(7);
    expect(depthOne).toHaveLength(2);
    expect(depthTwo).toHaveLength(4);
    for (const parent of depthOne) {
      expect(depthTwo.filter((reality) => reality.parentId === parent.id)).toHaveLength(2);
    }
    expect(snapshot.run.reflections).toHaveLength(3);
    expect(snapshot.nextAction?.id).toBe("synthesise");
  });

  it("runs guided real auto mode only after explicit start and pauses at a Dream gate", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    const created = await orchestrator.create({
      ...basicMission(),
      maxDreamDepth: 1
    });
    expect(created.run.autopilot.mode).toBe("off");
    expect(created.run.events.some((event) => event.type === "autopilot.started")).toBe(false);

    await orchestrator.controlAutopilot(created.run.id, {
      command: "start",
      options: { maxActions: 10, maxMinutes: 5 }
    });
    let paused = await orchestrator.snapshot(created.run.id);
    for (let attempt = 0; attempt < 50 && paused.run.autopilot.mode === "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      paused = await orchestrator.snapshot(created.run.id);
    }
    expect(paused.run.autopilot).toMatchObject({
      mode: "paused",
      actionsCompleted: 1
    });
    expect(paused.nextAction?.id).toBe("create_dream");
    expect(paused.run.events.some((event) => event.type === "autopilot.paused")).toBe(true);

    const fractured = await repository.getMissionRun(created.run.id);
    expect(fractured).not.toBeNull();
    fractured!.status = "fractured";
    await repository.saveMissionRun(fractured!);
    await orchestrator.controlAutopilot(created.run.id, { command: "resume" });
    let completed = await orchestrator.snapshot(created.run.id);
    for (let attempt = 0; attempt < 100 && completed.run.autopilot.mode === "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      completed = await orchestrator.snapshot(created.run.id);
    }
    expect(completed.run.autopilot.mode).toBe("completed");
    expect(completed.run.status).toBe("stabilised");
    expect(completed.run.events.some((event) => event.type === "autopilot.completed")).toBe(true);
    expect(completed.run.events.some((event) =>
      event.type === "reality.recovered"
      && event.payload.recovery === "explicit-retry"
    )).toBe(true);
  });

  it("clears a transient fracture after a manual retry succeeds", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      ...basicMission(),
      maxDreamDepth: 1
    });
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");

    const fractured = await repository.getMissionRun(snapshot.run.id);
    expect(fractured).not.toBeNull();
    fractured!.status = "fractured";
    await repository.saveMissionRun(fractured!);

    snapshot = await orchestrator.act(snapshot.run.id, "kick");
    expect(snapshot.run.status).toBe("exploring");
    expect(snapshot.run.events.some((event) =>
      event.type === "reality.recovered"
      && event.payload.recovery === "successful-action"
    )).toBe(true);
  });

  it("records an unchanged auto-mode pause only once", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    const created = await orchestrator.create(basicMission());
    const pausable = orchestrator as unknown as {
      pauseAutopilot(
        run: typeof created.run,
        reality: typeof created.activeReality,
        reason: string
      ): Promise<void>;
    };
    const reason = "Reality fractured; inspect the validated failure before continuing.";

    await pausable.pauseAutopilot(created.run, created.activeReality, reason);
    await pausable.pauseAutopilot(created.run, created.activeReality, reason);

    const paused = await orchestrator.snapshot(created.run.id);
    expect(paused.run.events.filter((event) =>
      event.type === "autopilot.paused" && event.payload.reason === reason
    )).toHaveLength(1);
  });

  it("increases Mission limits without resetting action or token evidence", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    const created = await orchestrator.create(basicMission());

    const approved = await orchestrator.approveLimits(created.run.id, {
      tokenBudget: 200_000,
      maxActions: 70,
      maxMinutes: 180
    });

    expect(approved.run.definition.tokenBudget).toBe(200_000);
    expect(approved.run.autopilot).toMatchObject({
      maxActions: 70,
      maxMinutes: 180,
      actionsCompleted: 0
    });
    expect(approved.run.events.at(-1)).toMatchObject({
      type: "mission.limits.approved",
      payload: {
        previous: {
          tokenBudget: 100_000,
          maxActions: 60,
          maxMinutes: 180
        },
        approved: {
          tokenBudget: 200_000,
          maxActions: 70,
          maxMinutes: 180
        }
      }
    });
    await expect(orchestrator.approveLimits(created.run.id, {
      tokenBudget: 100_000,
      maxActions: 70,
      maxMinutes: 180
    })).rejects.toThrow("Approve a Mission token ceiling");
  });

  it("reforms a missing unsynthesised root worktree before retrying its action", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    const created = await orchestrator.create(basicMission());
    worktrees.missingWorktrees.add(created.activeReality.worktreePath!);

    const inspected = await orchestrator.act(created.run.id, "inspect");

    expect(worktrees.createCalls).toHaveLength(2);
    expect(worktrees.createCalls.at(-1)).toEqual({
      realityId: created.activeReality.id,
      baseRef: "HEAD",
      parentWorktreePath: "/repo"
    });
    expect(inspected.run.events).toContainEqual(expect.objectContaining({
      type: "reality.recovered",
      payload: expect.objectContaining({
        recovery: "root-baseline"
      })
    }));
    expect(inspected.activeReality.codexThreadId).not.toMatch(/^unbound:/);
  });

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

  it("bootstraps a Python environment inside the configured Dream before Codex enters it", async () => {
    const mock = new MockCodexRuntime();
    let inspections = 0;
    const runtime: CodexRuntime = {
      ...realRuntime(mock),
      inspect: async (...args) => {
        inspections += 1;
        return mock.inspect(...args);
      }
    };
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      ...basicMission(),
      maxDreamDepth: 1,
      dependencyBootstrap: {
        kind: "python-venv",
        manifestPath: "requirements-reality.txt",
        pythonExecutable: "auto",
        virtualEnvironmentPath: ".venv",
        indexUrl: "https://pypi.org/simple",
        targetDepth: 1
      }
    });
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    expect(snapshot.run.events.some((event) => event.type.startsWith("environment.bootstrap.")))
      .toBe(false);

    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
    worktrees.files.set(
      `${snapshot.activeReality.worktreePath}/requirements-reality.txt`,
      "Flask==2.2.2\nWerkzeug==2.2.3\n"
    );
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");

    const environmentEvents = snapshot.run.events.filter((event) =>
      event.type.startsWith("environment.bootstrap.")
    );
    expect(environmentEvents.map((event) => event.type)).toEqual([
      "environment.bootstrap.started",
      "environment.bootstrap.completed"
    ]);
    expect(environmentEvents[1]?.payload).toMatchObject({
      phase: "inspection",
      status: "completed",
      packageCount: 2,
      runtimeVersion: "3.12.10",
      dependencyPath: ".venv",
      reused: false
    });
    expect(worktrees.commands).toContainEqual({
      worktreePath: snapshot.activeReality.worktreePath,
      command: "python3",
      args: ["-m", "venv", ".venv"]
    });
    expect(inspections).toBe(2);
  });

  it("stops a required dependency-backed Dream before Codex when its bootstrap fails", async () => {
    const mock = new MockCodexRuntime();
    let inspections = 0;
    const runtime: CodexRuntime = {
      ...realRuntime(mock),
      inspect: async (...args) => {
        inspections += 1;
        return mock.inspect(...args);
      }
    };
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      runtime,
      { open: async () => ({ repoRoot: "/repo", worktrees }) }
    );
    let snapshot = await orchestrator.create({
      ...basicMission(),
      maxDreamDepth: 1,
      dependencyBootstrap: {
        kind: "python-venv",
        manifestPath: "requirements-reality.txt",
        pythonExecutable: "auto",
        virtualEnvironmentPath: ".venv",
        indexUrl: "https://pypi.org/simple",
        targetDepth: 1
      }
    });
    snapshot = await orchestrator.act(snapshot.run.id, "inspect");
    snapshot = await orchestrator.act(snapshot.run.id, "create_dream");
    worktrees.files.set(
      `${snapshot.activeReality.worktreePath}/requirements-reality.txt`,
      "Flask==2.2.2\n"
    );
    worktrees.failDependencyInstall = true;

    await expect(orchestrator.act(snapshot.run.id, "inspect"))
      .rejects.toThrow("Reality-local dependency bootstrap failed");
    const failed = await orchestrator.snapshot(snapshot.run.id);
    expect(failed.run.status).toBe("fractured");
    expect(failed.nextAction?.id).toBe("inspect");
    expect(failed.run.events.some((event) => event.type === "environment.bootstrap.failed"))
      .toBe(true);
    expect(inspections).toBe(1);
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
        await worktrees.writeFile(
          reality.worktreePath!,
          "src/sealed-intervention.ts",
          "export const permissionRegression = true;\n"
        );
        return mock.intervene(reality, contract, onEvent);
      },
      wake: async (reality, onEvent) => {
        const result = await mock.wake(reality, onEvent);
        return {
          ...result,
          report: {
            ...result.report,
            artefacts: [
              ...result.report.artefacts,
              {
                name: "Injected permission regression",
                path: "src/sealed-intervention.ts",
                kind: "patch" as const,
                summary: "The adversarial mutation must never leave this Dream.",
                content: "export const permissionRegression = true;\n"
              }
            ]
          }
        };
      },
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
    expect(snapshot.activeReality.codexThreadId).toBe(`mock-thread-${snapshot.activeReality.id}`);
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
    expect(revealed.containedAt).toBeTruthy();
    expect(revealed.excludedArtefactPaths).toEqual(["src/sealed-intervention.ts"]);
    expect(snapshot.run.memories[0]?.artefacts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "src/sealed-intervention.ts" })
    ]));
    expect(worktrees.restoreCalls).toBe(2);
    expect(snapshot.run.events.some((event) => event.type === "intervention.revealed")).toBe(true);
    expect(snapshot.run.events.some((event) => event.type === "intervention.contained")).toBe(true);

    snapshot = await orchestrator.act(snapshot.run.id, "synthesise");
    const root = snapshot.run.realities.find((entry) => entry.kind === "waking")!;
    expect(worktrees.files.has(`${root.worktreePath}/src/sealed-intervention.ts`)).toBe(false);
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

  it("persists an explicit intervention budget increase and retries from a restored Dream", async () => {
    const mock = new MockCodexRuntime();
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    let interventionAttempts = 0;
    const runtime: CodexRuntime = {
      mode: "real",
      info: () => ({ mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }),
      activeOperations: () => [],
      abortAll: () => 0,
      inspect: (...args) => mock.inspect(...args),
      intervene: async (reality, contract, onEvent) => {
        interventionAttempts += 1;
        worktrees.changedFiles = ["src/sealed-intervention.ts"];
        worktrees.changedDiff = "+bounded permission regression\n";
        const result = await mock.intervene(reality, contract, onEvent);
        return {
          ...result,
          events: [
            ...result.events,
            {
              type: "progress",
              summary: "Bounded intervention token usage recorded.",
              metadata: {
                stage: "turn",
                status: "completed",
                inputTokens: 12_000,
                outputTokens: 6_000
              }
            }
          ]
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
      ...basicMission(),
      intervention: {
        enabled: true,
        subject: { name: "Mal", role: "Bounded chaos engineer", mission: "Inject one reversible fault." },
        hypothesis: "A bounded permission fault remains diagnosable.",
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

    await expect(orchestrator.act(snapshot.run.id, "intervene"))
      .rejects.toThrow(/intervention_token_budget_exceeded/);
    let rejected = await orchestrator.snapshot(snapshot.run.id);
    expect(rejected.run.interventions[0]).toMatchObject({
      status: "rejected",
      rejectionCode: "intervention_token_budget_exceeded",
      lastAttemptTokens: 18_000
    });
    expect(rejected.run.observedTokens).toBe(18_000);
    expect(worktrees.restoreCalls).toBe(2);

    await orchestrator.controlAutopilot(snapshot.run.id, {
      command: "start",
      options: { maxActions: 1, maxMinutes: 5 }
    });
    for (let attempt = 0; attempt < 50 && rejected.run.autopilot.mode !== "paused"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      rejected = await orchestrator.snapshot(snapshot.run.id);
    }
    expect(rejected.run.autopilot.mode).toBe("paused");

    await orchestrator.approveInterventionBudget(snapshot.run.id, {
      tokenBudget: 32_000,
      retry: true
    });
    let retried = await orchestrator.snapshot(snapshot.run.id);
    for (let attempt = 0; attempt < 100 && retried.run.autopilot.mode === "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      retried = await orchestrator.snapshot(snapshot.run.id);
    }

    expect(interventionAttempts).toBe(2);
    expect(retried.run.definition.intervention?.tokenBudget).toBe(32_000);
    expect(retried.run.interventions[0]).toMatchObject({
      status: "sealed",
      lastAttemptTokens: 18_000,
      budgetApprovals: [{
        previousTokenBudget: 10_000,
        approvedTokenBudget: 32_000,
        failedAttemptTokens: 18_000
      }]
    });
    expect(retried.run.autopilot).toMatchObject({
      mode: "paused",
      actionsCompleted: 1
    });
    expect(retried.run.events.find((event) =>
      event.type === "intervention.budget.approved"
    )?.payload).toMatchObject({
      previousTokenBudget: 10_000,
      approvedTokenBudget: 32_000,
      failedAttemptTokens: 18_000,
      retry: true
    });
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
        await worktrees.writeFile(
          reality.worktreePath!,
          "src/sealed-intervention.ts",
          "permission regression\n"
        );
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

  it("admits native opportunistic Subjects and restores the root filesystem baseline", async () => {
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
          summary: "Codex thread entered the Reality worktree.",
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
          summary: "Codex thread entered the Reality worktree.",
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
          summary: "Authorization review returned from Reality.",
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
          summary: "Codex thread entered the Reality worktree.",
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

  it("resets one Mission from its definition and can clean up every saved Mission", async () => {
    const repository = new InMemoryRealityRepository();
    const worktrees = new FakeMissionWorktrees();
    let orphanCleanupCalls = 0;
    const orchestrator = new MissionOrchestrator(
      repository,
      new InMemoryRealityEventBus(),
      realRuntime(),
      {
        open: async () => ({ repoRoot: "/repo", worktrees }),
        cleanupAll: async () => {
          orphanCleanupCalls += 1;
          return 0;
        }
      }
    );
    const original = await orchestrator.create(basicMission());

    const replacement = await orchestrator.reset(original.run.id);

    expect(replacement.run.id).not.toBe(original.run.id);
    expect(replacement.run.definition).toMatchObject({
      name: original.run.definition.name,
      mission: original.run.definition.mission,
      tokenBudget: original.run.definition.tokenBudget,
      maxDreamDepth: original.run.definition.maxDreamDepth
    });
    expect(replacement.run.realities).toHaveLength(1);
    expect(replacement.run.events).toHaveLength(1);
    expect(await repository.getMissionRun(original.run.id)).toBeNull();
    expect(await repository.listMissionRuns()).toHaveLength(1);
    expect(worktrees.cleanupCalls).toBe(1);

    await orchestrator.create({
      ...basicMission(),
      name: "Second authorization review"
    });
    const deleted = await orchestrator.deleteAll();

    expect(deleted).toEqual({
      deletedMissions: 2,
      removedWorktrees: 2
    });
    expect(await repository.listMissionRuns()).toHaveLength(0);
    expect(worktrees.cleanupCalls).toBe(3);
    expect(orphanCleanupCalls).toBe(1);
  });
});
