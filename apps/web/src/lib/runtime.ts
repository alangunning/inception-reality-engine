import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  CodexProcessControl,
  DEFAULT_CODEX_MODEL,
  MockCodexRuntime,
  RealCodexRuntime
} from "@inception/codex-runtime";
import {
  type CodexRuntime,
  InMemoryRealityEventBus,
  MissionOrchestrator,
  PrismaRealityRepository,
  RealityOrchestrator,
  SqliteRealityRepository,
  SynthesisService,
  type DemoSnapshot,
  type InceptionPrismaClient,
  type RealityRepository
} from "@inception/orchestrator";
import {
  GitMissionWorkspaceFactory,
  GitWorktreeManager,
  TrainingTargetManager
} from "@inception/worktree-manager";

interface RuntimeContainer {
  implementationVersion: string;
  persistence: "prisma" | "sqlite-fallback";
  codexMode: "mock" | "real";
  eventBus: InMemoryRealityEventBus;
  missionEventBus: InMemoryRealityEventBus;
  codexRuntime: CodexRuntime;
  orchestrator: RealityOrchestrator;
  missionOrchestrator: MissionOrchestrator;
  trainingTargets: TrainingTargetManager;
  processControl: CodexProcessControl;
  disconnect(): Promise<void>;
}

declare global {
  var __inceptionRuntime: RuntimeContainer | undefined;
}

const requireModule = createRequire(import.meta.url);
const RUNTIME_IMPLEMENTATION_VERSION = "0.1.0-20260719.16";

function upgradeRuntimeCapabilities(
  candidate: CodexRuntime,
  mode: RuntimeContainer["codexMode"]
): CodexRuntime {
  const legacy = candidate as CodexRuntime & {
    info?: CodexRuntime["info"];
    activeOperations?: CodexRuntime["activeOperations"];
    abortAll?: CodexRuntime["abortAll"];
  };
  legacy.info ??= () => ({
    mode,
    model: mode === "real"
      ? process.env.INCEPTION_CODEX_MODEL?.trim() || DEFAULT_CODEX_MODEL
      : "deterministic-mock",
    sdkVersion: "0.144.6",
    authSource: "none"
  });
  legacy.activeOperations ??= () => [];
  legacy.abortAll ??= () => 0;
  return legacy;
}

function discoverRepoRoot(): string {
  if (process.env.INCEPTION_REPO_ROOT) return process.env.INCEPTION_REPO_ROOT;
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() }).toString().trim();
}

