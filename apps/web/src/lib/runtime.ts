import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { MockCodexRuntime, RealCodexRuntime } from "@inception/codex-runtime";
import {
  InMemoryRealityEventBus,
  PrismaRealityRepository,
  RealityOrchestrator,
  SqliteRealityRepository,
  SynthesisService,
  type InceptionPrismaClient,
  type RealityRepository
} from "@inception/orchestrator";
import { GitWorktreeManager } from "@inception/worktree-manager";

interface RuntimeContainer {
  persistence: "prisma" | "sqlite-fallback";
  eventBus: InMemoryRealityEventBus;
  orchestrator: RealityOrchestrator;
  disconnect(): Promise<void>;
}

declare global {
  var __inceptionRuntime: RuntimeContainer | undefined;
}

function discoverRepoRoot(): string {
  if (process.env.INCEPTION_REPO_ROOT) return process.env.INCEPTION_REPO_ROOT;
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() }).toString().trim();
}

function sqliteFilename(repoRoot: string): string {
  const url = process.env.DATABASE_URL ?? `file:${repoRoot}/prisma/dev.db`;
  const filename = url.startsWith("file:") ? url.slice("file:".length) : url;
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(repoRoot, filename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function createRepository(repoRoot: string): {
  repository: RealityRepository;
  persistence: RuntimeContainer["persistence"];
  disconnect(): Promise<void>;
} {
  if (process.env.INCEPTION_PERSISTENCE !== "sqlite") {
    try {
      const adapter = new PrismaLibSql({
        url: process.env.DATABASE_URL ?? `file:${repoRoot}/prisma/dev.db`
      });
      const prisma = new PrismaClient({ adapter }) as InceptionPrismaClient;
      if (!prisma.realityRecord || !prisma.realityEventRecord || !prisma.demoSessionRecord) {
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
  const codexRuntime = process.env.INCEPTION_CODEX_MODE === "real"
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
    eventBus,
    orchestrator,
    disconnect: persistence.disconnect
  };
  return globalThis.__inceptionRuntime;
}
