import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@inception/domain",
    "@inception/orchestrator",
    "@inception/codex-runtime",
    "@inception/worktree-manager"
  ],
  serverExternalPackages: ["@prisma/client", "@openai/codex-sdk"]
};

export default nextConfig;
