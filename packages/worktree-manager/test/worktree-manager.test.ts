import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GitWorktreeManager } from "../src";

describe("GitWorktreeManager", () => {
  it("creates an isolated branch and cleans registered or orphaned worktrees", async () => {
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
      await manager.writeFile(descriptor.path, "evidence/failing.spec.ts", "parent evidence\n");

      expect(await readFile(path.join(repo, "seed.txt"), "utf8")).toBe("waking\n");
      expect(await readFile(path.join(descriptor.path, "seed.txt"), "utf8")).toBe("dream\n");
      expect(await manager.diff(descriptor.path, "seed.txt")).toContain("+dream");
      expect(await manager.diff(descriptor.path, "evidence")).toContain("+parent evidence");

      const nested = await manager.create("nested-dream", "HEAD", descriptor.path);
      expect(await readFile(path.join(nested.path, "seed.txt"), "utf8")).toBe("dream\n");
      expect(await readFile(path.join(nested.path, "evidence/failing.spec.ts"), "utf8")).toBe("parent evidence\n");
      await manager.writeFile(nested.path, "seed.txt", "nested\n");
      expect(await readFile(path.join(descriptor.path, "seed.txt"), "utf8")).toBe("dream\n");
      expect(await manager.listChangedFiles(nested.path)).toEqual([
        "evidence/failing.spec.ts",
        "seed.txt"
      ]);
      await expect(manager.writeFile(descriptor.path, "../outside.txt", "escape\n")).rejects.toThrow(
        "Worktree file path must remain inside the Reality."
      );
      await manager.remove(nested);
      await manager.remove(descriptor);

      const orphan = await manager.create("orphaned-dream");
      execFileSync("git", ["branch", "inception/stale-without-worktree"], { cwd: repo });
      expect(await manager.cleanupAll()).toBe(1);
      await expect(access(orphan.path)).rejects.toThrow();
      expect(execFileSync("git", ["branch", "--list", "inception/*"], { cwd: repo }).toString().trim()).toBe("");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);
});
