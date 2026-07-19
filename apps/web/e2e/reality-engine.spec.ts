import { expect, test, type Page } from "@playwright/test";

async function resetRun(page: Page): Promise<void> {
  const response = await page.request.post("/api/demo/reset");
  expect(response.ok()).toBe(true);
}

async function expectNext(page: Page, label: string): Promise<void> {
  await expect(page.getByTestId("next-move")).toHaveText(label, { timeout: 12_000 });
}

async function confirmDream(page: Page): Promise<void> {
  await page.getByTestId("dream-action").click();
  const gate = page.getByTestId("dream-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("MODEL-ESTIMATED IMPACT");
  await expect(gate).toContainText("MODEL-ESTIMATED CODEX BUDGET");
  await expect(gate).toContainText("EXPECTED INSIGHT");
  await gate.getByRole("button", { name: "Confirm and create Dream" }).click();
}

function missionSnapshotFixture() {
  const occurredAt = "2026-07-18T14:30:00.000Z";
  const constitution = {
    mission: "Find and repair cross-user authorization failures in VAmPI.",
    scope: "VAmPI API authorization",
    premise: "A valid token prevents one user from reading another user's private resources.",
    constraints: ["Use only the authorized local training target.", "Do not expose raw model reasoning."],
    wakeContract: ["Return evidence and artefacts."],
    parentTruths: ["Private book secrets require owner authorization."],
    timeDilation: 2,
    runtimeLaws: ["A failed proof blocks stabilisation."]
  };
  const anchor = {
    id: "proof-tests",
    realityId: "root-reality",
    ownerRealityId: "root-reality",
    name: "Authorization regression",
    description: "Immutable proof",
    testCommand: "python3 tests/test_authorization_regression.py",
    immutable: true,
    hidden: false,
    status: "pending"
  };
  const root = {
    id: "root-reality",
    parentId: null,
    depth: 0,
    kind: "waking",
    name: "VAmPI Authorization Breach",
    status: "exploring",
    premise: constitution.premise,
    constitution: { ...constitution, timeDilation: 1 },
    worldState: {
      summary: "Cross-user access is worth isolating.",
      implementationState: "Codex inspection complete",
      simulatedMinutes: 12,
      currentFocus: "Choosing a decisive counterfactual",
      status: "Uncertainty mapped"
    },
    subjects: [],
    beliefs: [{
      id: "belief-root",
      realityId: "root-reality",
      statement: constitution.premise,
      confidence: 0.54,
      origin: "initial",
      evidenceIds: [],
      createdAt: occurredAt
    }],
    evidence: [],
    proposals: [{
      id: "proposal-1",
      realityId: "root-reality",
      title: "Cross-user book secret",
      premise: "Assume an ordinary authenticated user requests a book owned by another user.",
      uncertainty: "Does token authentication enforce resource ownership?",
      rationale: "Authentication and object authorization are separate boundaries.",
      impactProbability: 0.76,
      expectedInsight: "A deterministic cross-user authorization test.",
      estimatedTokens: 18_000,
      costClass: "medium",
      status: "dreaming"
    }],
    anchors: [anchor],
    codexThreadId: "thread-root-123456",
    worktreePath: "/tmp/mission/root",
    branchName: "inception-mission/root",
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
  const subjects = [
    ["subject-1", "Ariadne", "Authorization investigator"],
    ["subject-2", "Saito", "Red team operator"],
    ["subject-3", "Eames", "Security test engineer"]
  ].map(([id, name, role]) => ({
    id,
    realityId: "dream-reality",
    name,
    role,
    mission: `${role} bounded investigation.`,
    status: "returned",
    findings: ["Returned one concise finding."]
  }));
  const dream = {
    ...root,
    id: "dream-reality",
    parentId: "root-reality",
    depth: 1,
    kind: "dream",
    name: "Cross-user book secret",
    premise: "Assume an ordinary authenticated user requests a book owned by another user.",
    constitution,
    worldState: {
      summary: "A valid token can retrieve another user's private book secret.",
      implementationState: "Codex inspection complete",
      simulatedMinutes: 24,
      currentFocus: "Evaluating counterfactual evidence",
      status: "Uncertainty mapped"
    },
    subjects,
    beliefs: [{
      id: "belief-dream",
      realityId: "dream-reality",
      statement: "Authentication must be paired with object-level owner authorization.",
      confidence: 0.91,
      origin: "observed",
      evidenceIds: ["evidence-1"],
      createdAt: occurredAt
    }],
    evidence: [{
      id: "evidence-1",
      realityId: "dream-reality",
      kind: "test",
      title: "Cross-user secret returned",
      summary: "A regression test reproduces one user retrieving another user's private book secret.",
      source: "Eames",
      artefactPath: "tests/test_authorization_regression.py",
      provenance: "model-reported",
      createdAt: occurredAt
    }],
    proposals: [],
    anchors: [{ ...anchor, realityId: "dream-reality" }],
    codexThreadId: "thread-dream-123456",
    worktreePath: "/tmp/mission/dream",
    branchName: "inception-mission/dream"
  };
  const events: Array<Record<string, unknown>> = subjects.flatMap((subject, index) => ([
    {
      id: `subject-start-${index}`,
      realityId: dream.id,
      type: "subject.started",
      summary: `Subject entered Codex thread: ${subject.name}.`,
      dreamTime: 0,
      payload: {
        missionId: "mission-1",
        metadata: {
          stage: "subject",
          status: "completed",
          subjectId: subject.id,
          subjectName: subject.name,
          subjectRole: subject.role,
          subjectThreadId: `thread-${subject.id}-123456`,
          subjectState: "started",
          collaborationTool: "spawn_agent"
        }
      },
      occurredAt
    },
    {
      id: `subject-return-${index}`,
      realityId: dream.id,
      type: "subject.completed",
      summary: `Subject completed bounded investigation: ${subject.name}.`,
      dreamTime: 24,
      payload: {
        missionId: "mission-1",
        metadata: {
          stage: "subject",
          status: "completed",
          subjectId: subject.id,
          subjectName: subject.name,
          subjectRole: subject.role,
          subjectThreadId: `thread-${subject.id}-123456`,
          subjectState: "completed",
          collaborationTool: "wait"
        }
      },
      occurredAt
    }
  ]));
  events.push({
    id: "plan-update-1",
    realityId: dream.id,
    type: "codex.progress",
    summary: "Plan updated: 2 of 5 steps complete.",
    dreamTime: 18,
    payload: {
      missionId: "mission-1",
      operationId: "operation-1",
      action: "inspect",
      metadata: {
        stage: "plan",
        status: "updated",
        completedItems: 2,
        totalItems: 5,
        planSteps: [
          { text: "Read the Reality constitution", status: "completed" },
          { text: "Trace documented ownership checks", status: "completed" },
          { text: "Write a local regression test", status: "pending" },
          { text: "Run the focused test suite", status: "pending" },
          { text: "Return evidence-backed uncertainty", status: "pending" }
        ]
      }
    },
    occurredAt
  });
  return {
    run: {
      id: "mission-1",
      definition: {
        id: "mission-1",
        name: "VAmPI Authorization Breach",
        repositoryPath: "/tmp/example",
        mission: constitution.mission,
        scope: constitution.scope,
        premise: constitution.premise,
        constraints: constitution.constraints,
        parentTruths: constitution.parentTruths,
        wakeContract: constitution.wakeContract,
        proofs: [{
          id: anchor.id,
          name: anchor.name,
          executable: "python3",
          args: ["tests/test_authorization_regression.py"]
        }],
        subjects: subjects.map(({ id, name, role, mission }) => ({ id, name, role, mission })),
        tokenBudget: 120_000,
        maxDreamDepth: 2,
        createdAt: occurredAt
      },
      status: "exploring",
      realities: [root, dream],
      events,
      activeRealityId: dream.id,
      memories: [],
      interventions: [],
      proofResults: [],
      finalDiff: "",
      createdAt: occurredAt,
      updatedAt: occurredAt
    },
    activeReality: dream,
    operation: null,
    nextAction: {
      id: "kick",
      kind: "kick",
      label: "Kick Cross-user book secret: return validated memory",
      executor: "codex"
    }
  };
}

test.beforeEach(async ({ page }) => {
  await resetRun(page);
});

test("Mission Library keeps the rehearsed password-reset Mission immutable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The library API contract needs one browser target.");
  const initialResponse = await page.request.get("/api/missions");
  expect(initialResponse.ok()).toBe(true);
  const initial = await initialResponse.json() as {
    library: Array<{
      id: string;
      href: string;
      resetHref: string;
      exportHref: string;
      canReset: boolean;
      canDelete: boolean;
    }>;
  };
  expect(initial.library.find((mission) => mission.id === "password-reset")).toMatchObject({
    href: "/missions/password-reset",
    resetHref: "/api/missions/password-reset/reset",
    exportHref: "/api/missions/password-reset?download=1",
    canReset: true,
    canDelete: false
  });

  const exportResponse = await page.request.get("/api/missions/password-reset?download=1");
  expect(exportResponse.ok()).toBe(true);
  expect(exportResponse.headers()["content-disposition"]).toContain("inception-mission-password-reset.json");
  const resetResponse = await page.request.post("/api/missions/password-reset/reset");
  expect(resetResponse.ok()).toBe(true);
  expect((await resetResponse.json() as { session?: unknown }).session).toBeTruthy();

  const deleteResponse = await page.request.delete("/api/missions");
  expect(deleteResponse.ok()).toBe(true);
  const afterDelete = await page.request.get("/api/missions");
  const current = await afterDelete.json() as typeof initial;
  expect(current.library.some((mission) => mission.id === "password-reset")).toBe(true);
});

