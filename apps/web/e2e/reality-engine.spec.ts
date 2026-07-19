import { expect, test, type Page } from "@playwright/test";

async function resetRun(page: Page): Promise<void> {
  const response = await page.request.post("/api/demo/reset");
  expect(response.ok()).toBe(true);
}

async function expectNext(page: Page, label: string): Promise<void> {
  await expect(page.getByTestId("next-move")).toHaveText(label, { timeout: 20_000 });
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
  const sibling = {
    ...dream,
    id: "sibling-reality",
    name: "Concurrent recovery load",
    status: "kicked",
    worldState: {
      ...dream.worldState,
      summary: "Legitimate recovery traffic competes with identifier pressure.",
      currentFocus: "Memory returned to parent",
      status: "Memory returned"
    },
    subjects: [],
    evidence: [{
      ...dream.evidence[0],
      id: "evidence-sibling",
      realityId: "sibling-reality",
      title: "Legitimate recovery remains available",
      summary: "A bounded concurrent-load test preserves ordinary recovery."
    }],
    codexThreadId: "thread-sibling-123456",
    worktreePath: "/tmp/mission/sibling",
    branchName: "inception-mission/sibling"
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
    id: "model-evidence-1",
    realityId: dream.id,
    type: "codex.progress",
    summary: "gpt-5.6-sol entered the persisted Dream thread.",
    dreamTime: 18,
    payload: {
      missionId: "mission-1",
      operationId: "operation-1",
      action: "inspect",
      metadata: {
        stage: "model",
        status: "completed",
        model: "gpt-5.6-sol",
        sdkVersion: "0.144.6",
        authSource: "cli"
      }
    },
    occurredAt
  });
  events.push({
    id: "thread-evidence-1",
    realityId: dream.id,
    type: "codex.progress",
    summary: "Codex thread entered the persisted Dream worktree.",
    dreamTime: 18,
    payload: {
      missionId: "mission-1",
      operationId: "operation-1",
      action: "inspect",
      metadata: {
        stage: "thread",
        status: "started",
        threadId: "thread-dream-123456"
      }
    },
    occurredAt
  });
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
        runtimeLaws: constitution.runtimeLaws,
        safetyProfile: "authorized-local-defensive-review",
        memoryPolicy: "verified-reports-and-artefacts",
        dreamStrategy: "competing-siblings",
        maxSiblingDreams: 2,
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
      realities: [root, dream, sibling],
      events,
      eventCount: events.length + 200,
      observedTokens: 0,
      activeRealityId: dream.id,
      memories: [],
      interventions: [],
      reflections: [{
        id: "reflection-1",
        parentRealityId: root.id,
        realityIds: [dream.id, sibling.id],
        sharedInvariants: ["Owner authorization must be proven independently of authentication."],
        disagreements: [{
          statement: "The safest request budget under legitimate load remains environment-specific.",
          realityIds: [sibling.id],
          evidenceTitles: ["Legitimate recovery remains available"]
        }],
        evidenceMatrix: [
          {
            realityId: dream.id,
            realityName: dream.name,
            evidenceTitles: ["Cross-user secret returned"],
            invariants: ["Owner authorization must be proven independently of authentication."],
            remainingUncertainty: []
          },
          {
            realityId: sibling.id,
            realityName: sibling.name,
            evidenceTitles: ["Legitimate recovery remains available"],
            invariants: ["Owner authorization must be proven independently of authentication."],
            remainingUncertainty: ["Production thresholds need telemetry."]
          }
        ],
        confidence: 1,
        createdAt: occurredAt
      }],
      autopilot: {
        mode: "off",
        kind: "guided-real",
        maxActions: 30,
        maxMinutes: 60,
        pauseOnDream: true,
        pauseOnIntervention: true,
        actionsCompleted: 0
      },
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

