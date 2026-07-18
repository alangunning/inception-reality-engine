import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

function run(args) {
  return execFileSync("git", args, { cwd: repo, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

// Use a repository owned by this project rather than accidentally attaching
// Reality worktrees to a Git repository in a parent directory.
if (!fs.existsSync(path.join(repo, ".git"))) {
  run(["init", "-b", "main"]);
  run(["config", "user.email", "inception@local.demo"]);
  run(["config", "user.name", "Inception Reality Engine"]);
}

try { run(["config", "user.email"]); } catch { run(["config", "user.email", "inception@local.demo"]); }
try { run(["config", "user.name"]); } catch { run(["config", "user.name", "Inception Reality Engine"]); }

let hasHead = true;
try { run(["rev-parse", "HEAD"]); } catch { hasHead = false; }
if (!hasHead) {
  const gitignore = path.join(repo, ".gitignore");
  if (!fs.existsSync(gitignore)) fs.writeFileSync(gitignore, "node_modules\n.next\n.inception\nprisma/dev.db\n");
  run(["add", "."]);
  run(["commit", "-m", "Seed Inception Reality Engine"]);
}
