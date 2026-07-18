import { expect, test, type Page } from "@playwright/test";

async function resetRun(page: Page): Promise<void> {
  const response = await page.request.post("/api/demo/reset");
  expect(response.ok()).toBe(true);
}

async function expectNext(page: Page, label: string): Promise<void> {
  await expect(page.getByTestId("next-move")).toHaveText(label, { timeout: 12_000 });
}

test.beforeEach(async ({ page }) => {
  await resetRun(page);
});

test("initial Reality is idle, explicit, responsive, and usage-safe", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "A waking world, one untested belief" })).toBeVisible();
  await expectNext(page, "Ask Codex to audit and improve password-reset security");
  await expect(page.getByTestId("primary-action")).toContainText("Ask Codex");
  await expect(page.getByTestId("action-dock")).toContainText("REHEARSED CODEX RUNTIME");
  await expect(page.getByTestId("reset-run")).toHaveText(/Full reset/);
  await expect(page.getByTestId("operation-monitor")).toHaveCount(0);
  await expect(page.getByTestId("simulated-world-time")).toContainText("0");

  await page.getByTestId("admin-trigger").click();
  await expect(page.getByTestId("admin-drawer")).toBeVisible();
  await expect(page.getByTestId("admin-drawer")).toContainText("No active Codex CLI executions");
  await expect(page.getByTestId("admin-drawer")).toContainText("RETROSPECTIVE RUN LOG");
  await expect(page.getByTestId("admin-drawer")).toContainText("Export current safe run log");
  await expect(page.getByTestId("admin-drawer")).toContainText("Full reset and cleanup");
  await page.getByRole("button", { name: "Close admin controls" }).click();

  const viewportFits = await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth
  );
  expect(viewportFits).toBe(true);
  const dockFits = await page.getByTestId("action-dock").evaluate((element) =>
    element.scrollWidth <= element.clientWidth
  );
  expect(dockFits).toBe(true);

  await expect(page).toHaveScreenshot("initial-idle.png", {
    fullPage: true
  });
});

test("live operation survives refresh and returns timestamped, filterable events", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The mobile project focuses on responsive visual coverage.");
  await page.goto("/");

  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("operation-monitor")).toBeVisible();
  await expect(page.getByTestId("operation-monitor")).toContainText("LIVE OPERATION");
  await expect(page.getByTestId("operation-monitor")).toContainText(/Ask Codex to audit and improve password-reset security/i);
  await expect(page.getByTestId("operation-monitor")).toContainText(/\d+ tool calls/);
  await expect(page.getByTestId("primary-action")).toBeDisabled();

  await page.reload();
  await expect(page.getByTestId("operation-monitor")).toBeVisible();
  await expect(page.getByTestId("operation-monitor")).toContainText(/LIVE OPERATION TIME|LIVE OPERATION/);
  await expect(page.getByTestId("reset-run")).toBeDisabled();

  await expectNext(page, "Create Dream: Under coordinated attack");
  await expect(page.getByTestId("operation-monitor")).toHaveCount(0);
  await expect(page.getByTestId("dream-action")).toBeEnabled();
  await expect(page.getByTestId("dream-action")).toHaveText(/Create attack Dream/);
  await expect(page.getByTestId("simulated-world-time")).toContainText("12");

  const feed = page.getByTestId("event-feed");
  await feed.locator("select").selectOption("codex");
  await expect(page.getByTestId("event-row").first().locator("time")).toContainText(/\d{2}:\d{2}:\d{2}/);
  await expect(feed).not.toContainText("Codex began a bounded operation");
  await expect(feed).not.toContainText(/DREAM T\+/);
  await feed.getByRole("searchbox").fill("vitest");
  await expect(page.getByTestId("event-row")).toHaveCount(1);
  await expect(page.getByTestId("event-row")).toContainText("vitest run demo/password-reset");
  await feed.getByRole("button", { name: "Oldest events first" }).click();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("reset-run").click();
  await expectNext(page, "Create Dream: Under coordinated attack");
});

test("the complete mocked narrative remains visually coherent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The full narrative is captured once at desktop density.");
  await page.goto("/");

  await page.getByTestId("primary-action").click();
  await expectNext(page, "Create Dream: Under coordinated attack");
  await page.getByTestId("dream-action").click();
  await expectNext(page, "Enter attacker, investigator, and test engineer into Under coordinated attack");
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Ask Codex to investigate coordinated password-reset abuse");
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Create nested Dream: Rotating IP swarm");
  await page.getByTestId("dream-action").click();
  await expectNext(page, "Kick Rotating IP swarm: return validated memory");
  await page.getByTestId("kick-action").click();
  await expectNext(page, "Kick Under coordinated attack: return validated memory");
  await page.getByTestId("kick-action").click();
  await expectNext(page, "Synthesise returned memories into the Waking Reality implementation");
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Run 3 parent-owned requirements");
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Stabilise Waking Reality");
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Reality stabilised");

  await expect(page.locator(".reality-node")).toHaveCount(3);
  await expect(page.locator(".anchor-passed")).toHaveCount(3);
  await expect(page.locator(".memory-report")).toHaveCount(2);
  await expect(page.locator(".diff-workspace")).toBeVisible();
  await expect(page.getByTestId("outcome-summary")).toContainText("Password reset now survives rotating-source abuse");
  await expect(page.getByTestId("outcome-summary")).toContainText("3 of 3 immutable requirements passed");
  await expect(page.getByTestId("outcome-summary")).toContainText("Move counters to an atomic shared store");
  await expect(page.getByText("Reality stabilised: implementation, memories, and anchors agree.")).toBeVisible();

  await expect(page).toHaveScreenshot("reality-stabilised.png", {
    fullPage: true
  });
});
