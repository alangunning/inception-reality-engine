import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const mode = process.argv[2] ?? "check";
const envFile = path.join(repoRoot, ".env");

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function codexAuthStatus() {
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
  const authFile = path.join(codexHome, "auth.json");
  const requestedMode = process.env.INCEPTION_CODEX_AUTH_MODE?.trim().toLowerCase() || "auto";
  if (!["auto", "cli", "api"].includes(requestedMode)) {
    return {
      ready: false,
      source: "INCEPTION_CODEX_AUTH_MODE must be auto, cli, or api"
    };
  }
  const apiKeySource = process.env.CODEX_API_KEY?.trim()
    ? "CODEX_API_KEY"
    : process.env.OPENAI_API_KEY?.trim()
      ? "OPENAI_API_KEY"
      : null;
  let cliSource = null;
  try {
    const auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
    const loggedIn = typeof auth.auth_mode === "string"
      && (
        typeof auth.tokens?.access_token === "string" && auth.tokens.access_token.length > 0
        || typeof auth.OPENAI_API_KEY === "string" && auth.OPENAI_API_KEY.length > 0
      );
    if (loggedIn) cliSource = `${auth.auth_mode} login at ${authFile}`;
  } catch {
    cliSource = null;
  }

  if (requestedMode === "cli") {
    return { ready: Boolean(cliSource), source: cliSource ?? authFile };
  }
  if (requestedMode === "api") {
    return { ready: Boolean(apiKeySource), source: apiKeySource ?? "CODEX_API_KEY or OPENAI_API_KEY" };
  }
  if (process.env.CODEX_API_KEY?.trim()) {
    return { ready: true, source: "CODEX_API_KEY" };
  }
  if (cliSource) return { ready: true, source: cliSource };
  if (apiKeySource) return { ready: true, source: apiKeySource };
  return { ready: false, source: authFile };
}

if (!["mock", "real", "check"].includes(mode)) {
  console.error(`Unknown Codex mode: ${mode}`);
  process.exit(1);
}

const auth = codexAuthStatus();
if (mode === "check" || mode === "real") {
  if (!auth.ready) {
    console.error("Codex authentication was not found.");
    console.error(`Run \`codex login\`, or set INCEPTION_CODEX_AUTH_MODE=api with CODEX_API_KEY or OPENAI_API_KEY in ${envFile}.`);
    console.error(`Checked ${auth.source}.`);
    process.exit(1);
  }
  console.log(`Codex authentication ready: ${auth.source}.`);
}

if (mode === "check") process.exit(0);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["run", "dev"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    INCEPTION_CODEX_MODE: mode
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