test("an empty API failure is reported without a browser JSON exception", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Response decoding behavior needs one browser target.");
  await page.route("**/api/demo", (route) => route.fulfill({
    status: 500,
    contentType: "text/plain",
    body: ""
  }));

  await page.goto("/");

  const loading = page.locator(".loading-screen");
  await expect(loading).toContainText("The server returned an empty HTTP 500 response.");
  await expect(loading).not.toContainText("Unexpected end of JSON input");
});

test("Mission API returns concise field validation without raw Zod output", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The HTTP validation contract needs one browser target.");
  const response = await page.request.post("/api/missions", {
    data: {
      name: "Dependency Boundary",
      repositoryPath: "/tmp/example",
      mission: "",
      scope: "",
      premise: ""
    }
  });

  expect(response.status()).toBe(400);
  const body = await response.json() as {
    error: string;
    issues: Array<{ path: string; code: string }>;
  };
  expect(body.error).toContain("Mission fields");
  expect(body.error).toContain("mission");
  expect(body.error).not.toContain("too_small");
  expect(body.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: "mission" }),
    expect.objectContaining({ path: "scope" }),
    expect.objectContaining({ path: "premise" })
  ]));
});

test("timeline replay survives a retained window without the creation event", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Replay reconstruction needs one browser target.");
  const response = await page.request.get("/api/demo");
  const snapshot = await response.json();
  const root = snapshot.realities[0];
  const retainedAt = new Date(new Date(root.createdAt).getTime() + 60_000).toISOString();
  snapshot.events = [
    {
      id: "retained-inspection",
      realityId: root.id,
      type: "inspection.completed",
      summary: "Retained inspection milestone.",
      dreamTime: 12,
      payload: {},
      occurredAt: retainedAt
    },
    {
      id: "retained-uncertainty",
      realityId: root.id,
      type: "uncertainty.discovered",
      summary: "Retained uncertainty milestone.",
      dreamTime: 12,
      payload: {},
      occurredAt: new Date(new Date(retainedAt).getTime() + 1_000).toISOString()
    }
  ];
  await page.route("**/api/demo", (route) => route.fulfill({ json: snapshot }));
  await page.goto("/");

  const timeline = page.getByTestId("reality-timeline");
  await timeline.locator('input[type="range"]').fill("0");
  await expect(timeline).toContainText("REPLAYING VALIDATED EXPERIENCE");
  await expect(page.getByTestId("reality-graph").locator(".reality-node")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Uncertainty made explicit" })).toBeVisible();
  await expect(page.locator(".loading-screen")).toHaveCount(0);
});

