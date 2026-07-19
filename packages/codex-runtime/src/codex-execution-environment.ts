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
  authMode: "auto" | "cli" | "api";
  authSource: "cli" | "api-key" | "none";
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

function requestedAuthMode(value: string | undefined): PreparedCodexExecutionEnvironment["authMode"] {
  const mode = value?.trim().toLowerCase() || "auto";
  if (mode === "auto" || mode === "cli" || mode === "api") return mode;
  throw new Error("INCEPTION_CODEX_AUTH_MODE must be auto, cli, or api.");
}

function cliAuthReady(authFile: string): boolean {
  try {
    const auth = JSON.parse(fs.readFileSync(authFile, "utf8")) as {
      auth_mode?: unknown;
      OPENAI_API_KEY?: unknown;
      tokens?: { access_token?: unknown };
    };
    return typeof auth.auth_mode === "string"
      && (
        typeof auth.tokens?.access_token === "string" && auth.tokens.access_token.length > 0
        || typeof auth.OPENAI_API_KEY === "string" && auth.OPENAI_API_KEY.length > 0
      );
  } catch {
    return false;
  }
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
  const authMode = requestedAuthMode(source.INCEPTION_CODEX_AUTH_MODE);
  const sourceAuth = path.join(sourceCodexHome, "auth.json");
  const cliAuthAvailable = cliAuthReady(sourceAuth);
  const codexApiKeyAvailable = Boolean(env.CODEX_API_KEY?.trim());
  const openAiApiKeyAvailable = Boolean(env.OPENAI_API_KEY?.trim());
  const apiKeyAvailable = codexApiKeyAvailable || openAiApiKeyAvailable;
  const authSource: PreparedCodexExecutionEnvironment["authSource"] =
    authMode === "cli"
      ? cliAuthAvailable ? "cli" : "none"
      : authMode === "api"
        ? apiKeyAvailable ? "api-key" : "none"
        : codexApiKeyAvailable
          ? "api-key"
          : cliAuthAvailable
            ? "cli"
            : openAiApiKeyAvailable
              ? "api-key"
              : "none";
  if (authMode === "cli" && authSource === "none") {
    throw new Error(`Codex CLI authentication was not found at ${sourceAuth}. Run \`codex login\` and retry.`);
  }
  if (authMode === "api" && authSource === "none") {
    throw new Error("API-key authentication was selected, but CODEX_API_KEY or OPENAI_API_KEY is not set.");
  }
  if (authSource === "cli") {
    delete env.CODEX_API_KEY;
    delete env.OPENAI_API_KEY;
  }
  const inheritUserConfig = options.inheritUserConfig
    ?? enabled(source.INCEPTION_CODEX_INHERIT_USER_CONFIG);

  if (inheritUserConfig) {
    if (source.CODEX_HOME?.trim()) env.CODEX_HOME = sourceCodexHome;
    return {
      env,
      codexHome: sourceCodexHome,
      configuration: "inherited",
      authMode,
      authSource,
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

  const cliAuthLinked = authSource === "cli"
    ? linkCliAuth(
        sourceAuth,
        path.join(runtimeCodexHome, "auth.json")
      )
    : false;
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
    authMode,
    authSource,
    cliAuthLinked,
    sessionStateLinked,
    modelMetadataLinked
  };
}

export function normaliseCodexExecutionError(
  error: unknown,
  safeRuntimeDetail?: string,
  authSource: PreparedCodexExecutionEnvironment["authSource"] = "none"
): Error {
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
  if (/quota exceeded|usage limit|billing details/i.test(safeRuntimeDetail ?? message)) {
    const detail = authSource === "api-key"
      ? "OpenAI API-key quota rejected this turn. Reality Engine used API-key authentication; check that key's project budget, or set INCEPTION_CODEX_AUTH_MODE=cli to use the Codex CLI login."
      : authSource === "cli"
        ? "Codex CLI quota rejected this turn. Reality Engine used ChatGPT/Codex CLI authentication; run `codex login status` and confirm the selected workspace has usage remaining."
        : "The selected Codex authentication source rejected this turn because no quota was available. Check Admin for the active authentication source before retrying.";
    return new Error(detail, { cause: error });
  }
  if (safeRuntimeDetail) {
    return new Error(`Codex could not complete this turn: ${safeRuntimeDetail}`, { cause: error });
  }
  if (/Codex Exec exited with code \d+/i.test(message)) {
    const runtime = authSource === "cli"
      ? "Codex CLI"
      : authSource === "api-key"
        ? "Codex API-key runtime"
        : "Codex runtime";
    return new Error(
      `${runtime} exited before returning a model diagnostic. `
      + "No validated memory or code entered this Reality; confirm the authentication source in Admin, then retry.",
      { cause: error }
    );
  }
  return error instanceof Error ? error : new Error(message);
}
