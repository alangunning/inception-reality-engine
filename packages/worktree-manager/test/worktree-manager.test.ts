import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GitWorktreeManager } from "../src";

describe("GitWorktreeManager", () => {
  it("creates an isolated branch and worktree", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "inception-worktree-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: repo });
      execFileSync("git", ["config", "user.email", "demo@example.com"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Inception Test"], { cwd: repo });
      await writeFile(path.join(repo, "seed.txt"), "waking\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "seed"], { cwd: repo });

      const manager = new GitWorktreeManager(repo);
      const descriptor = await manager.create("dream-one");
      await manager.writeFile(descriptor.path, "seed.txt", "dream\n");

      expect(await readFile(path.join(repo, "seed.txt"), "utf8")).toBe("waking\n");
      expect(await readFile(path.join(descriptor.path, "seed.txt"), "utf8")).toBe("dream\n");
      expect(await manager.diff(descriptor.path, "seed.txt")).toContain("+dream");
      await manager.remove(descriptor);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