test("initial Reality is idle, explicit, responsive, and usage-safe", async ({ page }) => {
  await page.route("**/api/admin/codex", (route) => route.fulfill({
    json: {
      processes: [],
      sdkOperations: [],
      mode: "mock",
      model: "mock-codex",
      sdkVersion: "mock"
    }
  }));
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "A waking world, one untested belief" })).toBeVisible();
  await expectNext(page, "Ask Codex to audit and improve password-reset security");
  await expect(page.getByTestId("primary-action")).toHaveText(/Run Codex audit/);
  await expect(page.getByTestId("primary-action")).not.toContainText("password-reset security");
  await expect(page.getByTestId("action-dock")).toContainText("REHEARSED CODEX RUNTIME");
  await expect(page.getByTestId("reset-run")).toHaveText(/Full reset/);
  await expect(page.getByTestId("topbar-status").locator("a, button")).toHaveCount(0);
  await expect(page.getByTestId("topbar-actions").getByRole("button", { name: "Open admin controls" })).toBeVisible();
  await expect(page.getByTestId("operation-monitor")).toHaveCount(0);
  await expect(page.getByTestId("simulated-world-time")).toContainText("0");
  await expect(page.getByTestId("reality-timeline")).toContainText("LIVE REALITY TIMELINE");

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
  const dockLayout = await page.getByTestId("action-dock").evaluate((element) => {
    const progress = element.querySelector<HTMLElement>(".dock-progress");
    const primary = element.querySelector<HTMLElement>(".primary-command");
    const context = progress?.querySelector<HTMLElement>("strong");
    return {
      viewport: window.innerWidth,
      progressWidth: progress?.getBoundingClientRect().width ?? 0,
      primaryWidth: primary?.getBoundingClientRect().width ?? 0,
      primaryHeight: primary?.getBoundingClientRect().height ?? 0,
      contextFits: context ? context.scrollWidth <= context.clientWidth : false
    };
  });
  expect(dockLayout.contextFits).toBe(true);
  expect(dockLayout.primaryHeight).toBeLessThanOrEqual(44);
  if (dockLayout.viewport > 760) {
    expect(dockLayout.progressWidth).toBeGreaterThan(dockLayout.primaryWidth * 2);
  }

  await expect(page).toHaveScreenshot("initial-idle.png", {
    fullPage: true
  });
});