test("Mission Library keeps the password-reset Demo Mission immutable", async ({ page }, testInfo) => {
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

test("timeline replay survives a retained window without the creation event", async ({ page }) => {
  const response = await page.request.get("/api/demo");
  const snapshot = await response.json();
  const root = snapshot.realities[0];
  const retainedAt = new Date(new Date(root.createdAt).getTime() + 60_000).toISOString();
  snapshot.events = [
    {
      id: "retained-inspection",
      realityId: root.id,
      type: "inspection.completed",
      summary: "Guided real auto mode paused: A new counterfactual premise requires explicit approval.",
      dreamTime: 12,
      payload: {},
      occurredAt: retainedAt
    },
    {
      id: "retained-model",
      realityId: root.id,
      type: "codex.progress",
      summary: "gpt-5.6-sol bound to Waking Reality.",
      dreamTime: 12,
      payload: {
        metadata: {
          stage: "model",
          status: "completed",
          model: "gpt-5.6-sol",
          sdkVersion: "0.144.6",
          authSource: "cli"
        }
      },
      occurredAt: new Date(new Date(retainedAt).getTime() + 1_000).toISOString()
    },
    {
      id: "retained-thread",
      realityId: root.id,
      type: "codex.progress",
      summary: "Codex thread entered the Waking Reality worktree.",
      dreamTime: 12,
      payload: {
        metadata: {
          stage: "thread",
          status: "started",
          threadId: "thread-waking-123456"
        }
      },
      occurredAt: new Date(new Date(retainedAt).getTime() + 2_000).toISOString()
    },
    {
      id: "retained-subject",
      realityId: root.id,
      type: "subject.started",
      summary: "Subject entered Codex thread: Ariadne.",
      dreamTime: 12,
      payload: {
        metadata: {
          stage: "subject",
          status: "completed",
          subjectId: "subject-ariadne",
          subjectName: "Ariadne",
          subjectRole: "Security investigator",
          subjectThreadId: "thread-subject-ariadne-123456",
          subjectState: "started",
          collaborationTool: "spawn_agent"
        }
      },
      occurredAt: new Date(new Date(retainedAt).getTime() + 3_000).toISOString()
    },
    {
      id: "retained-uncertainty",
      realityId: root.id,
      type: "uncertainty.discovered",
      summary: "Retained uncertainty milestone.",
      dreamTime: 12,
      payload: {},
      occurredAt: new Date(new Date(retainedAt).getTime() + 4_000).toISOString()
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
  const timelineSummary = timeline.locator("strong");
  await expect(timelineSummary).toHaveText("Guided real auto mode paused: A new counterfactual premise requires explicit approval.");
  expect(await timelineSummary.evaluate((element) =>
    element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight
  )).toBe(true);
  await timeline.getByRole("button", {
    name: "Inspect replay milestone: Guided real auto mode paused: A new counterfactual premise requires explicit approval."
  }).click();
  await expect(page.getByTestId("event-detail")).toContainText(
    "Guided real auto mode paused: A new counterfactual premise requires explicit approval."
  );
  await page.getByRole("button", { name: "Close event details" }).click();

  await timeline.locator('input[type="range"]').fill("1");
  await timeline.getByRole("button", { name: "Inspect replay milestone: gpt-5.6-sol bound to Waking Reality." }).click();
  await expect(page.getByTestId("event-execution-evidence")).toContainText("MODEL");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("gpt-5.6-sol");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("SDK");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("AUTH");
  await page.getByRole("button", { name: "Close event details" }).click();

  await timeline.locator('input[type="range"]').fill("2");
  await timeline.getByRole("button", { name: "Inspect replay milestone: Codex thread entered the Waking Reality worktree." }).click();
  await expect(page.getByTestId("event-execution-evidence")).toContainText("REALITY THREAD");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("thread-waking-123456");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("WORKTREE");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("GIT BRANCH");
  await page.getByRole("button", { name: "Close event details" }).click();

  await timeline.locator('input[type="range"]').fill("3");
  await timeline.getByRole("button", { name: "Inspect replay milestone: Subject entered Codex thread: Ariadne." }).click();
  await expect(page.getByTestId("event-execution-evidence")).toContainText("SUBJECT THREAD");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("thread-subject-ariadne-123456");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("SUBJECT STATE");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("CODEX COLLABORATION");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("spawn_agent");
  await page.getByRole("button", { name: "Close event details" }).click();

  await timeline.getByRole("button", { name: "Play adaptive timeline replay" }).click();
  await expect(timeline).toContainText("LIVE REALITY TIMELINE", { timeout: 5_000 });
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
  await expect(page.getByTestId("action-dock")).toContainText("DEMO CODEX RUNTIME");
  await expect(page.getByTestId("reset-run")).toHaveText(/Full reset/);
  await expect(page.getByTestId("topbar-status").locator("a, button")).toHaveCount(0);
  await expect(page.getByTestId("topbar-actions").getByRole("button", { name: "Open admin controls" })).toBeVisible();
  await expect(page.getByTestId("operation-monitor")).toHaveCount(0);
  await expect(page.getByTestId("topology-state")).toContainText("TOPOLOGY / 1 REALITY / 0 DREAMS");
  await expect(page.getByTestId("topology-state")).toContainText("No Dream launched");
  await expect(page.getByTestId("reality-graph").locator("..").locator(".map-footer"))
    .toContainText("DEMO STRATEGY / ONE DECISIVE NESTED CHAIN");
  await expect(page.getByTestId("simulated-world-time")).toContainText("0m completed experience × 1");
  await expect(page.getByTestId("reality-timeline")).toContainText("LIVE REALITY TIMELINE");
  await expect(page.getByTestId("reality-journey")).toContainText("Waking requirements");
  await expect(page.getByTestId("demo-autopilot")).toContainText("NO CODEX USAGE");
  await expect(page.getByTestId("demo-autopilot").getByRole("button", { name: "Start recording auto" })).toBeVisible();

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

test("real Demo Mission exposes explicit bounded guided auto controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The guided-auto interaction needs one browser target.");
  const response = await page.request.get("/api/demo");
  expect(response.ok()).toBe(true);
  const snapshot = await response.json();
  snapshot.runtime = {
    ...snapshot.runtime,
    codexMode: "real",
    model: "gpt-5.6-sol",
    authSource: "cli"
  };
  snapshot.session.autopilot = {
    mode: "off",
    kind: "guided-real",
    maxActions: 20,
    maxMinutes: 180,
    paceMilliseconds: 1_000,
    pauseOnDream: true,
    actionsCompleted: 0
  };
  let command: Record<string, unknown> | undefined;
  await page.route("**/api/demo", (route) => route.fulfill({ json: snapshot }));
  await page.route("**/api/demo/autopilot", async (route) => {
    command = route.request().postDataJSON() as Record<string, unknown>;
    snapshot.session.autopilot = {
      ...snapshot.session.autopilot,
      mode: "running",
      startedAt: new Date().toISOString()
    };
    await route.fulfill({ json: snapshot });
  });

  await page.goto("/");
  const auto = page.getByTestId("demo-autopilot");
  await expect(auto).toContainText("GUIDED REAL AUTO");
  await expect(auto).toContainText("PARENT GATES ARMED");
  await expect(auto).toContainText("Codex will not start until guided auto is explicitly started");
  await auto.getByRole("button", { name: "Start guided auto" }).click();
  expect(command).toEqual({ command: "start" });
  await expect(auto).toContainText("Advancing one bounded, validated Reality action at a time");
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
  await expect(page.getByTestId("phase-header")).toContainText("DEMO MISSION / PASSWORD RESET");
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
  await expect(page.getByTestId("topology-state")).toContainText("CODEX ACTIVE / 1 REALITY / 0 DREAMS");
  await expect(page.getByTestId("topology-state")).toContainText("no child Reality has been created");
  await expect(page.getByTestId("reality-graph").locator(".reality-node.is-operating")).toHaveCount(1);
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
  await expect(page.getByTestId("simulated-world-time")).toContainText("12m completed experience × 1");

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

test("the complete mocked narrative remains visually coherent", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("primary-action").click();
  await expectNext(page, "Create Dream: Under coordinated attack");
  await expect(page.getByTestId("topology-state")).toContainText("DREAM PROPOSED / NOT LAUNCHED");
  await expect(page.getByTestId("topology-state")).toContainText("awaiting confirmation");
  await expect(page.getByTestId("reality-graph").locator(".reality-node")).toHaveCount(1);
  await confirmDream(page);
  await expect(page.getByTestId("topology-state")).toContainText("TOPOLOGY / 2 REALITIES / 1 DREAM");
  await expectNext(page, "Enter attacker, investigator, and test engineer into Under coordinated attack");
  await expect(page.getByTestId("primary-action")).toHaveText(/Enter Subjects/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Ask Codex to investigate coordinated password-reset abuse");
  await expect(page.getByTestId("primary-action")).toHaveText(/Run Codex investigation/);
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("graph-subject")).toHaveCount(3);
  await expectNext(page, "Create nested Dream: Rotating IP swarm");
  await confirmDream(page);
  await expectNext(page, "Kick Rotating IP swarm: return validated memory");
  await page.getByTestId("kick-action").click();
  await expect(page.getByTestId("wake-transition")).toContainText("Collecting lived evidence");
  await expectNext(page, "Create nested Dream: Account enumeration oracle");
  await confirmDream(page);
  await expectNext(page, "Inject Mal under a sealed reversible contract in Account enumeration oracle");
  await expect(page.getByTestId("canonical-intervention-ledger")).toContainText("CONTROLLED SUBJECT / ARMED");
  await expect(page.getByTestId("primary-action")).toHaveText("Run sealed intervention");
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("canonical-intervention-ledger")).toContainText("INJECTED SUBJECT / SEALED");
  await expectNext(page, "Kick Account enumeration oracle: return validated memory");
  await expect(page.getByTestId("graph-subject")).toHaveCount(5);
  await page.getByTestId("kick-action").click();
  await expect(page.getByTestId("wake-transition")).toContainText("Collecting lived evidence");
  await expect(page.getByTestId("canonical-intervention-ledger")).toContainText("INJECTED SUBJECT / REVEALED");
  await expect(page.getByTestId("canonical-intervention-ledger")).toContainText("1 planted change contained");
  await expect(page.getByTestId("canonical-intervention-ledger")).toContainText("0 injected files entered Reality");
  await expectNext(page, "Kick Under coordinated attack: return validated memory");
  await page.getByTestId("kick-action").click();
  await expect(page.getByTestId("wake-transition")).toBeVisible();
  await expectNext(page, "Synthesise returned memories into the Waking Reality implementation");
  await expect(page.getByTestId("primary-action")).toHaveText(/Synthesise memories/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Run 4 parent-owned requirements");
  await expect(page.getByTestId("primary-action")).toHaveText(/Run anchor tests/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Stabilise Waking Reality");
  await expect(page.getByTestId("primary-action")).toHaveText(/Stabilise Reality/);
  await page.getByTestId("primary-action").click();
  await expectNext(page, "Reality stabilised");

  await expect(page.locator(".reality-node")).toHaveCount(4);
  await expect(page.locator('.anchor-list .anchor-passed:not([data-testid="regression-proof"])')).toHaveCount(4);
  await expect(page.getByTestId("regression-proof")).toContainText("Inherited regression suite");
  await expect(page.locator(".memory-report")).toHaveCount(3);
  await expect(page.getByTestId("canonical-memory-seal")).toHaveCount(3);
  await expect(page.getByTestId("canonical-memory-seal").first()).toContainText("REALITY TOTEM");
  await expect(page.locator(".diff-workspace")).toBeVisible();
  await expect(page.locator(".diff-workspace pre")).toHaveCount(0);
  await page.getByTestId("reveal-code").click();
  await expect(page.locator(".diff-workspace pre")).toBeVisible();
  await expect(page.getByTestId("outcome-summary")).toContainText("Password reset survives coordinated abuse without exposing account state");
  await expect(page.getByTestId("outcome-summary")).toContainText("Proof / 4 of 4");
  await expect(page.getByTestId("outcome-summary")).toContainText("Before / 12 of 12 delivered");
  await expect(page.getByTestId("outcome-summary")).toContainText("After / 3 of 12 delivered");
  await expect(page.getByTestId("outcome-summary")).toContainText("Integrity / 1 rolled back");
  await expect(page.getByTestId("outcome-summary")).toContainText("0 injected files ascended");
  await expect(page.getByTestId("outcome-summary")).toContainText(/4\s*isolated Realities/);
  await expect(page.getByTestId("outcome-summary")).toContainText(/3\s*verified memories/);
  await expect(page.getByTestId("outcome-summary")).toContainText("Redis or database adapter");
  await expect(page.getByTestId("event-feed").getByText("Reality stabilised: implementation, memories, and anchors agree.")).toBeVisible();
  const finalTimeline = page.getByTestId("reality-timeline");
  await finalTimeline.locator('input[type="range"]').fill("0");
  await expect(page.getByTestId("outcome-summary")).toHaveCount(0);
  await finalTimeline.getByRole("button", { name: "Live" }).click();
  await expect(page.getByTestId("outcome-summary")).toBeVisible();
  await finalTimeline.getByRole("button", { name: "Play adaptive timeline replay" }).click();
  await expect(finalTimeline).toContainText("ADAPTIVE REPLAY / HIGH-SIGNAL PACING");
  await expect(page.getByTestId("outcome-summary")).toHaveCount(0);
  await finalTimeline.getByRole("button", { name: "Pause adaptive timeline replay" }).click();
  await expect(finalTimeline).toContainText("REPLAYING VALIDATED EXPERIENCE");
  await finalTimeline.getByRole("button", { name: "Live" }).click();
  const attackNode = page.locator(".reality-node").filter({ hasText: "Under coordinated attack" });
  await attackNode.locator(".branch-toggle").click();
  await expect(page.locator(".reality-node")).toHaveCount(2);
  await expect(attackNode.locator(".branch-toggle")).toHaveAttribute("aria-expanded", "false");
  await attackNode.locator(".branch-toggle").click();
  await expect(page.locator(".reality-node")).toHaveCount(4);
  await page.getByTestId("collapse-dreams").click();
  await expect(page.locator(".reality-node")).toHaveCount(1);
  await expect(page.getByTestId("topology-state")).toContainText("TOPOLOGY / 4 REALITIES / 3 DREAMS / 3 HIDDEN");
  await expect(page.getByTestId("topology-state")).not.toContainText("NOT LAUNCHED");
  await expect(page.getByTestId("outcome-summary")).toContainText("inherited truths");
  await page.getByTestId("collapse-dreams").click();
  await expect(page.locator(".reality-node")).toHaveCount(4);
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

  await page.evaluate(() => window.scrollTo(0, 0));
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
        runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6", authSource: "cli" },
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
  await expect(page.getByTestId("topbar-actions")).toContainText("DEMO MISSION");
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
    kind: "demo",
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
      runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6", authSource: "cli" }
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
        runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6", authSource: "cli" },
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
  const missionField = page.getByRole("textbox", { name: "Mission", exact: true });
  await expect(missionField).toHaveValue(/maintain the local VAmPI educational fixture/i);
  await expect(page.getByLabel("Scope")).toHaveValue(/local ownership rules/i);
  await expect(page.getByLabel("Initial belief to challenge")).toHaveValue(/documented owner and administrator invariants/i);
  await expect(page.getByLabel("Parent truths / one per line")).toHaveValue(/operator-owned local educational fixture/i);
  await expect(page.getByLabel("Local Git repository")).toHaveValue("");
  await expect(page.getByLabel(/Inject one bounded controlled Subject/)).toBeChecked();
  await expect(page.getByText("Inject one bounded controlled Subject at Dream depth 2")).toBeVisible();
  await expect(page.locator(".mission-segments").last().getByRole("button", { name: "3" })).toHaveClass(/is-selected/);
  await expect(page.getByTestId("topbar-status")).toContainText("REAL CODEX / GPT-5.6");
  await expect(page.getByTestId("topbar-actions")).toContainText("DEMO MISSION");
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
  await expect(page.getByTestId("reality-graph").locator(".reality-node")).toHaveCount(3);
  await expect(page.getByTestId("reality-graph").locator("..").locator(".map-footer"))
    .toContainText("BRANCHING STRATEGY / UP TO 2 SIBLING DREAMS PER REALITY");
  await expect(page.getByTestId("reality-journey")).toBeVisible();
  await expect(page.getByTestId("mission-autopilot")).toContainText("GUIDED AUTO MODE");
  await expect(page.getByTestId("reality-mirror")).toContainText("SIBLING COMPARISON");
  const siblingRows = await page.getByTestId("reality-graph").locator(".depth-node-1")
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
  expect(siblingRows).toHaveLength(2);
  expect(Math.abs(siblingRows[0]! - siblingRows[1]!)).toBeGreaterThan(80);
  await expect(page.getByTestId("topbar-status")).toContainText("LIVE MEMORY STREAM");
  await expect(page.getByTestId("topbar-status")).toContainText("GPT-5.6");
  await expect(page.getByTestId("topbar-status")).toContainText("CLI AUTH");
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

  const defaultMission = await missionField.inputValue();
  await missionField.fill(" ");
  await page.getByRole("button", { name: "Form waking Reality" }).click();
  await expect(page.locator(".mission-error")).toContainText("Complete the required Mission fields: Mission.");
  expect(missionPosts).toBe(0);
  await missionField.fill(defaultMission);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Form waking Reality" }).click();
  expect(missionPosts).toBe(1);

  await expect(page).toHaveURL(/\/missions\/mission-1$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByTestId("reality-workspace")).toBeVisible();
  await expect(page.getByTestId("reality-graph").locator(".reality-node")).toHaveCount(3);
  await expect(page.locator(".locus-key")).toContainText("Cross-user book secret");
  await expect(page.locator(".subject-list .subject-row")).toHaveCount(3);
  await page.getByRole("tab", { name: "runtime" }).click();
  await expect(page.locator(".runtime-list")).toContainText("Codex thread");
  await expect(page.getByTestId("event-feed")).toContainText("Subject completed bounded investigation");
  await expect(page.getByTestId("event-feed").getByRole("button", { name: "Load 200 earlier events" })).toBeVisible();
  const planEvent = page.getByTestId("event-row").filter({ hasText: "Plan updated: 2 of 5 steps complete." });
  await planEvent.click();
  await expect(page.getByTestId("event-detail")).toContainText("PLAN AT THIS EVENT");
  await expect(page.getByTestId("event-plan-snapshot")).toContainText("Read the Reality constitution");
  await expect(page.getByTestId("event-plan-snapshot")).toContainText("Write a local regression test");
  await expect(page.getByTestId("event-detail")).toContainText("plan-update-1");
  await expect(page.getByTestId("event-detail")).toContainText("operation-1");
  await expect(page).toHaveScreenshot("mission-event-detail.png");
  await page.getByRole("button", { name: "Close event details" }).click();
  await page.getByTestId("event-row").filter({ hasText: "gpt-5.6-sol entered the persisted Dream thread." }).click();
  await expect(page.getByTestId("event-execution-evidence")).toContainText("MODEL");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("gpt-5.6-sol");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("SDK");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("AUTH");
  await page.getByRole("button", { name: "Close event details" }).click();
  await page.getByTestId("event-row").filter({ hasText: "Codex thread entered the persisted Dream worktree." }).click();
  await expect(page.getByTestId("event-execution-evidence")).toContainText("REALITY THREAD");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("thread-dream-123456");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("WORKTREE");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("/tmp/mission/dream");
  await page.getByRole("button", { name: "Close event details" }).click();
  await page.getByTestId("event-row").filter({ hasText: "Subject entered Codex thread: Ariadne." }).click();
  await expect(page.getByTestId("event-execution-evidence")).toContainText("SUBJECT THREAD");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("thread-subject-1-123456");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("SUBJECT STATE");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("started");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("CODEX COLLABORATION");
  await expect(page.getByTestId("event-execution-evidence")).toContainText("spawn_agent");
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("mission-workspace-unified.png", {
    fullPage: true,
    maxDiffPixelRatio: 0
  });
  expect(pageErrors).toEqual([]);
});

test("General Missions use the same explicit Dream proposal gate as the Demo Mission", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The shared gate contract needs one browser target.");
  const fixture = missionSnapshotFixture();
  const root = fixture.run.realities[0]!;
  root.proposals[0]!.status = "open";
  fixture.run.activeRealityId = root.id;
  (fixture as { activeReality: unknown }).activeReality = root;
  fixture.nextAction = {
    id: "create_dream",
    kind: "dream",
    label: "Create Dream from the highest-value uncertainty",
    executor: "orchestrator"
  };
  await page.route("**/api/missions/events?**", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: "data: {\"type\":\"connected\"}\n\n"
  }));
  await page.route("**/api/missions/mission-1", (route) => route.fulfill({
    json: {
      snapshot: fixture,
      runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6", authSource: "cli" }
    }
  }));
  await page.route("**/api/missions/targets", (route) => route.fulfill({
    json: { targets: [] }
  }));
  await page.route("**/api/missions", (route) => route.fulfill({
    json: {
      runs: [],
      library: [],
      runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6", authSource: "cli" },
      enabled: true
    }
  }));

  await page.goto("/missions/mission-1");
  await page.getByTestId("mission-action-dock").locator(".dream-command").click();
  const gate = page.getByTestId("dream-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("COUNTERFACTUAL PREMISE");
  await expect(gate).toContainText("MODEL-ESTIMATED CODEX BUDGET");
  await gate.getByRole("button", { name: "Keep waking Reality" }).click();
  await expect(gate).toHaveCount(0);
});

test("a controlled Subject is visibly contained before its memory ascends", async ({ page }) => {
  const fixture = missionSnapshotFixture();
  const dream = fixture.run.realities.find((reality) => reality.id === "dream-reality")!;
  const root = fixture.run.realities.find((reality) => reality.id === "root-reality")!;
  const containedAt = "2026-07-18T15:31:00.000Z";
  const report = {
    realityId: dream.id,
    initialBeliefs: [{ statement: "Authentication enforces ownership.", confidence: 0.54 }],
    experiences: ["A controlled permission fault exposed the missing owner check."],
    changedBeliefs: [],
    invariants: ["Owner authorization must be proven independently of authentication."],
    artefacts: [{
      name: "Independent ownership regression",
      path: "tests/test_authorization_regression.py",
      kind: "test",
      summary: "A local regression test proves the owner boundary."
    }],
    remainingUncertainty: [],
    recommendation: "Admit the owner invariant and its independent regression test.",
    generatedAt: containedAt
  };
  const intervention = {
    id: "intervention-ledger-1",
    contractId: "intervention-contract-1",
    realityId: dream.id,
    status: "revealed",
    armedAt: "2026-07-18T15:20:00.000Z",
    startedAt: "2026-07-18T15:21:00.000Z",
    sealedAt: "2026-07-18T15:24:00.000Z",
    revealedAt: "2026-07-18T15:30:00.000Z",
    containedAt,
    changedFileCount: 1,
    patchLineCount: 4,
    report: {
      contractId: "intervention-contract-1",
      realityId: dream.id,
      subjectId: "controlled-subject-1",
      faultClass: "permission",
      summary: "A reversible owner-check regression was independently identified.",
      changedFiles: ["api_views/books.py"],
      expectedSymptoms: ["A second user can retrieve the first user's private book."],
      generatedAt: containedAt
    },
    diagnosis: {
      faultClass: "permission",
      suspectedChangedFiles: ["api_views/books.py"],
      evidenceTitles: ["Cross-user secret returned"],
      confidence: 0.96,
      remainingUncertainty: []
    },
    assessment: {
      outcome: "detected",
      faultClassMatched: true,
      identifiedFiles: ["api_views/books.py"],
      missedFiles: [],
      evidenceTitles: ["Cross-user secret returned"],
      assessedAt: containedAt
    },
    excludedArtefactPaths: ["api_views/books.py"]
  };
  const checks = [
    "schema",
    "identity",
    "report-digest",
    "source-state",
    "anchor-fingerprint",
    "evidence-lineage",
    "artefact-resolution",
    "descendant-lineage",
    "intervention-diagnosis"
  ].map((name) => ({
    name,
    status: "passed",
    summary: `${name} passed.`
  }));
  const seal = {
    id: "integrity-seal-1",
    realityId: dream.id,
    parentRealityId: root.id,
    reportDigest: "a".repeat(64),
    sourceStateDigest: "b".repeat(64),
    sourceCommit: "a".repeat(40),
    anchorFingerprint: "c".repeat(64),
    parentAnchorFingerprint: "c".repeat(64),
    descendantSealIds: [],
    descendantRealityIds: [],
    checks,
    verdict: "verified",
    policyVersion: "memory-integrity/v2",
    sealedAt: containedAt
  };
  Object.assign(fixture.run.definition, {
    intervention: {
      id: "intervention-contract-1",
      enabled: true,
      subject: {
        id: "controlled-subject-1",
        name: "Mal",
        role: "Controlled resilience engineer",
        mission: "Introduce one bounded reversible owner-check fault."
      },
      hypothesis: "Independent Subjects can detect an owner-check regression.",
      faultClasses: ["permission"],
      allowedPaths: ["api_views/**"],
      protectedPaths: ["tests/**"],
      maxChangedFiles: 1,
      maxPatchLines: 10,
      tokenBudget: 16_000,
      maxMinutes: 12,
      targetDepth: 1,
      revealPolicy: "after-diagnosis",
      requireRollbackCommit: true
    }
  });
  Object.assign(fixture.run, {
    memories: [report],
    interventions: [intervention],
    memoryIntegrity: [seal]
  });
  fixture.run.events.push({
    id: "intervention-contained-1",
    realityId: dream.id,
    type: "intervention.contained",
    summary: "Controlled fault contained: 1 injected path restored before memory could ascend.",
    dreamTime: 30,
    payload: {
      missionId: fixture.run.id,
      injectedPathCount: 1,
      excludedArtefactPaths: ["api_views/books.py"],
      retainedInvestigatorArtefactCount: 1
    },
    occurredAt: containedAt
  });
  fixture.run.eventCount += 1;

  await page.route("**/api/missions/events?**", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: "data: {\"type\":\"connected\"}\n\n"
  }));
  await page.route("**/api/missions/mission-1", (route) => route.fulfill({
    json: {
      snapshot: fixture,
      runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6", authSource: "cli" }
    }
  }));
  await page.route("**/api/missions/targets", (route) => route.fulfill({
    json: { targets: [] }
  }));
  await page.route("**/api/missions", (route) => route.fulfill({
    json: {
      runs: [],
      library: [],
      runtime: { mode: "real", model: "gpt-5.6", sdkVersion: "0.144.6", authSource: "cli" },
      enabled: true
    }
  }));

  await page.goto("/missions/mission-1");
  await expect(page.getByTestId("intervention-ledger")).toContainText("INJECTED SUBJECT / CONTAINED");
  await expect(page.getByTestId("intervention-ledger")).toContainText("DETECTED");
  await expect(page.getByTestId("intervention-ledger")).toContainText("baseline was restored");
  await expect(page.getByTestId("intervention-ledger")).toContainText("1 injected artefact path was excluded");
  await expect(page.getByTestId("memory-integrity")).toContainText("Memory verified");
  await expect(page.getByTestId("memory-ascent")).toContainText("Totem admitted memory");
  await expect(page.getByTestId("memory-ascent")).toContainText("mutation contained");
  await expect(page.getByTestId("event-feed")).toContainText("Controlled fault contained");
  await expect(page).toHaveScreenshot("mission-intervention-contained.png", {
    fullPage: true
  });
});
