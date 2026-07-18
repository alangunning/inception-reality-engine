import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CodexExecutionEnvironmentOptions {
  env?: Record<string, string | undefined>;
  runtimeCodexHome?: string;
  sourceCodexHome?: string;
  inheritUserConfig?: boolean;
}

export interface PreparedCodexExecutionEnvironment {
  env: Record<string, string>;
  codexHome: string;
  configuration: "isolated" | "inherited";
  cliAuthLinked: boolean;
  sessionStateLinked: boolean;
  modelMetadataLinked: boolean;
}

function enabled(value: string | undefined): boolean {
  return /^(?:1|true|yes|on)$/i.test(value?.trim() ?? "");
}

function absolutePath(candidate: string, base = process.cwd()): string {
  return path.isAbsolute(candidate) ? candidate : path.resolve(base, candidate);
}

function safeEnvironment(source: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => key !== "NODE_ENV" && value !== undefined)
  ) as Record<string, string>;
}

function destinationReady(source: string, destination: string): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  if (!stat.isSymbolicLink()) return true;

  const linkedPath = path.resolve(path.dirname(destination), fs.readlinkSync(destination));
  if (linkedPath === path.resolve(source)) return true;
  fs.unlinkSync(destination);
  return false;
}

function linkCliAuth(sourceAuth: string, runtimeAuth: string): boolean {
  if (!fs.existsSync(sourceAuth)) return false;
  if (path.resolve(sourceAuth) === path.resolve(runtimeAuth)) return true;

  if (destinationReady(sourceAuth, runtimeAuth)) return true;

  try {
    fs.symlinkSync(sourceAuth, runtimeAuth, "file");
    return true;
  } catch (symlinkError) {
    try {
      fs.linkSync(sourceAuth, runtimeAuth);
      return true;
    } catch {
      throw new Error(
        `Codex CLI authentication could not be linked into the isolated runtime home at ${runtimeAuth}. `
        + "Set CODEX_API_KEY, OPENAI_API_KEY, or INCEPTION_CODEX_INHERIT_USER_CONFIG=true.",
        { cause: symlinkError }
      );
    }
  }
}

function linkSessionDirectory(sourceSessions: string, runtimeSessions: string): boolean {
  if (!fs.existsSync(sourceSessions)) return false;
  if (destinationReady(sourceSessions, runtimeSessions)) return true;
  try {
    fs.symlinkSync(
      sourceSessions,
      runtimeSessions,
      process.platform === "win32" ? "junction" : "dir"
    );
    return true;
  } catch {
    return false;
  }
}

function linkOptionalFile(sourceFile: string, runtimeFile: string): boolean {
  if (!fs.existsSync(sourceFile)) return false;
  if (destinationReady(sourceFile, runtimeFile)) return true;
  try {
    fs.symlinkSync(sourceFile, runtimeFile, "file");
    return true;
  } catch {
    try {
      fs.linkSync(sourceFile, runtimeFile);
      return true;
    } catch {
      return false;
    }
  }
}

export function prepareCodexExecutionEnvironment(
  options: CodexExecutionEnvironmentOptions = {}
): PreparedCodexExecutionEnvironment {
  const source = options.env ?? process.env;
  const env = safeEnvironment(source);
  const sourceCodexHome = absolutePath(
    options.sourceCodexHome
      ?? source.CODEX_HOME?.trim()
      ?? path.join(os.homedir(), ".codex")
  );
  const inheritUserConfig = options.inheritUserConfig
    ?? enabled(source.INCEPTION_CODEX_INHERIT_USER_CONFIG);

  if (inheritUserConfig) {
    if (source.CODEX_HOME?.trim()) env.CODEX_HOME = sourceCodexHome;
    return {
      env,
      codexHome: sourceCodexHome,
      configuration: "inherited",
      cliAuthLinked: false,
      sessionStateLinked: false,
      modelMetadataLinked: false
    };
  }

  const configuredRuntimeHome = options.runtimeCodexHome
    ?? source.INCEPTION_CODEX_RUNTIME_HOME?.trim()
    ?? path.join(process.cwd(), ".inception", "codex-home");
  const runtimeCodexHome = absolutePath(configuredRuntimeHome);
  if (runtimeCodexHome === sourceCodexHome) {
    throw new Error(
      "INCEPTION_CODEX_RUNTIME_HOME must differ from CODEX_HOME so personal Codex plugins remain isolated."
    );
  }

  fs.mkdirSync(runtimeCodexHome, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") fs.chmodSync(runtimeCodexHome, 0o700);
  env.CODEX_HOME = runtimeCodexHome;
  env.CODEX_SQLITE_HOME = source.CODEX_SQLITE_HOME?.trim()
    ? absolutePath(source.CODEX_SQLITE_HOME)
    : fs.existsSync(sourceCodexHome)
      ? sourceCodexHome
      : runtimeCodexHome;

  const hasApiKey = Boolean(env.CODEX_API_KEY?.trim() || env.OPENAI_API_KEY?.trim());
  const cliAuthLinked = hasApiKey
    ? false
    : linkCliAuth(
        path.join(sourceCodexHome, "auth.json"),
        path.join(runtimeCodexHome, "auth.json")
      );
  const sessionStateLinked = linkSessionDirectory(
    path.join(sourceCodexHome, "sessions"),
    path.join(runtimeCodexHome, "sessions")
  );
  const modelMetadataLinked = linkOptionalFile(
    path.join(sourceCodexHome, "models_cache.json"),
    path.join(runtimeCodexHome, "models_cache.json")
  );

  return {
    env,
    codexHome: runtimeCodexHome,
    configuration: "isolated",
    cliAuthLinked,
    sessionStateLinked,
    modelMetadataLinked
  };
}

export function normaliseCodexExecutionError(error: unknown, safeRuntimeDetail?: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /(?:rmcp|mcp server|oauth-protected-resource)/i.test(message)
    && /(?:AuthRequired|invalid_token|missing or invalid access token)/i.test(message)
  ) {
    return new Error(
      "Codex could not start because an MCP server rejected its OAuth credential. "
      + "Reality Engine isolates personal Codex plugins by default; re-authenticate project MCPs "
      + "or disable INCEPTION_CODEX_INHERIT_USER_CONFIG, then retry.",
      { cause: error }
    );
  }
  if (/flagged for possible cybersecurity risk/i.test(safeRuntimeDetail ?? message)) {
    return new Error(
      "Codex declined this Reality because its mission wording triggered the cybersecurity safety gate. "
      + "No memory or code entered the parent Reality; use an authorized defensive source-review "
      + "and local-test mission, then retry.",
      { cause: error }
    );
  }
  return error instanceof Error ? error : new Error(message);
}
