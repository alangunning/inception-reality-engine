import { createHash } from "node:crypto";
import type { MissionDependencyBootstrap } from "@inception/domain";
import type { WorktreeManagerPort } from "./worktree-port";

export interface DependencyBootstrapResult {
  status: "completed" | "failed";
  command: string;
  manifestPath: string;
  manifestSha256?: string;
  packageCount?: number;
  runtimeVersion?: string;
  runtimeExecutable?: string;
  packageManagerVersion?: string;
  exitCode?: number;
  durationMs: number;
  reused: boolean;
  diagnostic: string;
}

interface BootstrapMarker {
  kind: MissionDependencyBootstrap["kind"];
  manifestSha256: string;
  indexUrl: string;
  packageCount: number;
  runtimeVersion: string;
  runtimeExecutable: string;
  packageManagerVersion?: string;
}

const EXACT_REQUIREMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9_,.-]+\])?==[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const EXACT_RUNTIME_VERSION = /(?:^|[^\d])v?(\d+\.\d+\.\d+)(?:$|[^\d])/;

function pinnedRequirements(manifest: string): string[] {
  const entries = manifest
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!entries.length) {
    throw new Error("The approved dependency manifest is empty.");
  }
  const invalid = entries.find((entry) => !EXACT_REQUIREMENT.test(entry));
  if (invalid) {
    throw new Error(
      "Every approved dependency must use an exact package==version pin without URLs, options, or nested manifests."
    );
  }
  return entries;
}

function requirementVersions(requirements: string[]): Map<string, string> {
  return new Map(requirements.map((requirement) => {
    const [rawName, version] = requirement.split("==");
    const name = rawName!
      .replace(/\[.*\]$/, "")
      .toLowerCase()
      .replace(/[-_.]+/g, "-");
    return [name, version!] as const;
  }));
}

function manifestDigest(manifest: string): string {
  return createHash("sha256").update(manifest, "utf8").digest("hex");
}

function runtimeVersion(output: string): string {
  const match = output.trim().match(EXACT_RUNTIME_VERSION);
  if (!match?.[1]) {
    throw new Error("The host runtime returned an unrecognised version.");
  }
  return match[1];
}

function requiredRuntimeVersion(contract: MissionDependencyBootstrap): string | undefined {
  return contract.kind === "python-venv"
    ? contract.requiredPythonVersion
    : contract.requiredNodeVersion?.replace(/^v/, "");
}

function installCommand(
  contract: MissionDependencyBootstrap,
  pythonExecutable = contract.kind === "python-venv"
    ? contract.pythonExecutable === "auto" ? "python3|python" : contract.pythonExecutable
    : undefined
): string {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  if (contract.kind === "python-venv") {
    const python = `${contract.virtualEnvironmentPath}/bin/python`;
    return [
      `${pythonExecutable} -c 'import shutil,sys;shutil.rmtree(sys.argv[1],ignore_errors=True)' ${quote(contract.virtualEnvironmentPath)}`,
      `${pythonExecutable} -m venv ${quote(contract.virtualEnvironmentPath)}`,
      [
        `${python} -m pip --isolated install`,
        "--disable-pip-version-check --no-input --no-cache-dir --only-binary=:all: --no-deps",
        `--index-url ${quote(contract.indexUrl)}`,
        `-r ${quote(contract.manifestPath)}`
      ].join(" ")
    ].join(" && ");
  }
  return [
    `${contract.nodeExecutable} --version`,
    [
      `${contract.packageManagerExecutable} ci --ignore-scripts --no-audit --no-fund`,
      "--location=project --prefix=.",
      `--registry ${quote(contract.indexUrl)}`,
      `--cache ${quote(`${contract.dependencyPath}/.inception-npm-cache`)}`
    ].join(" ")
  ].join(" && ");
}