test("saved password-reset runs open as read-only timelines and return to live state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Archive navigation needs one browser target.");
  const liveResponse = await page.request.get("/api/demo");
  const live = await liveResponse.json();
  const archivedAt = "2026-07-18T16:45:00.000Z";
  const archive = {
    id: "archive-password-reset",
    session: live.session,
    realities: live.realities,
    events: live.events,
    archivedAt
  };
  const summary = {
    id: archive.id,
    phase: archive.session.phase,
    startedAt: archive.session.createdAt,
    archivedAt,
    realityCount: archive.realities.length,
    eventCount: archive.events.length,
    commandCount: 0,
    failedCommandCount: 0,
    recoveredAfterFailure: false,
    failureKinds: {}
  };
  await page.route("**/api/admin/history**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("id") === archive.id) {
      return route.fulfill({ json: { run: archive, summary } });
    }
    return route.fulfill({
      json: {
        current: { ...summary, id: "current" },
        archives: [summary]
      }
    });
  });

  await page.goto("/");
  await page.getByTestId("admin-trigger").click();
  await page.getByRole("button", { name: /Open saved password-reset timeline/ }).click();

  await expect(page.getByTestId("archive-view-banner")).toContainText("Saved Reality timeline");
  await expect(page.getByTestId("phase-header")).toContainText("SAVED SCENARIO / PASSWORD RESET");
  await expect(page.getByTestId("reality-graph").locator(".reality-node")).toHaveCount(archive.realities.length);
  await expect(page.getByTestId("reality-timeline")).toBeVisible();
  await expect(page.getByTestId("action-dock")).toHaveCount(0);

  await page.getByRole("button", { name: "Return to live Reality" }).click();
  await expect(page.getByTestId("archive-view-banner")).toHaveCount(0);
  await expect(page).toHaveURL(/\/missions\/password-reset$/);
  await expect(page.getByTestId("phase-header")).toContainText("REHEARSED MISSION / PASSWORD RESET");
  await expect(page.getByTestId("action-dock")).toBeVisible();
});

