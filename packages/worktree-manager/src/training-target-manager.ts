import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  VAMPI_AUTHORIZATION_PROOF_RUNNER,
  VAMPI_AUTHORIZATION_REGRESSION_TEST,
  VAMPI_REALITY_REQUIREMENTS
} from "./training-target-fixtures";

const execFileAsync = promisify(execFile);

export type TrainingTargetId = "vampi";

export interface TrainingTargetDefinition {
  id: TrainingTargetId;
  name: string;
  description: string;
  sourceUrl: string;
  cloneUrl: string;
  revision: string;
  license: string;
  catalogueUrl: string;
  fixtureVersion?: string;
  fixtures?: readonly {
    path: string;
    content: string;
  }[];
}

export const TRAINING_TARGETS = [{
  id: "vampi",
  name: "VAmPI",
  description: "A small, deliberately vulnerable Flask API with a dependency-free baseline proof and a pinned Reality-local framework manifest.",
  sourceUrl: "https://github.com/erev0s/VAmPI",
  cloneUrl: "https://github.com/erev0s/VAmPI.git",
  revision: "f16052dce83f05847133ec98f01c5193a41de7d8",
  license: "MIT",
  catalogueUrl: "https://ctf.owasp.org/",
  fixtureVersion: "authz-v2",
  fixtures: [
    {
      path: "tests/test_authorization_regression.py",
      content: VAMPI_AUTHORIZATION_REGRESSION_TEST
    },
    {
      path: "requirements-reality.txt",
      content: VAMPI_REALITY_REQUIREMENTS
    },
    {
      path: "scripts/run_authorization_regression.sh",
      content: VAMPI_AUTHORIZATION_PROOF_RUNNER
    }
  ]
}] as const satisfies readonly TrainingTargetDefinition[];

export interface TrainingTargetStatus {
  id: TrainingTargetId;
  name: string;
  description: string;
  sourceUrl: string;
  revision: string;
  license: string;
  catalogueUrl: string;
  prepared: boolean;
  repositoryPath?: string;
}

export class TrainingTargetManager {
  constructor(
    private readonly storageRoot: string,
    private readonly catalogue: readonly TrainingTargetDefinition[] = TRAINING_TARGETS
  ) {}

  async list(): Promise<TrainingTargetStatus[]> {
    return Promise.all(this.catalogue.map((target) => this.status(target.id)));
  }

  async prepare(id: TrainingTargetId): Promise<TrainingTargetStatus> {
    const target = this.requireTarget(id);
    const repositoryPath = this.targetPath(target);
    if (await this.isPrepared(repositoryPath, target)) return this.status(id);

    await mkdir(this.storageRoot, { recursive: true });
    await this.removeManagedPath(repositoryPath);
    try {
      await execFileAsync("git", [
        "clone",
        "--filter=blob:none",
        "--no-checkout",
        target.cloneUrl,
        repositoryPath
      ], {
        cwd: this.storageRoot,
        maxBuffer: 10_000_000
      });
      await execFileAsync("git", ["checkout", "--detach", target.revision], {
        cwd: repositoryPath,
        maxBuffer: 10_000_000
      });
      if (await this.currentRevision(repositoryPath) !== target.revision) {
        throw new Error("The training target revision could not be verified.");
      }
      await this.installFixtures(repositoryPath, target);
      if (!await this.isPrepared(repositoryPath, target)) {
        throw new Error("The training target fixture overlay could not be verified.");
      }
      return this.status(id);
    } catch (error) {
      await this.removeManagedPath(repositoryPath);
      throw error;
    }
  }

  private async status(id: TrainingTargetId): Promise<TrainingTargetStatus> {
    const target = this.requireTarget(id);
    const repositoryPath = this.targetPath(target);
    const prepared = await this.isPrepared(repositoryPath, target);
    return {
      id: target.id,
      name: target.name,
      description: target.description,
      sourceUrl: target.sourceUrl,
      revision: target.revision,
      license: target.license,
      catalogueUrl: target.catalogueUrl,
      prepared,
      repositoryPath: prepared ? repositoryPath : undefined
    };
  }

  private targetPath(target: TrainingTargetDefinition): string {
    const suffix = target.fixtureVersion ? `-${target.fixtureVersion}` : "";
    return path.join(
      this.storageRoot,
      `${target.id}-${target.revision.slice(0, 12)}${suffix}`
    );
  }

  private requireTarget(id: string): TrainingTargetDefinition {
    const target = this.catalogue.find((entry) => entry.id === id);
    if (!target) throw new Error("Unknown training target.");
    return target;
  }

  private async currentRevision(repositoryPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd: repositoryPath
      });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  private async isPrepared(
    repositoryPath: string,
    target: TrainingTargetDefinition
  ): Promise<boolean> {
    const fixtures = target.fixtures ?? [];
    if (fixtures.length === 0) {
      return await this.currentRevision(repositoryPath) === target.revision;
    }
    try {
      const [{ stdout: parent }, { stdout: status }] = await Promise.all([
        execFileAsync("git", ["rev-parse", "HEAD^"], { cwd: repositoryPath }),
        execFileAsync("git", ["status", "--porcelain"], { cwd: repositoryPath })
      ]);
      if (parent.trim() !== target.revision || status.trim()) return false;
      for (const fixture of fixtures) {
        const fixturePath = this.resolveFixturePath(repositoryPath, fixture.path);
        if (await readFile(fixturePath, "utf8") !== fixture.content) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async installFixtures(
    repositoryPath: string,
    target: TrainingTargetDefinition
  ): Promise<void> {
    const fixtures = target.fixtures ?? [];
    if (fixtures.length === 0) return;
    for (const fixture of fixtures) {
      const fixturePath = this.resolveFixturePath(repositoryPath, fixture.path);
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, fixture.content);
    }
    await execFileAsync("git", [
      "add",
      "--",
      ...fixtures.map((fixture) => fixture.path)
    ], {
      cwd: repositoryPath,
      maxBuffer: 10_000_000
    });
    await execFileAsync("git", [
      "-c",
      "user.name=Inception Reality Engine",
      "-c",
      "user.email=reality-engine@localhost",
      "commit",
      "--no-gpg-sign",
      "-m",
      `Add ${target.name} local regression harness`
    ], {
      cwd: repositoryPath,
      maxBuffer: 10_000_000
    });
  }

  private resolveFixturePath(repositoryPath: string, relativePath: string): string {
    const resolvedRoot = path.resolve(repositoryPath);
    const resolvedFixture = path.resolve(resolvedRoot, relativePath);
    if (
      resolvedFixture === resolvedRoot
      || !resolvedFixture.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
      throw new Error("Training target fixture path escaped the repository.");
    }
    return resolvedFixture;
  }

  private async removeManagedPath(candidate: string): Promise<void> {
    const configuredRoot = path.resolve(this.storageRoot);
    const configuredCandidate = path.resolve(candidate);
    if (
      configuredCandidate === configuredRoot
      || !configuredCandidate.startsWith(`${configuredRoot}${path.sep}`)
    ) {
      throw new Error("Training target path escaped its managed storage root.");
    }
    const root = await realpath(this.storageRoot).catch(() => configuredRoot);
    const resolved = await realpath(candidate).catch(() =>
      path.join(root, path.relative(configuredRoot, configuredCandidate))
    );
    if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error("Training target path escaped its managed storage root.");
    }
    await rm(resolved, { recursive: true, force: true });
  }
}