function nodeLockPackageCount(manifest: string, indexUrl: string): number {
  const lock = JSON.parse(manifest) as {
    lockfileVersion?: unknown;
    packages?: Record<string, {
      version?: unknown;
      resolved?: unknown;
      integrity?: unknown;
      link?: unknown;
    }>;
  };
  if (
    typeof lock.lockfileVersion !== "number"
    || lock.lockfileVersion < 2
    || !lock.packages
  ) {
    throw new Error("The approved Node manifest must be a package-lock.json with lockfileVersion 2 or newer.");
  }
  let count = 0;
  for (const [packagePath, entry] of Object.entries(lock.packages)) {
    if (!packagePath) continue;
    if (entry.link === true) {
      if (
        typeof entry.resolved !== "string"
        || entry.resolved.startsWith("/")
        || entry.resolved.startsWith("\\")
        || entry.resolved.split(/[\\/]/).includes("..")
        || !lock.packages[entry.resolved]
      ) {
        throw new Error("Every locked Node workspace link must resolve inside the Reality worktree.");
      }
      continue;
    }
    if (!packagePath.startsWith("node_modules/")) {
      continue;
    }
    if (typeof entry.version !== "string" || !entry.version) {
      throw new Error("Every locked Node package must retain an exact version.");
    }
    if (
      typeof entry.resolved !== "string"
      || !entry.resolved.startsWith(indexUrl)
      || typeof entry.integrity !== "string"
      || !/^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/.test(entry.integrity)
    ) {
      throw new Error(
        "Every locked Node package must use the approved npm registry and retain an integrity digest."
      );
    }
    count += 1;
  }
  if (!count) throw new Error("The approved Node lockfile contains no installable packages.");
  return count;
}

async function validateLocalPaths(
  worktrees: WorktreeManagerPort,
  worktreePath: string,
  contract: MissionDependencyBootstrap,
  markerPath: string,
  pythonExecutable?: string
): Promise<void> {
  const paths = [contract.manifestPath, dependencyRoot(contract), markerPath];
  const result = contract.kind === "python-venv"
    ? await worktrees.run(
        worktreePath,
        pythonExecutable ?? contract.pythonExecutable,
        [
          "-c",
          [
            "import os,sys",
            "manifest,environment,marker=sys.argv[1:]",
            "root=os.path.realpath(os.getcwd())",
            "inside=lambda candidate: os.path.commonpath([root,os.path.realpath(candidate)])==root",
            "valid=os.path.isfile(manifest) and not os.path.islink(manifest) and inside(manifest)",
            "valid=valid and inside(environment) and inside(marker)",
            "valid=valid and not os.path.islink(environment) and not os.path.islink(marker)",
            "raise SystemExit(0 if valid else 1)"
          ].join(";"),
          ...paths
        ]
      )
    : await worktrees.run(
        worktreePath,
        contract.nodeExecutable,
        [
          "-e",
          [
            "const fs=require('node:fs')",
            "const path=require('node:path')",
            "const [manifest,environment,marker]=process.argv.slice(1)",
            "const symlink=(path)=>fs.existsSync(path)&&fs.lstatSync(path).isSymbolicLink()",
            "const root=fs.realpathSync.native(process.cwd())",
            "const resolved=(candidate)=>fs.existsSync(candidate)?fs.realpathSync.native(candidate):path.resolve(candidate)",
            "const inside=(candidate)=>{const relative=path.relative(root,resolved(candidate));return relative!==''&&!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative)}",
            "const valid=fs.existsSync(manifest)&&fs.lstatSync(manifest).isFile()",
            "process.exit(valid&&inside(manifest)&&inside(environment)&&inside(marker)&&!symlink(manifest)&&!symlink(environment)&&!symlink(marker)?0:1)"
          ].join(";"),
          ...paths
        ]
      );
  if (result.exitCode !== 0) {
    throw new Error(
      "The dependency manifest must be a regular worktree file and the Reality-local environment must not cross a symbolic-link boundary."
    );
  }
}

function dependencyRoot(contract: MissionDependencyBootstrap): string {
  return contract.kind === "python-venv"
    ? contract.virtualEnvironmentPath
    : contract.dependencyPath;
}

