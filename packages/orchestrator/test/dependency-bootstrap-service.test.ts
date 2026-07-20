import { describe, expect, it } from "vitest";
import { DependencyBootstrapService } from "../src/dependency-bootstrap-service";
import type {
  WorktreeDescriptor,
  WorktreeManagerPort,
  WorktreeRunResult
} from "../src/worktree-port";

class BootstrapWorktrees implements WorktreeManagerPort {
  readonly files = new Map<string, string>();
  readonly commands: Array<{ command: string; args: string[] }> = [];

  async discoverRepoRoot(): Promise<string> { return "/repo"; }
  async create(): Promise<WorktreeDescriptor> {
    return { path: "/worktree", branchName: "reality/test" };
  }
  async remove(): Promise<void> {}
  async cleanupAll(): Promise<number> { return 0; }
  async isPresent(): Promise<boolean> { return true; }
  async writeFile(_worktreePath: string, relativePath: string, content: string): Promise<void> {
    this.files.set(relativePath, content);
  }
  async readFile(_worktreePath: string, relativePath: string): Promise<string> {
    const value = this.files.get(relativePath);
    if (value === undefined) throw new Error(`Missing ${relativePath}`);
    return value;
  }
  async listChangedFiles(): Promise<string[]> { return []; }
  async diff(): Promise<string> { return ""; }
  async checkpoint(): Promise<string> { return "a".repeat(40); }
  async currentCommit(): Promise<string> { return "a".repeat(40); }
  async isClean(): Promise<boolean> { return true; }
  async sealChanges(): Promise<string> { return "b".repeat(40); }
  async restoreCheckpoint(): Promise<void> {}
  async run(
    _worktreePath: string,
    command: string,
    args: string[]
  ): Promise<WorktreeRunResult> {
    this.commands.push({ command, args });
    if (command === "python3" && args[0] === "--version") {
      return { stdout: "Python 3.12.10\n", stderr: "", exitCode: 0 };
    }
    if (command === "node" && args[0] === "--version") {
      return { stdout: "v22.15.0\n", stderr: "", exitCode: 0 };
    }
    if (command === "npm" && args[0] === "--version") {
      return { stdout: "11.4.2\n", stderr: "", exitCode: 0 };
    }
    if (command === "npm" && args[0] === "ls") {
      return { stdout: "{\"dependencies\":{}}\n", stderr: "", exitCode: 0 };
    }
    if (command === ".venv/bin/python" && args.includes("--format=json")) {
      return {
        stdout: JSON.stringify([
          { name: "Flask", version: "2.2.2" },
          { name: "Werkzeug", version: "2.2.3" }
        ]),
        stderr: "",
        exitCode: 0
      };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  }
}

describe("DependencyBootstrapService", () => {
  it("installs exact Python pins only inside the Reality-local venv and reuses its digest", async () => {
    const worktrees = new BootstrapWorktrees();
    worktrees.files.set(
      "requirements-reality.txt",
      "Flask==2.2.2\nWerkzeug==2.2.3\n"
    );
    const service = new DependencyBootstrapService();
    const contract = {
      kind: "python-venv" as const,
      manifestPath: "requirements-reality.txt",
      pythonExecutable: "auto" as const,
      virtualEnvironmentPath: ".venv" as const,
      indexUrl: "https://pypi.org/simple" as const,
      requiredPythonVersion: "3.12.10",
      targetDepth: 3
    };

    const installed = await service.bootstrap(worktrees, "/worktree", contract);
    expect(installed).toMatchObject({
      status: "completed",
      packageCount: 2,
      runtimeVersion: "3.12.10",
      runtimeExecutable: "python3",
      reused: false
    });
    expect(installed.command).not.toContain("&& --");
    expect(installed.command).toContain(
      "--index-url 'https://pypi.org/simple' -r 'requirements-reality.txt'"
    );
    expect(installed.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(worktrees.commands).toContainEqual({
      command: ".venv/bin/python",
      args: expect.arrayContaining([
        "--only-binary=:all:",
        "--no-deps",
        "https://pypi.org/simple",
        "requirements-reality.txt"
      ])
    });
    expect(worktrees.commands.some(({ command }) => command === "pip")).toBe(false);
    expect(worktrees.commands).toContainEqual({
      command: "git",
      args: ["ls-files", "--error-unmatch", "--", "requirements-reality.txt"]
    });

    const reused = await service.bootstrap(worktrees, "/worktree", contract);
    expect(reused).toMatchObject({
      status: "completed",
      reused: true,
      manifestSha256: installed.manifestSha256
    });
  });

  it("rejects unpinned Python dependencies before creating an environment", async () => {
    const worktrees = new BootstrapWorktrees();
    worktrees.files.set("requirements.txt", "Flask>=2\n");
    const result = await new DependencyBootstrapService().bootstrap(
      worktrees,
      "/worktree",
      {
        kind: "python-venv",
        manifestPath: "requirements.txt",
        pythonExecutable: "python3",
        virtualEnvironmentPath: ".venv",
        indexUrl: "https://pypi.org/simple",
        targetDepth: 2
      }
    );
    expect(result).toMatchObject({
      status: "failed",
      reused: false
    });
    expect(result.diagnostic).toContain("exact package==version");
    expect(worktrees.commands.some(({ command, args }) =>
      command === "python3" && args[0] === "-m" && args[1] === "venv"
    )).toBe(false);
    expect(worktrees.commands.some(({ command }) => command === ".venv/bin/python")).toBe(false);
  });

  it("rejects an unavailable exact Python runtime without altering the host", async () => {
    const worktrees = new BootstrapWorktrees();
    worktrees.files.set("requirements-reality.txt", "Flask==2.2.2\n");
    const result = await new DependencyBootstrapService().bootstrap(
      worktrees,
      "/worktree",
      {
        kind: "python-venv",
        manifestPath: "requirements-reality.txt",
        pythonExecutable: "python3",
        virtualEnvironmentPath: ".venv",
        indexUrl: "https://pypi.org/simple",
        requiredPythonVersion: "3.13.1",
        targetDepth: 2
      }
    );
    expect(result).toMatchObject({
      status: "failed",
      diagnostic: expect.stringContaining("Python 3.13.1 is required")
    });
    expect(worktrees.commands.some(({ command, args }) =>
      command === "python3" && args[0] === "-m" && args[1] === "venv"
    )).toBe(false);
  });

  it("falls back from python3 to a Python 3 interpreter exposed as python", async () => {
    const worktrees = new BootstrapWorktrees();
    worktrees.files.set("requirements-reality.txt", "Flask==2.2.2\n");
    const originalRun = worktrees.run.bind(worktrees);
    worktrees.run = async (worktreePath, command, args) => {
      if (command === "python3" && args[0] === "--version") {
        worktrees.commands.push({ command, args });
        return { stdout: "", stderr: "not found", exitCode: 127 };
      }
      if (command === "python" && args[0] === "--version") {
        worktrees.commands.push({ command, args });
        return { stdout: "Python 3.11.9\n", stderr: "", exitCode: 0 };
      }
      return originalRun(worktreePath, command, args);
    };

    const result = await new DependencyBootstrapService().bootstrap(
      worktrees,
      "/worktree",
      {
        kind: "python-venv",
        manifestPath: "requirements-reality.txt",
        pythonExecutable: "auto",
        virtualEnvironmentPath: ".venv",
        indexUrl: "https://pypi.org/simple",
        targetDepth: 2
      }
    );

    expect(result).toMatchObject({
      status: "completed",
      runtimeVersion: "3.11.9"
    });
    expect(worktrees.commands).toContainEqual({
      command: "python",
      args: ["-m", "venv", ".venv"]
    });
  });

  it.each(["3.8.18", "3.10.14", "3.13.3", "3.14.0"])(
    "accepts installed Python %s when the parent does not require an exact runtime",
    async (version) => {
      const worktrees = new BootstrapWorktrees();
      worktrees.files.set("requirements-reality.txt", "Flask==2.2.2\n");
      const originalRun = worktrees.run.bind(worktrees);
      worktrees.run = async (worktreePath, command, args) => {
        if (command === "python3" && args[0] === "--version") {
          worktrees.commands.push({ command, args });
          return { stdout: `Python ${version}\n`, stderr: "", exitCode: 0 };
        }
        return originalRun(worktreePath, command, args);
      };

      const result = await new DependencyBootstrapService().bootstrap(
        worktrees,
        "/worktree",
        {
          kind: "python-venv",
          manifestPath: "requirements-reality.txt",
          pythonExecutable: "auto",
          virtualEnvironmentPath: ".venv",
          indexUrl: "https://pypi.org/simple",
          targetDepth: 2
        }
      );

      expect(result).toMatchObject({
        status: "completed",
        runtimeVersion: version,
        runtimeExecutable: "python3"
      });
      expect(worktrees.commands).toContainEqual({
        command: "python3",
        args: ["-m", "venv", ".venv"]
      });
    }
  );

  it("validates npm registry integrity and installs without lifecycle scripts or global flags", async () => {
    const worktrees = new BootstrapWorktrees();
    worktrees.files.set("package-lock.json", JSON.stringify({
      name: "fixture",
      lockfileVersion: 3,
      packages: {
        "": { name: "fixture", version: "1.0.0" },
        "node_modules/zod": {
          version: "3.25.76",
          resolved: "https://registry.npmjs.org/zod/-/zod-3.25.76.tgz",
          integrity: "sha512-YWJpcGhh"
        }
      }
    }));
    const result = await new DependencyBootstrapService().bootstrap(
      worktrees,
      "/worktree",
      {
        kind: "node-npm",
        manifestPath: "package-lock.json",
        nodeExecutable: "node",
        packageManagerExecutable: "npm",
        dependencyPath: "node_modules",
        indexUrl: "https://registry.npmjs.org/",
        requiredNodeVersion: "22.15.0",
        targetDepth: 2
      }
    );

    expect(result).toMatchObject({
      status: "completed",
      packageCount: 1,
      runtimeVersion: "22.15.0",
      runtimeExecutable: "node",
      packageManagerVersion: "11.4.2",
      reused: false
    });
    expect(result.command).not.toContain("&& --");
    expect(result.command).toContain(
      "--registry 'https://registry.npmjs.org/' --cache 'node_modules/.inception-npm-cache'"
    );
    expect(worktrees.commands).toContainEqual({
      command: "npm",
      args: expect.arrayContaining([
        "ci",
        "--ignore-scripts",
        "--location=project",
        "--prefix=.",
        "--registry",
        "https://registry.npmjs.org/"
      ])
    });
    expect(worktrees.commands.some(({ args }) => args.includes("--global"))).toBe(false);
  });
});
