import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface WorktreeDescriptor {
  path: string;
  branchName: string;
}

export interface WorktreeManager {
  discoverRepoRoot(startDirectory?: string): Promise<string>;
  create(realityId: string, baseRef?: string, parentWorktreePath?: string): Promise<WorktreeDescriptor>;
  remove(descriptor: WorktreeDescriptor): Promise<void>;
  cleanupAll(): Promise<number>;
  isPresent(worktreePath?: string): Promise<boolean>;
  writeFile(worktreePath: string, relativePath: string, content: string): Promise<void>;
  readFile(worktreePath: string, relativePath: string): Promise<string>;
  listChangedFiles(worktreePath: string): Promise<string[]>;
  diff(worktreePath: string, pathspec?: string): Promise<string>;
  run(worktreePath: string, command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

function safeBranchPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 48);
}

function resolveInsideWorktree(worktreePath: string, relativePath: string): string {
  const root = path.resolve(worktreePath);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Worktree file path must remain inside the Reality.");
  }
  return target;
}

export class GitWorktreeManager implements WorktreeManager {
  private readonly branchPrefix: string;

  constructor(
    private readonly repoRoot: string,
    private readonly worktreeRoot = path.join(repoRoot, ".inception", "worktrees"),
    branchPrefix = "inception"
  ) {
    this.branchPrefix = branchPrefix
      .split("/")
      .map(safeBranchPart)
      .filter(Boolean)
      .join("/");
    if (!this.branchPrefix) throw new Error("Worktree branch prefix must contain a safe Git branch component.");
  }

