import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: {
    root: repoRoot
  },
  transpilePackages: [
    "@inception/domain",
    "@inception/orchestrator",
    "@inception/codex-runtime",
    "@inception/worktree-manager"
  ],
  serverExternalPackages: ["@prisma/client", "@openai/codex-sdk"]
};

export default nextConfig;