async function verifyInstalledEnvironment(
  worktrees: WorktreeManagerPort,
  worktreePath: string,
  contract: MissionDependencyBootstrap,
  requirements: string[]
): Promise<{ exitCode: number; diagnostic?: string }> {
  if (contract.kind === "python-venv") {
    const result = await worktrees.run(
      worktreePath,
      `${contract.virtualEnvironmentPath}/bin/python`,
      ["-m", "pip", "list", "--disable-pip-version-check", "--format=json"]
    );
    if (result.exitCode !== 0) {
      return { exitCode: result.exitCode, diagnostic: "The Reality-local pip environment could not be inspected." };
    }
    try {
      const installed = JSON.parse(result.stdout) as Array<{ name?: unknown; version?: unknown }>;
      const versions = new Map(installed
        .filter((entry): entry is { name: string; version: string } =>
          typeof entry.name === "string" && typeof entry.version === "string"
        )
        .map((entry) => [
          entry.name.toLowerCase().replace(/[-_.]+/g, "-"),
          entry.version
        ]));
      const missing = [...requirementVersions(requirements)].find(([name, version]) =>
        versions.get(name) !== version
      );
      if (missing) {
        return {
          exitCode: 1,
          diagnostic: `The Reality-local Python environment is missing the exact ${missing[0]}==${missing[1]} pin.`
        };
      }
      const compatible = await worktrees.run(
        worktreePath,
        `${contract.virtualEnvironmentPath}/bin/python`,
        ["-m", "pip", "check", "--disable-pip-version-check"]
      );
      return compatible.exitCode === 0
        ? { exitCode: 0 }
        : {
            exitCode: compatible.exitCode,
            diagnostic: "The exact Python pins do not form a compatible Reality-local environment."
          };
    } catch {
      return { exitCode: 1, diagnostic: "The Reality-local pip package inventory was invalid." };
    }
  }
  const result = await worktrees.run(
    worktreePath,
    contract.packageManagerExecutable,
    ["ls", "--all", "--json", "--prefix=."]
  );
  return result.exitCode === 0
    ? { exitCode: 0 }
    : {
        exitCode: result.exitCode,
        diagnostic: "The Reality-local npm dependency tree is incomplete."
      };
}

async function resolveRuntime(
  worktrees: WorktreeManagerPort,
  worktreePath: string,
  contract: MissionDependencyBootstrap
): Promise<{
  executable: string;
  version: string;
}> {
  const candidates = contract.kind === "python-venv"
    ? contract.pythonExecutable === "auto"
      ? ["python3", "python"]
      : [contract.pythonExecutable]
    : [contract.nodeExecutable];
  for (const executable of candidates) {
    const runtime = await worktrees.run(worktreePath, executable, ["--version"]);
    if (runtime.exitCode !== 0) continue;
    try {
      const version = runtimeVersion(`${runtime.stdout}\n${runtime.stderr}`);
      if (contract.kind === "python-venv" && !version.startsWith("3.")) continue;
      return { executable, version };
    } catch {
      continue;
    }
  }
  throw new Error(
    `${contract.kind === "python-venv" ? "Python 3" : "Node"} is unavailable on the host; the bootstrap will not install or replace it.`
  );
}

