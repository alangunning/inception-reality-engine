import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface WorktreeDescriptor {
  path: string;
  branchName: string;
}

export interface WorktreeManager {
  discoverRepoRoot(startDirectory?: string): Promise<string>;
  create(realityId: string, baseRef?: string): Promise<WorktreeDescriptor>;
  remove(descriptor: WorktreeDescriptor): Promise<void>;
  writeFile(worktreePath: string, relativePath: string, content: string): Promise<void>;
  diff(worktreePath: string, pathspec?: string): Promise<string>;
  run(worktreePath: string, command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

function safeBranchPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 48);
}

export class GitWorktreeManager implements WorktreeManager {
  constructor(
    private readonly repoRoot: string,
    private readonly worktreeRoot = path.join(repoRoot, ".inception", "worktrees")
  ) {}

  async discoverRepoRoot(startDirectory = this.repoRoot): Promise<string> {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: startDirectory });
    return stdout.trim();
  }

  async create(realityId: string, baseRef = "HEAD"): Promise<WorktreeDescriptor> {
    await mkdir(this.worktreeRoot, { recursive: true });
    const branchName = `inception/${safeBranchPart(realityId)}`;
    const worktreePath = path.join(this.worktreeRoot, safeBranchPart(realityId));
    await rm(worktreePath, { recursive: true, force: true });
    try {
      await execFileAsync("git", ["branch", "-D", branchName], { cwd: this.repoRoot });
    } catch {
      // Branch does not exist yet.
    }
    await execFileAsync("git", ["worktree", "add", "-b", branchName, worktreePath, baseRef], { cwd: this.repoRoot });
    return { path: worktreePath, branchName };
  }

  async remove(descriptor: WorktreeDescriptor): Promise<void> {
    try {
      await execFileAsync("git", ["worktree", "remove", "--force", descriptor.path], { cwd: this.repoRoot });
    } catch {
      await rm(descriptor.path, { recursive: true, force: true });
    }
    try {
      await execFileAsync("git", ["branch", "-D", descriptor.branchName], { cwd: this.repoRoot });
    } catch {
      // Already gone.
    }
    try {
      await execFileAsync("git", ["worktree", "prune"], { cwd: this.repoRoot });
    } catch {
      // Best effort cleanup.
    }
  }

  async writeFile(worktreePath: string, relativePath: string, content: string): Promise<void> {
    const target = path.join(worktreePath, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  async diff(worktreePath: string, pathspec = "."): Promise<string> {
    const { stdout } = await execFileAsync("git", ["diff", "--", pathspec], { cwd: worktreePath, maxBuffer: 5_000_000 });
    return stdout;
  }

  async run(worktreePath: string, command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd: worktreePath,
        maxBuffer: 5_000_000,
        env: process.env
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? String(error),
        exitCode: typeof failure.code === "number" ? failure.code : 1
      };
    }
  }
}
