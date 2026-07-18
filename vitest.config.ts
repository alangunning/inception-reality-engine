import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@inception/domain": path.resolve(__dirname, "packages/domain/src/index.ts"),
      "@inception/orchestrator": path.resolve(__dirname, "packages/orchestrator/src/index.ts"),
      "@inception/codex-runtime": path.resolve(__dirname, "packages/codex-runtime/src/index.ts"),
      "@inception/worktree-manager": path.resolve(__dirname, "packages/worktree-manager/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    exclude: ["demo/**", "node_modules/**", ".inception/**"]
  }
});
