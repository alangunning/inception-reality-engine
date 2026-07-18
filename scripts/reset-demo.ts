import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SqliteRealityRepository } from "@inception/orchestrator";

const repo = process.cwd();
const databaseUrl = process.env.DATABASE_URL ?? `file:${repo}/prisma/dev.db`;
const databaseFile = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
const resolvedDatabaseFile = path.isAbsolute(databaseFile) ? databaseFile : path.resolve(repo, databaseFile);
fs.mkdirSync(path.dirname(resolvedDatabaseFile), { recursive: true });
const repository = new SqliteRealityRepository(resolvedDatabaseFile);
const worktreeRoot = path.join(repo, ".inception", "worktrees");

try {
  const realities = (await repository.listRealities()).sort((a, b) => b.depth - a.depth);
  for (const reality of realities) {
    if (reality.worktreePath && fs.existsSync(reality.worktreePath)) {
      try { execFileSync("git", ["worktree", "remove", "--force", reality.worktreePath], { cwd: repo }); } catch {}
    }
    if (reality.branchName) {
      try { execFileSync("git", ["branch", "-D", reality.branchName], { cwd: repo }); } catch {}
    }
  }
  await repository.deleteAll();
  fs.rmSync(worktreeRoot, { recursive: true, force: true });
  try { execFileSync("git", ["worktree", "prune"], { cwd: repo }); } catch {}
  console.log("Reality reset. Start the app to create a new waking Reality.");
} finally {
  repository.close();
}