test("live operation survives refresh and returns timestamped, filterable events", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The mobile project focuses on responsive visual coverage.");
  await page.goto("/");

  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("operation-monitor")).toBeVisible();
  await expect(page.getByTestId("operation-monitor")).toContainText("CODEX OPERATION");
  await expect(page.getByTestId("operation-monitor")).toContainText(/Ask Codex to audit and improve password-reset security/i);
  await expect(page.getByTestId("operation-monitor")).toContainText(/\d+ SDK tools/);
  await expect(page.getByTestId("primary-action")).toBeDisabled();
  await expect(page.getByTestId("primary-action")).toHaveText(/Codex working/);

  await page.reload();
  await expect(page.getByTestId("operation-monitor")).toBeVisible();
  await expect(page.getByTestId("operation-monitor")).toContainText("CODEX OPERATION");
  await expect(page.getByTestId("reset-run")).toBeDisabled();

  await expectNext(page, "Create Dream: Under coordinated attack");
  await expect(page.getByTestId("operation-monitor")).toHaveCount(0);
  await expect(page.getByTestId("dream-action")).toBeEnabled();
  await expect(page.getByTestId("dream-action")).toHaveText(/Create Dream: Under coordinated attack/);
  await expect(page.getByTestId("simulated-world-time")).toContainText("12");

  const timeline = page.getByTestId("reality-timeline");
  await timeline.locator('input[type="range"]').fill("0");
  await expect(timeline).toContainText("REPLAYING VALIDATED EXPERIENCE");
  await expect(page.getByTestId("next-move")).toHaveText("Return the timeline to Live to continue");
  await expect(page.getByTestId("dream-action")).toBeDisabled();
  await timeline.getByRole("button", { name: "Live" }).click();
  await expect(timeline).toContainText("LIVE REALITY TIMELINE");
  await expect(page.getByTestId("dream-action")).toBeEnabled();

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
  await confirmDream(page);
  await expectNext(page, "Enter attacker, investigator, and test engineer into Under coordinated attack");
  await expect(page.getByTestId("primary-action")).toHaveText(/Enter Subjects/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Ask Codex to investigate coordinated password-reset abuse");
  await expect(page.getByTestId("primary-action")).toHaveText(/Run Codex investigation/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Create nested Dream: Rotating IP swarm");
  await confirmDream(page);
  await expectNext(page, "Kick Rotating IP swarm: return validated memory");
  await page.getByTestId("kick-action").click();
  await expectNext(page, "Kick Under coordinated attack: return validated memory");
  await page.getByTestId("kick-action").click();
  await expectNext(page, "Synthesise returned memories into the Waking Reality implementation");
  await expect(page.getByTestId("primary-action")).toHaveText(/Synthesise memories/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Run 3 parent-owned requirements");
  await expect(page.getByTestId("primary-action")).toHaveText(/Run anchor tests/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Stabilise Waking Reality");
  await expect(page.getByTestId("primary-action")).toHaveText(/Stabilise Reality/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Reality stabilised");

  await expect(page.locator(".reality-node")).toHaveCount(3);
  await expect(page.locator('.anchor-list .anchor-passed:not([data-testid="regression-proof"])')).toHaveCount(3);
  await expect(page.getByTestId("regression-proof")).toContainText("Inherited regression suite");
  await expect(page.locator(".memory-report")).toHaveCount(2);
  await expect(page.getByTestId("canonical-memory-seal")).toHaveCount(2);
  await expect(page.getByTestId("canonical-memory-seal").first()).toContainText("REALITY TOTEM");
  await expect(page.locator(".diff-workspace")).toBeVisible();
  await expect(page.locator(".diff-workspace pre")).toHaveCount(0);
  await page.getByTestId("reveal-code").click();
  await expect(page.locator(".diff-workspace pre")).toBeVisible();
  await expect(page.getByTestId("outcome-summary")).toContainText("Password reset now survives rotating-source abuse");
  await expect(page.getByTestId("outcome-summary")).toContainText("3 of 3 immutable requirements passed");
  await expect(page.getByTestId("outcome-summary")).toContainText("Move counters to an atomic shared store");
  await expect(page.getByTestId("event-feed").getByText("Reality stabilised: implementation, memories, and anchors agree.")).toBeVisible();
  await page.getByTestId("collapse-dreams").click();
  await expect(page.locator(".reality-node")).toHaveCount(1);
  await expect(page.getByTestId("outcome-summary")).toContainText("inherited truths");
  const dockObscuresInspector = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="action-dock"]')?.getBoundingClientRect();
    const inspector = document.querySelector(".world-inspector")?.getBoundingClientRect();
    if (!dock || !inspector) return true;
    return dock.left < inspector.right
      && dock.right > inspector.left
      && dock.top < inspector.bottom
      && dock.bottom > inspector.top;
  });
  expect(dockObscuresInspector).toBe(false);

  await expect(page).toHaveScreenshot("reality-stabilised.png", {
    fullPage: true
  });
});

