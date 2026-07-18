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
  const apiKeySource = process.env.CODEX_API_KEY?.trim()
    ? "CODEX_API_KEY"
    : process.env.OPENAI_API_KEY?.trim()
      ? "OPENAI_API_KEY"
      : null;
  if (apiKeySource) return { ready: true, source: apiKeySource };

  const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
  const authFile = path.join(codexHome, "auth.json");
  try {
    const auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
    const loggedIn = typeof auth.auth_mode === "string"
      && typeof auth.tokens?.access_token === "string"
      && auth.tokens.access_token.length > 0;
    return {
      ready: loggedIn,
      source: loggedIn ? `${auth.auth_mode} login at ${authFile}` : authFile
    };
  } catch {
    return { ready: false, source: authFile };
  }
}

if (!["mock", "real", "check"].includes(mode)) {
  console.error(`Unknown Codex mode: ${mode}`);
  process.exit(1);
}

const auth = codexAuthStatus();
if (mode === "check" || mode === "real") {
  if (!auth.ready) {
    console.error("Codex authentication was not found.");
    console.error(`Run \`codex login\`, or set OPENAI_API_KEY (or CODEX_API_KEY) in ${envFile}.`);
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
