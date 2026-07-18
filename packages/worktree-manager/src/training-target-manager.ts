import { execFile } from "node:child_process";
import { mkdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

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
}

export const TRAINING_TARGETS = [{
  id: "vampi",
  name: "VAmPI",
  description: "A small, deliberately vulnerable Flask API for authorized local security training.",
  sourceUrl: "https://github.com/erev0s/VAmPI",
  cloneUrl: "https://github.com/erev0s/VAmPI.git",
  revision: "f16052dce83f05847133ec98f01c5193a41de7d8",
  license: "MIT",
  catalogueUrl: "https://ctf.owasp.org/"
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
    const repositoryPath = this.targetPath(target.id, target.revision);
    const existing = await this.currentRevision(repositoryPath);
    if (existing === target.revision) return this.status(id);

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
      const checkedOut = await this.currentRevision(repositoryPath);
      if (checkedOut !== target.revision) {
        throw new Error("The training target revision could not be verified.");
      }
      return this.status(id);
    } catch (error) {
      await this.removeManagedPath(repositoryPath);
      throw error;
    }
  }

  private async status(id: TrainingTargetId): Promise<TrainingTargetStatus> {
    const target = this.requireTarget(id);
    const repositoryPath = this.targetPath(target.id, target.revision);
    const prepared = await this.currentRevision(repositoryPath) === target.revision;
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

  private targetPath(id: TrainingTargetId, revision: string): string {
    return path.join(this.storageRoot, `${id}-${revision.slice(0, 12)}`);
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