export class DependencyBootstrapService {
  async bootstrap(
    worktrees: WorktreeManagerPort,
    worktreePath: string,
    contract: MissionDependencyBootstrap
  ): Promise<DependencyBootstrapResult> {
    const started = Date.now();
    let command = installCommand(contract);
    try {
      const dependencyPath = dependencyRoot(contract);
      const markerPath = `${dependencyPath}/.inception-bootstrap.json`;
      const tracked = await worktrees.run(
        worktreePath,
        "git",
        ["ls-files", "--error-unmatch", "--", contract.manifestPath]
      );
      if (tracked.exitCode !== 0) {
        throw new Error("The parent-authorized dependency manifest must be tracked by the target repository.");
      }
      const ignored = await worktrees.run(
        worktreePath,
        "git",
        ["check-ignore", "-q", "--", dependencyPath]
      );
      if (ignored.exitCode !== 0) {
        throw new Error(
          `The parent must ignore ${dependencyPath} before Reality-local dependencies may be installed.`
        );
      }
      const runtime = await resolveRuntime(worktrees, worktreePath, contract);
      const detectedRuntimeVersion = runtime.version;
      if (contract.kind === "python-venv") {
        command = installCommand(contract, runtime.executable);
      }
      const requiredVersion = requiredRuntimeVersion(contract);
      if (requiredVersion && detectedRuntimeVersion !== requiredVersion) {
        throw new Error(
          `${contract.kind === "python-venv" ? "Python" : "Node"} ${requiredVersion} is required, but ${detectedRuntimeVersion} is installed; the bootstrap will not alter the host runtime.`
        );
      }
      await validateLocalPaths(
        worktrees,
        worktreePath,
        contract,
        markerPath,
        contract.kind === "python-venv" ? runtime.executable : undefined
      );
      const manifest = await worktrees.readFile(worktreePath, contract.manifestPath);
      const requirements = contract.kind === "python-venv"
        ? pinnedRequirements(manifest)
        : [];
      const packageCount = contract.kind === "python-venv"
        ? requirements.length
        : nodeLockPackageCount(manifest, contract.indexUrl);
      const manifestSha256 = manifestDigest(manifest);
      let packageManagerVersion: string | undefined;
      if (contract.kind === "node-npm") {
        const packageManager = await worktrees.run(
          worktreePath,
          contract.packageManagerExecutable,
          ["--version"]
        );
        if (packageManager.exitCode !== 0) {
          throw new Error("npm is unavailable on the host; the bootstrap will not install or replace it.");
        }
        packageManagerVersion = packageManager.stdout.trim() || packageManager.stderr.trim();
        if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(packageManagerVersion)) {
          throw new Error("npm returned an unrecognised version.");
        }
      }
      const existing = await worktrees.readFile(worktreePath, markerPath)
        .then((value) => JSON.parse(value) as BootstrapMarker)
        .catch(() => undefined);
      if (
        existing?.kind === contract.kind
        && existing.manifestSha256 === manifestSha256
        && existing.indexUrl === contract.indexUrl
        && existing.packageCount === packageCount
        && existing.runtimeVersion === detectedRuntimeVersion
        && existing.runtimeExecutable === runtime.executable
        && existing.packageManagerVersion === packageManagerVersion
      ) {
        const available = await worktrees.run(
          worktreePath,
          contract.kind === "python-venv"
            ? `${contract.virtualEnvironmentPath}/bin/python`
            : contract.nodeExecutable,
          ["--version"]
        );
        const verified = available.exitCode === 0
          ? await verifyInstalledEnvironment(
              worktrees,
              worktreePath,
              contract,
              requirements
            )
          : { exitCode: available.exitCode };
        if (verified.exitCode === 0) {
          return {
            status: "completed",
            command,
            manifestPath: contract.manifestPath,
            manifestSha256,
            packageCount,
            runtimeVersion: detectedRuntimeVersion,
            runtimeExecutable: runtime.executable,
            packageManagerVersion,
            durationMs: Date.now() - started,
            reused: true,
            diagnostic: `The Reality-local pinned ${contract.kind === "python-venv" ? "Python" : "Node"} environment was already verified.`
          };
        }
      }

      if (contract.kind === "python-venv") {
        const cleaned = await worktrees.run(
          worktreePath,
          runtime.executable,
          [
            "-c",
            "import shutil,sys;shutil.rmtree(sys.argv[1],ignore_errors=True)",
            contract.virtualEnvironmentPath
          ]
        );
        if (cleaned.exitCode !== 0) {
          return {
            status: "failed",
            command,
            manifestPath: contract.manifestPath,
            manifestSha256,
            packageCount,
            runtimeVersion: detectedRuntimeVersion,
            runtimeExecutable: runtime.executable,
            packageManagerVersion,
            exitCode: cleaned.exitCode,
            durationMs: Date.now() - started,
            reused: false,
            diagnostic: "Python could not clear the previous Reality-local virtual environment."
          };
        }
        const created = await worktrees.run(
          worktreePath,
          runtime.executable,
          ["-m", "venv", contract.virtualEnvironmentPath]
        );
        if (created.exitCode !== 0) {
          return {
            status: "failed",
            command,
            manifestPath: contract.manifestPath,
            manifestSha256,
            packageCount,
            runtimeVersion: detectedRuntimeVersion,
            runtimeExecutable: runtime.executable,
            packageManagerVersion,
            exitCode: created.exitCode,
            durationMs: Date.now() - started,
            reused: false,
            diagnostic: "Python could not create the Reality-local virtual environment."
          };
        }
      }

      const installed = await worktrees.run(
        worktreePath,
        contract.kind === "python-venv"
          ? `${contract.virtualEnvironmentPath}/bin/python`
          : contract.packageManagerExecutable,
        contract.kind === "python-venv"
          ? [
              "-m",
              "pip",
              "--isolated",
              "install",
              "--disable-pip-version-check",
              "--no-input",
              "--no-cache-dir",
              "--only-binary=:all:",
              "--no-deps",
              "--index-url",
              contract.indexUrl,
              "-r",
              contract.manifestPath
            ]
          : [
              "ci",
              "--ignore-scripts",
              "--no-audit",
              "--no-fund",
              "--location=project",
              "--prefix=.",
              "--registry",
              contract.indexUrl,
              "--cache",
              `${contract.dependencyPath}/.inception-npm-cache`
            ]
      );
      if (installed.exitCode !== 0) {
        return {
          status: "failed",
          command,
          manifestPath: contract.manifestPath,
          manifestSha256,
          packageCount,
          runtimeVersion: detectedRuntimeVersion,
          runtimeExecutable: runtime.executable,
          packageManagerVersion,
          exitCode: installed.exitCode,
          durationMs: Date.now() - started,
          reused: false,
          diagnostic: "The pinned dependency installation did not complete inside this Reality."
        };
      }

      const verified = await verifyInstalledEnvironment(
        worktrees,
        worktreePath,
        contract,
        requirements
      );
      if (verified.exitCode !== 0) {
        return {
          status: "failed",
          command,
          manifestPath: contract.manifestPath,
          manifestSha256,
          packageCount,
          runtimeVersion: detectedRuntimeVersion,
          runtimeExecutable: runtime.executable,
          packageManagerVersion,
          exitCode: verified.exitCode,
          durationMs: Date.now() - started,
          reused: false,
          diagnostic: verified.diagnostic ?? "The Reality-local dependency inventory could not be verified."
        };
      }

      const marker: BootstrapMarker = {
        kind: contract.kind,
        manifestSha256,
        indexUrl: contract.indexUrl,
        packageCount,
        runtimeVersion: detectedRuntimeVersion,
        runtimeExecutable: runtime.executable,
        packageManagerVersion
      };
      await worktrees.writeFile(
        worktreePath,
        markerPath,
        `${JSON.stringify(marker, null, 2)}\n`
      );
      return {
        status: "completed",
        command,
        manifestPath: contract.manifestPath,
        manifestSha256,
        packageCount,
        runtimeVersion: detectedRuntimeVersion,
        runtimeExecutable: runtime.executable,
        packageManagerVersion,
        durationMs: Date.now() - started,
        reused: false,
        diagnostic: "Pinned dependencies installed inside the Reality-local dependency environment."
      };
    } catch (error) {
      return {
        status: "failed",
        command,
        manifestPath: contract.manifestPath,
        exitCode: 1,
        durationMs: Date.now() - started,
        reused: false,
        diagnostic: error instanceof Error
          ? error.message
          : "The parent-authorized dependency bootstrap could not be validated."
      };
    }
  }
}