function sqliteFilename(repoRoot: string): string {
  const url = process.env.DATABASE_URL ?? `file:${repoRoot}/prisma/dev.db`;
  if (!url.startsWith("file:")) {
    throw new Error("The portable SQLite repository requires a file: DATABASE_URL.");
  }
  const filename = url.startsWith("file:") ? url.slice("file:".length) : url;
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(repoRoot, filename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function normalisedDatabaseUrl(repoRoot: string): string {
  const url = process.env.DATABASE_URL ?? `file:${repoRoot}/prisma/dev.db`;
  return url.startsWith("file:") ? `file:${sqliteFilename(repoRoot)}` : url;
}

function worktreeRoot(repoRoot: string): string {
  const configured = process.env.INCEPTION_WORKTREE_ROOT?.trim();
  if (!configured) return path.join(repoRoot, ".inception", "worktrees");
  return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
}

function createCodexRuntime(
  mode: RuntimeContainer["codexMode"],
  repoRoot: string
): CodexRuntime {
  const configuredHome = process.env.INCEPTION_CODEX_RUNTIME_HOME?.trim();
  const runtimeCodexHome = configuredHome
    ? path.isAbsolute(configuredHome)
      ? configuredHome
      : path.resolve(repoRoot, configuredHome)
    : path.join(repoRoot, ".inception", "codex-home");
  return mode === "real"
    ? new RealCodexRuntime({
        runtimeCodexHome
      })
    : new MockCodexRuntime();
}

function createRepository(repoRoot: string): {
  repository: RealityRepository;
  persistence: RuntimeContainer["persistence"];
  disconnect(): Promise<void>;
} {
  if (process.env.INCEPTION_PERSISTENCE !== "sqlite") {
    try {
      const prismaClientModule = requireModule("@prisma/client") as {
        PrismaClient?: new (options: { adapter: PrismaLibSql }) => InceptionPrismaClient;
      };
      const PrismaClient = prismaClientModule.PrismaClient;
      if (!PrismaClient) {
        throw new Error("Generated Prisma client is unavailable");
      }
      if (normalisedDatabaseUrl(repoRoot).startsWith("file:")) {
        const schemaBootstrap = new SqliteRealityRepository(sqliteFilename(repoRoot));
        schemaBootstrap.close();
      }
      const adapter = new PrismaLibSql({
        url: normalisedDatabaseUrl(repoRoot)
      });
      const prisma = new PrismaClient({ adapter });
      if (
        !prisma.realityRecord
        || !prisma.realityEventRecord
        || !prisma.demoSessionRecord
        || !prisma.realityRunArchiveRecord
        || !prisma.missionRunRecord
        || !prisma.missionEventRecord
      ) {
        throw new Error("Generated Prisma models are unavailable");
      }
      return {
        repository: new PrismaRealityRepository(prisma),
        persistence: "prisma",
        disconnect: async () => { await prisma.$disconnect?.(); }
      };
    } catch (error) {
      if (process.env.INCEPTION_PERSISTENCE === "prisma") throw error;
      console.warn("Prisma client is not generated; using the deterministic SQLite fallback repository.");
    }
  }

  const repository = new SqliteRealityRepository(sqliteFilename(repoRoot));
  return {
    repository,
    persistence: "sqlite-fallback",
    disconnect: async () => repository.close()
  };
}

export function getRuntime(): RuntimeContainer {
  if (globalThis.__inceptionRuntime) {
    const existing = globalThis.__inceptionRuntime;
    if (existing.implementationVersion !== RUNTIME_IMPLEMENTATION_VERSION) {
      const legacyOrchestrator = existing.orchestrator as unknown as {
        repository?: RealityRepository;
        worktrees?: GitWorktreeManager;
        synthesis?: SynthesisService;
        repoRoot?: string;
      };
      if (!legacyOrchestrator.repository) {
        throw new Error("The live Reality repository is unavailable for runtime migration.");
      }
      const repoRoot = legacyOrchestrator.repoRoot ?? discoverRepoRoot();
      const persistence = createRepository(repoRoot);
      const repository = persistence.repository;
      const codexRuntime = createCodexRuntime(existing.codexMode, repoRoot);
      const worktrees = new GitWorktreeManager(
        repoRoot,
        worktreeRoot(repoRoot),
        process.env.INCEPTION_BRANCH_PREFIX?.trim() || "inception"
      );
      existing.codexRuntime = codexRuntime;
      existing.orchestrator = new RealityOrchestrator(
        repository,
        existing.eventBus,
        codexRuntime,
        worktrees,
        legacyOrchestrator.synthesis ?? new SynthesisService(),
        repoRoot
      );
      existing.missionEventBus ??= new InMemoryRealityEventBus();
      const missionRepository = typeof repository.getMissionRun === "function"
        ? repository
        : new SqliteRealityRepository(sqliteFilename(repoRoot));
      existing.missionOrchestrator = new MissionOrchestrator(
        missionRepository,
        existing.missionEventBus,
        codexRuntime,
        new GitMissionWorkspaceFactory(path.join(repoRoot, ".inception", "missions"))
      );
      existing.trainingTargets = new TrainingTargetManager(
        path.join(repoRoot, ".inception", "training-targets")
      );
      existing.persistence = persistence.persistence;
      existing.disconnect = persistence.disconnect;
      existing.implementationVersion = RUNTIME_IMPLEMENTATION_VERSION;
      return existing;
    }
    const legacyRuntime = existing.codexRuntime ?? (existing.orchestrator as unknown as {
      codexRuntime?: CodexRuntime;
    }).codexRuntime;
    existing.codexRuntime = upgradeRuntimeCapabilities(
      legacyRuntime ?? createCodexRuntime(existing.codexMode, discoverRepoRoot()),
      existing.codexMode
    );
    if (!existing.missionEventBus) {
      existing.missionEventBus = new InMemoryRealityEventBus();
    }
    if (!existing.missionOrchestrator) {
      const liveRepository = (existing.orchestrator as unknown as {
        repository?: RealityRepository;
      }).repository;
      if (!liveRepository) {
        throw new Error("The live Reality repository is unavailable for Mission Composer.");
      }
      const repoRoot = discoverRepoRoot();
      const repository = typeof liveRepository.getMissionRun === "function"
        ? liveRepository
        : new SqliteRealityRepository(sqliteFilename(repoRoot));
      existing.missionOrchestrator = new MissionOrchestrator(
        repository,
        existing.missionEventBus,
        existing.codexRuntime,
        new GitMissionWorkspaceFactory(path.join(repoRoot, ".inception", "missions"))
      );
    }
    existing.trainingTargets ??= new TrainingTargetManager(
      path.join(discoverRepoRoot(), ".inception", "training-targets")
    );
    return existing;
  }
  const repoRoot = discoverRepoRoot();
  const persistence = createRepository(repoRoot);
  const eventBus = new InMemoryRealityEventBus();
  const missionEventBus = new InMemoryRealityEventBus();
  const codexMode = process.env.INCEPTION_CODEX_MODE === "real" ? "real" : "mock";
  const codexRuntime = createCodexRuntime(codexMode, repoRoot);
  const worktrees = new GitWorktreeManager(
    repoRoot,
    worktreeRoot(repoRoot),
    process.env.INCEPTION_BRANCH_PREFIX?.trim() || "inception"
  );
  const orchestrator = new RealityOrchestrator(
    persistence.repository,
    eventBus,
    codexRuntime,
    worktrees,
    new SynthesisService(),
    repoRoot
  );
  const missionOrchestrator = new MissionOrchestrator(
    persistence.repository,
    missionEventBus,
    codexRuntime,
    new GitMissionWorkspaceFactory(path.join(repoRoot, ".inception", "missions"))
  );
  const trainingTargets = new TrainingTargetManager(
    path.join(repoRoot, ".inception", "training-targets")
  );
  globalThis.__inceptionRuntime = {
    implementationVersion: RUNTIME_IMPLEMENTATION_VERSION,
    persistence: persistence.persistence,
    codexMode,
    eventBus,
    missionEventBus,
    codexRuntime,
    orchestrator,
    missionOrchestrator,
    trainingTargets,
    processControl: new CodexProcessControl(),
    disconnect: persistence.disconnect
  };
  return globalThis.__inceptionRuntime;
}

export type PresentedDemoSnapshot = DemoSnapshot & {
  runtime: {
    codexMode: RuntimeContainer["codexMode"];
    persistence: RuntimeContainer["persistence"];
    model: string;
    sdkVersion: string;
    authSource?: "cli" | "api-key" | "none";
  };
};

export function presentSnapshot(snapshot: DemoSnapshot): PresentedDemoSnapshot {
  const runtime = getRuntime();
  return {
    ...snapshot,
    runtime: {
      codexMode: runtime.codexMode,
      persistence: runtime.persistence,
      model: runtime.codexRuntime.info().model,
      sdkVersion: runtime.codexRuntime.info().sdkVersion,
      authSource: runtime.codexRuntime.info().authSource
    }
  };
}
