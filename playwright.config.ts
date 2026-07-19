import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const repoRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  testDir: "./apps/web/e2e",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.02
    }
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run build -w @inception/web && npm run start -w @inception/web",
    url: "http://127.0.0.1:3100/api/demo",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: "3100",
      DATABASE_URL: `file:${path.join(repoRoot, "prisma", "playwright.db")}`,
      INCEPTION_CODEX_MODE: "mock",
      INCEPTION_PERSISTENCE: "sqlite",
      INCEPTION_REPO_ROOT: repoRoot,
      INCEPTION_WORKTREE_ROOT: path.join(repoRoot, ".inception", "playwright-worktrees"),
      INCEPTION_BRANCH_PREFIX: "inception-playwright",
      INCEPTION_MOCK_DELAY_MS: "2400",
      NEXT_DIST_DIR: ".next-playwright",
      NEXT_TELEMETRY_DISABLED: "1"
    }
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 900 }
      }
    }
  ]
});
