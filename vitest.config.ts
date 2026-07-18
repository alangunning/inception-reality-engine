import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@inception/domain": path.resolve(import.meta.dirname, "packages/domain/src/index.ts"),
      "@inception/orchestrator": path.resolve(import.meta.dirname, "packages/orchestrator/src/index.ts"),
      "@inception/codex-runtime": path.resolve(import.meta.dirname, "packages/codex-runtime/src/index.ts"),
      "@inception/worktree-manager": path.resolve(import.meta.dirname, "packages/worktree-manager/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    exclude: ["demo/**", "node_modules/**", ".inception/**"]
  }
});
