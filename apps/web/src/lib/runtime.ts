import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { CodexProcessControl, MockCodexRuntime, RealCodexRuntime } from "@inception/codex-runtime";
import {
  InMemoryRealityEventBus,
  PrismaRealityRepository,
  RealityOrchestrator,
  SqliteRealityRepository,
  SynthesisService,
  type DemoSnapshot,
  type InceptionPrismaClient,
  type RealityRepository
} from "@inception/orchestrator";
import { GitWorktreeManager } from "@inception/worktree-manager";

interface RuntimeContainer {
  persistence: "prisma" | "sqlite-fallback";
  codexMode: "mock" | "real";
  eventBus: InMemoryRealityEventBus;
  orchestrator: RealityOrchestrator;
  processControl: CodexProcessControl;
  disconnect(): Promise<void>;
}

declare global {
  var __inceptionRuntime: RuntimeContainer | undefined;
}

const requireModule = createRequire(import.meta.url);

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
  if (globalThis.__inceptionRuntime) return globalThis.__inceptionRuntime;
  const repoRoot = discoverRepoRoot();
  const persistence = createRepository(repoRoot);
  const eventBus = new InMemoryRealityEventBus();
  const codexMode = process.env.INCEPTION_CODEX_MODE === "real" ? "real" : "mock";
  const codexRuntime = codexMode === "real"
    ? new RealCodexRuntime()
    : new MockCodexRuntime();
  const worktrees = new GitWorktreeManager(repoRoot);
  const orchestrator = new RealityOrchestrator(
    persistence.repository,
    eventBus,
    codexRuntime,
    worktrees,
    new SynthesisService(),
    repoRoot
  );
  globalThis.__inceptionRuntime = {
    persistence: persistence.persistence,
    codexMode,
    eventBus,
    orchestrator,
    processControl: new CodexProcessControl(),
    disconnect: persistence.disconnect
  };
  return globalThis.__inceptionRuntime;
}

export type PresentedDemoSnapshot = DemoSnapshot & {
  runtime: {
    codexMode: RuntimeContainer["codexMode"];
    persistence: RuntimeContainer["persistence"];
  };
};

export function presentSnapshot(snapshot: DemoSnapshot): PresentedDemoSnapshot {
  const runtime = getRuntime();
  return {
    ...snapshot,
    runtime: {
      codexMode: runtime.codexMode,
      persistence: runtime.persistence
    }
  };
}