  async discoverRepoRoot(startDirectory = this.repoRoot): Promise<string> {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: startDirectory });
    return stdout.trim();
  }

  async create(realityId: string, baseRef = "HEAD", parentWorktreePath?: string): Promise<WorktreeDescriptor> {
    await mkdir(this.worktreeRoot, { recursive: true });
    const branchName = `${this.branchPrefix}/${safeBranchPart(realityId)}`;
    const worktreePath = path.join(this.worktreeRoot, safeBranchPart(realityId));
    try {
      await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], { cwd: this.repoRoot });
    } catch {
      // A stale directory may not be registered with Git.
    }
    await rm(worktreePath, { recursive: true, force: true });
    try {
      await execFileAsync("git", ["branch", "-D", branchName], { cwd: this.repoRoot });
    } catch {
      // Branch does not exist yet.
    }
    await execFileAsync("git", ["worktree", "add", "-b", branchName, worktreePath, baseRef], { cwd: this.repoRoot });
    if (parentWorktreePath) {
      await this.inheritParentState(parentWorktreePath, worktreePath);
    }
    // Vite writes bundled config files beside the resolved node_modules tree.
    // A local cache keeps that write inside the Reality worktree.
    await mkdir(path.join(worktreePath, "node_modules", ".vite-temp"), { recursive: true });
    return { path: worktreePath, branchName };
  }

  async remove(descriptor: WorktreeDescriptor): Promise<void> {
    if (!await this.ownsPath(descriptor.path)) return;
    try {
      await execFileAsync("git", ["worktree", "remove", "--force", descriptor.path], { cwd: this.repoRoot });
    } catch {
      await rm(descriptor.path, { recursive: true, force: true });
    }
    if (descriptor.branchName.startsWith(`${this.branchPrefix}/`)) {
      try {
        await execFileAsync("git", ["branch", "-D", descriptor.branchName], { cwd: this.repoRoot });
      } catch {
        // Already gone.
      }
    }
    try {
      await execFileAsync("git", ["worktree", "prune"], { cwd: this.repoRoot });
    } catch {
      // Best effort cleanup.
    }
  }

  async cleanupAll(): Promise<number> {
    let output = "";
    try {
      const result = await execFileAsync("git", ["worktree", "list", "--porcelain"], { cwd: this.repoRoot });
      output = result.stdout;
    } catch {
      // Filesystem cleanup below still removes stale directories.
    }

    const root = await realpath(this.worktreeRoot).catch(() => path.resolve(this.worktreeRoot));
    const descriptors: WorktreeDescriptor[] = [];
    for (const block of output.split("\n\n")) {
      const worktreePath = block.match(/^worktree (.+)$/m)?.[1];
      const branchRef = block.match(/^branch refs\/heads\/(.+)$/m)?.[1];
      if (!worktreePath) continue;
      const resolved = await realpath(worktreePath).catch(() => path.resolve(worktreePath));
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) continue;
      descriptors.push({ path: resolved, branchName: branchRef ?? "" });
    }

    for (const descriptor of descriptors) {
      try {
        await execFileAsync("git", ["worktree", "remove", "--force", descriptor.path], { cwd: this.repoRoot });
      } catch {
        await rm(descriptor.path, { recursive: true, force: true });
      }
      if (descriptor.branchName.startsWith(`${this.branchPrefix}/`)) {
        try {
          await execFileAsync("git", ["branch", "-D", descriptor.branchName], { cwd: this.repoRoot });
        } catch {
          // Branch may already have been removed with a registered Reality.
        }
      }
    }

    await rm(this.worktreeRoot, { recursive: true, force: true });
    try {
      await execFileAsync("git", ["worktree", "prune"], { cwd: this.repoRoot });
    } catch {
      // Best effort cleanup.
    }
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["for-each-ref", "--format=%(refname:short)", `refs/heads/${this.branchPrefix}/`],
        { cwd: this.repoRoot }
      );
      for (const branchName of stdout.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
        try {
          await execFileAsync("git", ["branch", "-D", branchName], { cwd: this.repoRoot });
        } catch {
          // A branch checked out outside the managed root is left untouched.
        }
      }
    } catch {
      // Best effort cleanup.
    }
    return descriptors.length;
  }

  async isPresent(worktreePath?: string): Promise<boolean> {
    if (!worktreePath || !await this.ownsPath(worktreePath)) return false;
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: worktreePath
      });
      return stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  async writeFile(worktreePath: string, relativePath: string, content: string): Promise<void> {
    const target = resolveInsideWorktree(worktreePath, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  async readFile(worktreePath: string, relativePath: string): Promise<string> {
    return readFile(resolveInsideWorktree(worktreePath, relativePath), "utf8");
  }

  async listChangedFiles(worktreePath: string): Promise<string[]> {
    const [{ stdout: tracked }, { stdout: untracked }] = await Promise.all([
      execFileAsync("git", ["diff", "HEAD", "--name-only", "-z"], {
        cwd: worktreePath,
        maxBuffer: 5_000_000
      }),
      execFileAsync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
        cwd: worktreePath,
        maxBuffer: 5_000_000
      })
    ]);
    return [...new Set(
      `${tracked}\0${untracked}`
        .split("\0")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )].sort();
  }

  async diff(worktreePath: string, pathspec = "."): Promise<string> {
    const { stdout: untracked } = await execFileAsync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z", "--", pathspec],
      { cwd: worktreePath, maxBuffer: 5_000_000 }
    );
    const untrackedPaths = untracked.split("\0").filter(Boolean);
    if (untrackedPaths.length) {
      await execFileAsync("git", ["add", "-N", "--", ...untrackedPaths], {
        cwd: worktreePath,
        maxBuffer: 5_000_000
      });
    }
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

  private async inheritParentState(parentWorktreePath: string, childWorktreePath: string): Promise<void> {
    const { stdout: patch } = await execFileAsync("git", ["diff", "HEAD", "--binary"], {
      cwd: parentWorktreePath,
      maxBuffer: 10_000_000
    });
    if (patch) {
      const patchPath = path.join(childWorktreePath, ".inception-parent.patch");
      await writeFile(patchPath, patch, "utf8");
      try {
        await execFileAsync("git", ["apply", "--whitespace=nowarn", patchPath], {
          cwd: childWorktreePath,
          maxBuffer: 10_000_000
        });
      } finally {
        await rm(patchPath, { force: true });
      }
    }

    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd: parentWorktreePath, maxBuffer: 5_000_000 }
    );
    for (const relativePath of stdout.split("\0").filter(Boolean)) {
      const source = resolveInsideWorktree(parentWorktreePath, relativePath);
      const target = resolveInsideWorktree(childWorktreePath, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }
  }

  private async ownsPath(candidatePath: string): Promise<boolean> {
    const root = await realpath(this.worktreeRoot).catch(() => path.resolve(this.worktreeRoot));
    const candidate = await realpath(candidatePath).catch(() => path.resolve(candidatePath));
    return candidate !== root && candidate.startsWith(`${root}${path.sep}`);
  }
}

export class GitMissionWorkspaceFactory {
  constructor(private readonly storageRoot: string) {}

  async open(repositoryPath: string, missionId: string): Promise<{
    repoRoot: string;
    worktrees: GitWorktreeManager;
  }> {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd: repositoryPath }
    );
    const repoRoot = stdout.trim();
    if (!repoRoot) throw new Error("Mission repository is not a Git worktree.");
    const safeMissionId = safeBranchPart(missionId);
    return {
      repoRoot,
      worktrees: new GitWorktreeManager(
        repoRoot,
        path.join(this.storageRoot, safeMissionId, "worktrees"),
        `inception-mission-${safeMissionId}`
      )
    };
  }
}