test("Mission Composer does not show a false real-mode warning while runtime data loads", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The loading-state regression needs one browser target.");
  await page.route("**/api/missions/targets", (route) => route.fulfill({
    json: { targets: [] }
  }));
  await page.route("**/api/missions", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.fulfill({
      json: {
        runs: [],
        runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" },
        enabled: true
      }
    });
  });

  await page.goto("/missions/new");
  await expect(page).toHaveURL(/\/missions$/);
  await expect(page.getByRole("heading", { name: "Form a waking Reality" })).toBeVisible();
  await expect(page.getByTestId("topbar-status")).toContainText("CHECKING RUNTIME");
  await expect(page.getByText("Real mode required")).toHaveCount(0);
  await expect(page.getByTestId("topbar-status")).toContainText("GPT-5.6");
  await expect(page.getByTestId("topbar-actions")).toContainText("REHEARSED MISSION");
  await expect(page.getByTestId("topbar-actions").getByRole("button", { name: "Open admin controls" })).toBeVisible();
  await expect(page.getByText("Real mode required")).toHaveCount(0);
});

test("Mission Composer exposes general nested Reality and native Subject evidence", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-18T22:08:00.000Z"));
  const fixture = missionSnapshotFixture();
  expect("memoryIntegrity" in fixture.run).toBe(false);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let missionPosts = 0;
  let targetPosts = 0;
  let missionResets = 0;
  const passwordResetMission = {
    id: "password-reset",
    kind: "rehearsed",
    name: "Password Reset Under Coordinated Attack",
    scope: "Password-reset abuse resistance and privacy",
    status: "forming",
    realityCount: 1,
    updatedAt: "2026-07-18T14:30:00.000Z",
    href: "/missions/password-reset",
    resetHref: "/api/missions/password-reset/reset",
    exportHref: "/api/missions/password-reset?download=1",
    canReset: true,
    canDelete: false
  };
  const savedMission = {
    id: fixture.run.id,
    kind: "saved",
    name: fixture.run.definition.name,
    scope: fixture.run.definition.scope,
    status: fixture.run.status,
    realityCount: fixture.run.realities.length,
    updatedAt: fixture.run.updatedAt,
    href: "/missions/mission-1",
    resetHref: "/api/missions/mission-1/reset",
    exportHref: "/api/missions/mission-1?download=1",
    canReset: true,
    canDelete: true
  };
  await page.route("**/api/admin/codex", (route) => route.fulfill({
    json: {
      processes: [],
      sdkOperations: [],
      codexMode: "real"
    }
  }));
  await page.route("**/api/admin/history**", (route) => route.fulfill({
    json: {
      current: {
        id: "current",
        phase: 0,
        archivedAt: "2026-07-18T14:30:00.000Z",
        realityCount: 1,
        eventCount: 1,
        commandCount: 0,
        failedCommandCount: 0,
        recoveredAfterFailure: false,
        failureKinds: {}
      },
      archives: []
    }
  }));
  await page.route("**/api/missions/events?**", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: "data: {\"type\":\"connected\"}\n\n"
  }));
  await page.route("**/api/missions/mission-1", (route) => route.fulfill({
    json: {
      snapshot: fixture,
      runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" }
    }
  }));
  await page.route("**/api/missions/mission-1/reset", (route) => {
    missionResets += 1;
    return route.fulfill({ json: fixture });
  });
  await page.route("**/api/missions", async (route) => {
    if (route.request().method() === "POST") {
      missionPosts += 1;
      await route.fulfill({ json: fixture });
      return;
    }
    await route.fulfill({
      json: {
        runs: [savedMission],
        library: [passwordResetMission, savedMission],
        runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6" },
        enabled: true
      }
    });
  });
  await page.route("**/api/missions/targets", async (route) => {
    const target = {
      id: "vampi",
      name: "VAmPI",
      description: "A small, deliberately vulnerable Flask API for authorized local security training.",
      sourceUrl: "https://github.com/erev0s/VAmPI",
      revision: "f16052dce83f05847133ec98f01c5193a41de7d8",
      license: "MIT",
      catalogueUrl: "https://ctf.owasp.org/",
      prepared: route.request().method() === "POST",
      repositoryPath: route.request().method() === "POST" ? "/tmp/example" : undefined
    };
    if (route.request().method() === "POST") targetPosts += 1;
    await route.fulfill({
      json: route.request().method() === "POST"
        ? { target }
        : { targets: [target] }
    });
  });

  await page.goto("/missions/new");
  await expect(page).toHaveURL(/\/missions$/);
  await expect(page.getByRole("heading", { name: "Form a waking Reality" })).toBeVisible();
  await expect(page.locator(".mission-form")).toContainText("NO CODEX USAGE ON CREATE");
  await expect(page.getByTestId("training-target")).toContainText("VAmPI");
  await expect(page.getByTestId("training-target")).toContainText("OWASP CATALOGUE");
  await expect(page.getByLabel("Reality name")).toHaveValue("VAmPI Ownership Regression");
  await expect(page.getByLabel("Mission")).toHaveValue(/maintain the local VAmPI educational fixture/i);
  await expect(page.getByLabel("Scope")).toHaveValue(/local ownership rules/i);
  await expect(page.getByLabel("Initial belief to challenge")).toHaveValue(/documented owner and administrator invariants/i);
  await expect(page.getByLabel("Parent truths / one per line")).toHaveValue(/operator-owned local educational fixture/i);
  await expect(page.getByLabel("Local Git repository")).toHaveValue("");
  await expect(page.getByLabel(/Arm one bounded chaos-engineer intervention/)).not.toBeChecked();
  await expect(page.locator(".mission-segments").last().getByRole("button", { name: "3" })).toHaveClass(/is-selected/);
  await expect(page.getByTestId("topbar-status")).toContainText("REAL CODEX / GPT-5.6");
  await expect(page.getByTestId("topbar-actions")).toContainText("REHEARSED MISSION");
  await expect(page.locator(".mission-history")).toContainText("Password Reset Under Coordinated Attack");
  await expect(page.locator(".mission-history").getByRole("link", { name: /Password Reset Under Coordinated Attack/ }))
    .toHaveAttribute("href", "/missions/password-reset");
  expect(targetPosts).toBe(0);

  await page.getByTestId("admin-trigger").click();
  const savedMissionAdmin = page.getByTestId("saved-mission-admin");
  await expect(savedMissionAdmin).toContainText("MISSION LIBRARY");
  const passwordResetRow = savedMissionAdmin.getByTestId("saved-mission-row")
    .filter({ hasText: "Password Reset Under Coordinated Attack" });
  await expect(passwordResetRow.locator(".saved-mission-open"))
    .toHaveAttribute("href", "/missions/password-reset");
  await expect(passwordResetRow.getByRole("button", { name: "Reset saved Mission Password Reset Under Coordinated Attack" })).toBeVisible();
  await expect(passwordResetRow.getByRole("link", { name: "Export saved Mission Password Reset Under Coordinated Attack" }))
    .toHaveAttribute("href", "/api/missions/password-reset?download=1");
  await expect(passwordResetRow.getByRole("button", { name: /Delete saved Mission/ })).toHaveCount(0);
  await expect(passwordResetRow.getByLabel("Password Reset Under Coordinated Attack cannot be deleted")).toBeVisible();
  await expect(savedMissionAdmin).toContainText("VAmPI Authorization Breach");
  await expect(savedMissionAdmin.getByRole("link", { name: /^VAmPI Authorization Breach/ }))
    .toHaveAttribute("href", "/missions/mission-1");
  await expect(savedMissionAdmin.getByRole("button", { name: "Reset saved Mission VAmPI Authorization Breach" })).toBeVisible();
  await expect(savedMissionAdmin.getByRole("button", { name: "Delete saved Mission VAmPI Authorization Breach" })).toBeVisible();
  await expect(savedMissionAdmin.getByRole("button", { name: "Delete all user-created Missions" })).toBeEnabled();
  await expect(page).toHaveScreenshot("mission-admin-saved.png");
  page.once("dialog", (dialog) => dialog.accept());
  await savedMissionAdmin.getByRole("button", { name: "Reset saved Mission VAmPI Authorization Breach" }).click();
  await expect.poll(() => missionResets).toBe(1);
  await page.getByRole("button", { name: "Close admin controls" }).click();
  await expect(page).toHaveScreenshot("mission-composer.png", { fullPage: true });

  await page.locator(".mission-history").getByRole("link", { name: /VAmPI Authorization Breach/ }).click();
  await expect(page).toHaveURL(/\/missions\/mission-1$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByTestId("reality-workspace")).toBeVisible();
  await expect(page.getByTestId("reality-graph").locator(".reality-node")).toHaveCount(2);
  await expect(page.getByTestId("topbar-status")).toContainText("LIVE MEMORY STREAM");
  await expect(page.getByTestId("topbar-status")).toContainText("GPT-5.6");
  await expect(page.getByTestId("phase-header")).toContainText("VAmPI Authorization Breach");
  await expect(page.getByTestId("mission-action-dock")).toBeVisible();
  await page.getByTestId("admin-trigger").click();
  await expect(page.getByTestId("admin-drawer")).toContainText("DELETE MISSION");
  await expect(page.getByTestId("admin-drawer")).toContainText("Stop all Codex CLI");
  await expect(page.getByTestId("admin-drawer")).toContainText("MISSION LIBRARY");
  await expect(page.getByTestId("admin-drawer").locator(".admin-export"))
    .toHaveAttribute("href", "/api/missions/mission-1?download=1");
  await page.getByRole("button", { name: "Close admin controls" }).click();
  await page.getByRole("link", { name: "MISSION CONTROL" }).click();
  await expect(page).toHaveURL(/\/missions$/);
  await expect(page.getByRole("heading", { name: "Form a waking Reality" })).toBeVisible();

  await page.getByRole("button", { name: "Prepare VAmPI locally" }).click();
  await expect(page.getByLabel("Local Git repository")).toHaveValue("/tmp/example");
  expect(targetPosts).toBe(1);

  const defaultMission = await page.getByLabel("Mission").inputValue();
  await page.getByLabel("Mission").fill(" ");
  await page.getByRole("button", { name: "Form waking Reality" }).click();
  await expect(page.locator(".mission-error")).toContainText("Complete the required Mission fields: Mission.");
  expect(missionPosts).toBe(0);
  await page.getByLabel("Mission").fill(defaultMission);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Form waking Reality" }).click();
  expect(missionPosts).toBe(1);

  await expect(page).toHaveURL(/\/missions\/mission-1$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByTestId("reality-workspace")).toBeVisible();
  await expect(page.getByTestId("reality-graph").locator(".reality-node")).toHaveCount(2);
  await expect(page.locator(".locus-key")).toContainText("Cross-user book secret");
  await expect(page.locator(".subject-list .subject-row")).toHaveCount(3);
  await page.getByRole("tab", { name: "runtime" }).click();
  await expect(page.locator(".runtime-list")).toContainText("Codex thread");
  await expect(page.getByTestId("event-feed")).toContainText("Subject completed bounded investigation");
  const planEvent = page.getByTestId("event-row").filter({ hasText: "Plan updated: 2 of 5 steps complete." });
  await planEvent.click();
  await expect(page.getByTestId("event-detail")).toContainText("PLAN AT THIS EVENT");
  await expect(page.getByTestId("event-plan-snapshot")).toContainText("Read the Reality constitution");
  await expect(page.getByTestId("event-plan-snapshot")).toContainText("Write a local regression test");
  await expect(page.getByTestId("event-detail")).toContainText("plan-update-1");
  await expect(page.getByTestId("event-detail")).toContainText("operation-1");
  await expect(page).toHaveScreenshot("mission-event-detail.png");
  await page.getByRole("button", { name: "Close event details" }).click();
  await expect(page.getByTestId("memory-integrity")).toContainText("Parent policy armed");
  await expect(page.getByTestId("mission-action-dock")).toContainText("Kick Cross-user book secret");
  await expect(page.getByTestId("mission-action-dock").locator(".kick-command")).toHaveText(/Kick and return memory/);
  await expect(page.getByTestId("mission-action-dock").locator(".kick-command")).not.toContainText("Cross-user book secret");
  await expect(page.getByTestId("mission-action-dock").locator(".primary-command")).toHaveText("Advance Reality");
  await expect(page.locator(".anchor-list .anchor-pending")).toContainText("Authorization regression");

  const viewportFits = await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth
  );
  expect(viewportFits).toBe(true);
  await expect(page).toHaveScreenshot("mission-workspace-unified.png", {
    fullPage: true,
    maxDiffPixelRatio: 0
  });
  expect(pageErrors).toEqual([]);
});
