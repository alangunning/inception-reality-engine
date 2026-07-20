import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { RealityRunArchiveSchema } from "@inception/domain";
import { SqliteRealityRepository } from "@inception/orchestrator";
import { GitWorktreeManager } from "@inception/worktree-manager";

const repo = process.cwd();
const envFile = path.join(repo, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const databaseUrl = process.env.DATABASE_URL ?? `file:${repo}/prisma/dev.db`;
const databaseFile = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
const resolvedDatabaseFile = path.isAbsolute(databaseFile) ? databaseFile : path.resolve(repo, databaseFile);
fs.mkdirSync(path.dirname(resolvedDatabaseFile), { recursive: true });
const repository = new SqliteRealityRepository(resolvedDatabaseFile);
const worktrees = new GitWorktreeManager(repo);

try {
  const realities = (await repository.listRealities()).sort((a, b) => b.depth - a.depth);
  const session = await repository.getSession();
  const events = await repository.listEvents(5_000);
  if (session && (session.phase > 0 || events.some((event) => event.type === "codex.progress"))) {
    await repository.saveRunArchive(RealityRunArchiveSchema.parse({
      id: randomUUID(),
      session,
      realities: realities.slice().sort((a, b) => a.depth - b.depth),
      events,
      archivedAt: new Date().toISOString()
    }));
  }
  for (const reality of realities) {
    if (reality.worktreePath && reality.branchName) {
      await worktrees.remove({ path: reality.worktreePath, branchName: reality.branchName });
    }
  }
  await worktrees.cleanupAll();
  await repository.deleteAll();
  console.log("Reality reset. Start the app to create a new Reality.");
} finally {
  repository.close();
}
