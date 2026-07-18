import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GitWorktreeManager, TrainingTargetManager } from "../src";

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

      await manager.checkpoint(descriptor.path, "Seal parent Reality state");
      await manager.writeFile(descriptor.path, "evidence/live.txt", "uncommitted observation\n");
      const nested = await manager.create(
        "nested-dream",
        descriptor.branchName,
        descriptor.path
      );
      expect(await readFile(path.join(nested.path, "seed.txt"), "utf8")).toBe("dream\n");
      expect(await readFile(path.join(nested.path, "evidence/failing.spec.ts"), "utf8")).toBe("parent evidence\n");
      expect(await readFile(path.join(nested.path, "evidence/live.txt"), "utf8")).toBe("uncommitted observation\n");
      await manager.writeFile(nested.path, "seed.txt", "nested\n");
      expect(await readFile(path.join(descriptor.path, "seed.txt"), "utf8")).toBe("dream\n");
      expect(await manager.listChangedFiles(nested.path)).toEqual([
        "evidence/live.txt",
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

  it("cleans only its own worktree root and branch namespace", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "inception-scoped-worktree-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: repo });
      execFileSync("git", ["config", "user.email", "demo@example.com"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Inception Test"], { cwd: repo });
      await writeFile(path.join(repo, "seed.txt"), "waking\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "seed"], { cwd: repo });

      const live = new GitWorktreeManager(
        repo,
        path.join(repo, ".inception", "live-worktrees"),
        "inception-live"
      );
      const test = new GitWorktreeManager(
        repo,
        path.join(repo, ".inception", "test-worktrees"),
        "inception-test"
      );
      const liveReality = await live.create("live-reality");
      const testReality = await test.create("test-reality");

      expect(await test.cleanupAll()).toBe(1);

      expect(await live.isPresent(liveReality.path)).toBe(true);
      expect(await test.isPresent(testReality.path)).toBe(false);
      expect(execFileSync("git", ["branch", "--list", "inception-live/*"], { cwd: repo }).toString())
        .toContain("inception-live/live-reality");
      await live.cleanupAll();
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);

  it("seals an intervention outside normal branch history, retains its diff, and restores the baseline", async () => {
    const repo = await mkdtemp(path.join(os.tmpdir(), "inception-sealed-intervention-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: repo });
      execFileSync("git", ["config", "user.email", "demo@example.com"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Inception Test"], { cwd: repo });
      await writeFile(path.join(repo, "boundary.py"), "allowed = False\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "secure baseline"], { cwd: repo });

      const manager = new GitWorktreeManager(repo);
      const dream = await manager.create("sealed-dream");
      const baseline = await manager.checkpoint(dream.path, "Dream baseline");
      expect(await manager.currentCommit(dream.path)).toBe(baseline);
      expect(await manager.isClean(dream.path)).toBe(true);
      await manager.writeFile(dream.path, "boundary.py", "allowed = True\n");
      expect(await manager.isClean(dream.path)).toBe(false);
      const interventionCommit = await manager.sealChanges(
        dream.path,
        ["boundary.py"],
        "Sealed permission fault",
        baseline
      );

      expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: dream.path }).toString().trim())
        .toBe(baseline);
      expect(execFileSync("git", ["log", "--format=%s", "-1"], { cwd: dream.path }).toString())
        .not.toContain("Sealed permission fault");
      expect(execFileSync("git", ["cat-file", "-t", interventionCommit], { cwd: dream.path }).toString().trim())
        .toBe("commit");
      expect(await readFile(path.join(dream.path, "boundary.py"), "utf8")).toBe("allowed = True\n");
      expect(await manager.diff(dream.path, "boundary.py")).toContain("+allowed = True");

      await manager.restoreCheckpoint(dream.path, baseline);
      expect(await readFile(path.join(dream.path, "boundary.py"), "utf8")).toBe("allowed = False\n");
      expect(await manager.listChangedFiles(dream.path)).toEqual([]);
      expect(await manager.isClean(dream.path)).toBe(true);
      await manager.cleanupAll();
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);
});

describe("TrainingTargetManager", () => {
  it("prepares only the pinned revision and reuses the verified local clone", async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), "inception-training-source-"));
    const storage = await mkdtemp(path.join(os.tmpdir(), "inception-training-storage-"));
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: source });
      execFileSync("git", ["config", "user.email", "demo@example.com"], { cwd: source });
      execFileSync("git", ["config", "user.name", "Inception Test"], { cwd: source });
      await writeFile(path.join(source, "app.py"), "vulnerable = True\n");
      execFileSync("git", ["add", "."], { cwd: source });
      execFileSync("git", ["commit", "-m", "training target"], { cwd: source });
      const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source }).toString().trim();
      const manager = new TrainingTargetManager(storage, [{
        id: "vampi",
        name: "VAmPI",
        description: "Local test target",
        sourceUrl: "https://example.invalid/vampi",
        cloneUrl: source,
        revision,
        license: "MIT",
        catalogueUrl: "https://example.invalid/catalogue"
      }]);

      expect(await manager.list()).toEqual([
        expect.objectContaining({ id: "vampi", prepared: false })
      ]);
      const prepared = await manager.prepare("vampi");
      expect(prepared).toMatchObject({
        id: "vampi",
        prepared: true,
        revision
      });
      expect(execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: prepared.repositoryPath
      }).toString().trim()).toBe(revision);
      expect(await readFile(path.join(prepared.repositoryPath!, "app.py"), "utf8"))
        .toBe("vulnerable = True\n");
      expect((await manager.prepare("vampi")).repositoryPath).toBe(prepared.repositoryPath);
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(storage, { recursive: true, force: true });
    }
  }, 15_000);
});
