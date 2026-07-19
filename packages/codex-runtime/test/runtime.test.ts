import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RealityEntity } from "@inception/domain";
import {
  buildSubjectOrchestrationPrompt,
  codexThreadOptions,
  configuredCodexModel,
  CodexSubjectRegistryTrace,
  CodexRuntimeEventSchema,
  MockCodexRuntime,
  normaliseCodexExecutionError,
  prepareCodexExecutionEnvironment,
  SubjectCollaborationTrace,
  toSafeCodexRuntimeEvent,
  WakeReportParser,
  WakeReportValidationError
} from "../src";

const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

const constitution = {
  mission: "Test password reset",
  premise: "Rotating IPs may bypass limits",
  constraints: ["No raw reasoning"],
  wakeContract: ["Return JSON"],
  parentTruths: []
};

describe("Codex runtime", () => {
  it("isolates personal Codex configuration while reusing CLI authentication", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "inception-codex-home-"));
    const sourceHome = path.join(root, "user-codex");
    const runtimeHome = path.join(root, "runtime-codex");
    fs.mkdirSync(sourceHome);
    fs.mkdirSync(path.join(sourceHome, "sessions"));
    fs.writeFileSync(
      path.join(sourceHome, "auth.json"),
      '{"auth_mode":"chatgpt","tokens":{"access_token":"test-access-token"}}'
    );
    fs.writeFileSync(path.join(sourceHome, "config.toml"), '[plugins."linear"]\nenabled=true\n');
    fs.writeFileSync(path.join(sourceHome, "models_cache.json"), '{"models":["gpt-5.6-sol"]}\n');
    fs.writeFileSync(path.join(sourceHome, "sessions", "existing-thread.jsonl"), "{}\n");

    try {
      const prepared = prepareCodexExecutionEnvironment({
        env: {
          CODEX_HOME: sourceHome,
          OPENAI_API_KEY: "ambient-parent-key",
          NODE_ENV: "development"
        },
        runtimeCodexHome: runtimeHome
      });

      expect(prepared).toMatchObject({
        codexHome: runtimeHome,
        configuration: "isolated",
        authMode: "auto",
        authSource: "cli",
        cliAuthLinked: true,
        sessionStateLinked: true,
        modelMetadataLinked: true
      });
      expect(prepared.env.CODEX_HOME).toBe(runtimeHome);
      expect(prepared.env.CODEX_SQLITE_HOME).toBe(sourceHome);
      expect(prepared.env.OPENAI_API_KEY).toBeUndefined();
      expect(prepared.env.NODE_ENV).toBeUndefined();
      expect(fs.readFileSync(path.join(runtimeHome, "auth.json"), "utf8")).toContain('"auth_mode":"chatgpt"');
      expect(fs.readFileSync(
        path.join(runtimeHome, "sessions", "existing-thread.jsonl"),
        "utf8"
      )).toBe("{}\n");
      expect(fs.readFileSync(path.join(runtimeHome, "models_cache.json"), "utf8")).toContain("gpt-5.6-sol");
      expect(fs.existsSync(path.join(runtimeHome, "config.toml"))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows explicit user-config inheritance for missions that require personal MCPs", () => {
    const sourceHome = path.join(os.tmpdir(), "inception-user-codex");
    const prepared = prepareCodexExecutionEnvironment({
      env: {
        CODEX_HOME: sourceHome,
        INCEPTION_CODEX_INHERIT_USER_CONFIG: "true"
      }
    });

    expect(prepared).toMatchObject({
      codexHome: sourceHome,
      configuration: "inherited",
      authMode: "auto",
      authSource: "none",
      cliAuthLinked: false,
      sessionStateLinked: false,
      modelMetadataLinked: false
    });
    expect(prepared.env.CODEX_HOME).toBe(sourceHome);
  });

  it("allows an explicit API-key override when CLI authentication also exists", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "inception-api-override-"));
    const sourceHome = path.join(root, "user-codex");
    const runtimeHome = path.join(root, "runtime-codex");
    fs.mkdirSync(sourceHome);
    fs.writeFileSync(
      path.join(sourceHome, "auth.json"),
      '{"auth_mode":"chatgpt","tokens":{"access_token":"test-access-token"}}'
    );

    try {
      const prepared = prepareCodexExecutionEnvironment({
        env: {
          CODEX_HOME: sourceHome,
          OPENAI_API_KEY: "explicit-api-key",
          INCEPTION_CODEX_AUTH_MODE: "api"
        },
        runtimeCodexHome: runtimeHome
      });

      expect(prepared.authMode).toBe("api");
      expect(prepared.authSource).toBe("api-key");
      expect(prepared.cliAuthLinked).toBe(false);
      expect(prepared.env.OPENAI_API_KEY).toBe("explicit-api-key");
      expect(fs.existsSync(path.join(runtimeHome, "auth.json"))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("repairs isolated-home links when the source Codex home changes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "inception-codex-relink-"));
    const firstSource = path.join(root, "first");
    const secondSource = path.join(root, "second");
    const runtimeHome = path.join(root, "runtime");
    for (const [source, marker] of [[firstSource, "first"], [secondSource, "second"]] as const) {
      fs.mkdirSync(path.join(source, "sessions"), { recursive: true });
      fs.writeFileSync(path.join(source, "auth.json"), JSON.stringify({
        marker,
        auth_mode: "chatgpt",
        tokens: { access_token: `${marker}-access-token` }
      }));
      fs.writeFileSync(path.join(source, "models_cache.json"), JSON.stringify({ marker }));
      fs.writeFileSync(path.join(source, "sessions", `${marker}.jsonl`), "{}\n");
    }

    try {
      prepareCodexExecutionEnvironment({
        sourceCodexHome: firstSource,
        runtimeCodexHome: runtimeHome,
        env: {}
      });
      prepareCodexExecutionEnvironment({
        sourceCodexHome: secondSource,
        runtimeCodexHome: runtimeHome,
        env: {}
      });

      expect(fs.readFileSync(path.join(runtimeHome, "auth.json"), "utf8")).toContain("second");
      expect(fs.readFileSync(path.join(runtimeHome, "models_cache.json"), "utf8")).toContain("second");
      expect(fs.existsSync(path.join(runtimeHome, "sessions", "second.jsonl"))).toBe(true);
      expect(fs.existsSync(path.join(runtimeHome, "sessions", "first.jsonl"))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps API-key-only state in the isolated home when no user Codex home exists", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "inception-api-key-home-"));
    const missingSourceHome = path.join(root, "missing-user-codex");
    const runtimeHome = path.join(root, "runtime-codex");

    try {
      const prepared = prepareCodexExecutionEnvironment({
        env: {
          CODEX_API_KEY: "test-key"
        },
        sourceCodexHome: missingSourceHome,
        runtimeCodexHome: runtimeHome
      });

      expect(prepared.env.CODEX_HOME).toBe(runtimeHome);
      expect(prepared.env.CODEX_SQLITE_HOME).toBe(runtimeHome);
      expect(prepared.authSource).toBe("api-key");
      expect(prepared.cliAuthLinked).toBe(false);
      expect(prepared.sessionStateLinked).toBe(false);
      expect(prepared.modelMetadataLinked).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("turns MCP OAuth startup failures into an actionable Reality error", () => {
    const error = normaliseCodexExecutionError(new Error(
      'rmcp worker quit with AuthRequired: error="invalid_token"'
    ));
    expect(error.message).toContain("MCP server rejected its OAuth credential");
    expect(error.message).toContain("INCEPTION_CODEX_INHERIT_USER_CONFIG");
    expect(error.message).not.toContain("rmcp worker");
  });

  it("preserves an actionable policy refusal instead of a generic Codex exit", () => {
    const error = normaliseCodexExecutionError(
      new Error("Codex Exec exited with code 1"),
      "This content was flagged for possible cybersecurity risk."
    );
    expect(error.message).toContain("cybersecurity safety gate");
    expect(error.message).toContain("authorized defensive source-review");
    expect(error.message).not.toContain("exited with code 1");
  });

  it("identifies API-key quota failure without exposing Codex stdin noise", () => {
    const error = normaliseCodexExecutionError(
      new Error("Codex Exec exited with code 1: Reading prompt from stdin..."),
      "Quota exceeded. Check your plan and billing details.",
      "api-key"
    );
    expect(error.message).toContain("OpenAI API-key quota rejected this turn");
    expect(error.message).toContain("INCEPTION_CODEX_AUTH_MODE=cli");
    expect(error.message).not.toContain("Reading prompt from stdin");
  });

  it("uses the safe runtime detail when the SDK wrapper only reports its exit", () => {
    const error = normaliseCodexExecutionError(
      new Error("Codex Exec exited with code 1: Reading prompt from stdin..."),
      "The selected model is unavailable for this account.",
      "cli"
    );
    expect(error.message).toBe(
      "Codex could not complete this turn: The selected model is unavailable for this account."
    );
  });

  it("replaces a wrapper-only Codex Exec failure with an actionable boundary message", () => {
    const error = normaliseCodexExecutionError(
      new Error("Codex Exec exited with code 1: Reading prompt from stdin..."),
      undefined,
      "cli"
    );

    expect(error.message).toContain("Codex CLI exited before returning a model diagnostic");
    expect(error.message).toContain("No validated memory or code entered this Reality");
    expect(error.message).not.toContain("Codex Exec exited");
    expect(error.message).not.toContain("Reading prompt from stdin");
  });

  it("keeps one deterministic thread per mocked Reality", async () => {
    const reality = RealityEntity.create({ depth: 0, kind: "waking", name: "Waking", premise: constitution.premise, constitution }).snapshot();
    const runtime = new MockCodexRuntime();
    const first = await runtime.inspect(reality);
    const second = await runtime.inspect({ ...reality, codexThreadId: first.threadId });
    expect(second.threadId).toBe(first.threadId);
    expect(first.events.every((event) => event.metadata?.stage)).toBe(true);
    expect(first.events.some((event) => event.summary.includes("bounded operation"))).toBe(false);
    expect(first.report.realityId).toBe(reality.id);
    expect(first.report.evidence[0]?.title).toBe("IP-only throttle");
    expect((await runtime.synthesise(reality, [])).applied).toBe(false);
  });

  it("rejects malformed wake reports", () => {
    const parser = new WakeReportParser();
    try {
      parser.parse('{"realityId":"x"}');
      throw new Error("Expected validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(WakeReportValidationError);
      expect((error as WakeReportValidationError).issues[0]).toMatchObject({
        path: "initialBeliefs",
        code: "invalid_type"
      });
    }
  });

  it("accepts nullable optional fields produced by the OpenAI output schema", () => {
    const report = new WakeReportParser().parse(JSON.stringify({
      realityId: "dream-1",
      initialBeliefs: [],
      experiences: [],
      changedBeliefs: [],
      invariants: [],
      artefacts: [{
        name: "attack.spec.ts",
        path: "tests/attack.spec.ts",
        kind: "test",
        summary: "Fails before fix",
        content: null
      }],
      remainingUncertainty: [],
      recommendation: "Retain the test",
      generatedAt: new Date().toISOString()
    }));
    expect(report.artefacts[0]?.content).toBeUndefined();
  });

  it("rejects unvalidated fields from safe runtime events", () => {
    expect(() => CodexRuntimeEventSchema.parse({
      type: "tool",
      summary: "Command returned with exit 0.",
      metadata: {
        stage: "command",
        status: "completed",
        command: "npm test",
        exitCode: 0,
        rawOutput: "must not persist"
      }
    })).toThrow();
  });

  it("classifies command failures without retaining raw output or secrets", () => {
    const event = toSafeCodexRuntimeEvent({
      type: "item.completed",
      item: {
        type: "command_execution",
        command: "OPENAI_API_KEY=sk-example-secret npm test",
        aggregated_output: "3 tests | 2 failed\nprivate raw test output",
        exit_code: 1,
        status: "failed"
      }
    }, "Waking Reality", "password-reset security");

    expect(event).toMatchObject({
      type: "tool",
      summary: "Test evidence returned with exit 1.",
      metadata: {
        status: "failed",
        failureKind: "test",
        diagnostic: "The test suite ran and returned 2 failing assertions as evidence."
      }
    });
    expect(JSON.stringify(event)).toContain("[REDACTED]");
    expect(JSON.stringify(event)).not.toContain("private raw test output");
    expect(JSON.stringify(event)).not.toContain("sk-example-secret");
  });

  it("retains a concise SDK failure diagnostic", () => {
    expect(toSafeCodexRuntimeEvent({
      type: "turn.failed",
      error: { message: "Connection failed for sk-example-secret" }
    }, "Waking Reality", "password-reset security")).toMatchObject({
      type: "decision",
      metadata: {
        status: "failed",
        detail: "Connection failed for [REDACTED]"
      }
    });
  });

  it("retains a bounded, redacted plan snapshot without raw reasoning", () => {
    const event = toSafeCodexRuntimeEvent({
      type: "item.updated",
      item: {
        type: "todo_list",
        items: [
          { text: "Inspect authorization decorators", completed: true },
          { text: "Run tests with OPENAI_API_KEY=sk-example-secret", completed: true },
          { text: "Return the smallest evidence-backed patch", completed: false }
        ]
      }
    }, "Authorization Dream", "authorization review");

    expect(event).toMatchObject({
      type: "progress",
      summary: "Plan updated: 2 of 3 steps complete.",
      metadata: {
        stage: "plan",
        status: "updated",
        completedItems: 2,
        totalItems: 3,
        planSteps: [
          { text: "Inspect authorization decorators", status: "completed" },
          { text: "Run tests with OPENAI_API_KEY=[REDACTED]", status: "completed" },
          { text: "Return the smallest evidence-backed patch", status: "pending" }
        ]
      }
    });
    expect(JSON.stringify(event)).not.toContain("sk-example-secret");
  });

  it("requires active Dream Subjects to run as direct Codex subagents", () => {
    const reality = RealityEntity.create({
      depth: 1,
      kind: "dream",
      name: "Attack Dream",
      premise: constitution.premise,
      constitution
    });
    reality.addSubject({
      id: "subject-attacker",
      name: "Ariadne",
      role: "Attacker",
      mission: "Probe rotating-source abuse.",
      status: "entered",
      findings: []
    });

    const prompt = buildSubjectOrchestrationPrompt(reality.snapshot());
    expect(prompt).toContain("spawn one direct subagent for each Subject");
    expect(prompt).toContain("Ariadne (Attacker): Probe rotating-source abuse.");
    expect(prompt).toContain("wait for every Subject to return");
    expect(prompt).toContain("close a Subject only after its native terminal status is completed");
    expect(prompt).toContain("must not spawn further subagents");
  });

  it("binds opportunistic Subjects to completed native child threads", () => {
    const trace = new SubjectCollaborationTrace([]);
    const prompt = buildSubjectOrchestrationPrompt(RealityEntity.create({
      depth: 0,
      kind: "waking",
      name: "Waking",
      premise: constitution.premise,
      constitution
    }).snapshot());
    expect(prompt).toContain("native identity returned by the current turn");
    expect(prompt).toContain("Do not reuse a Subject");

    const enteredLaplace = trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["019f775d-8629-7db0-8fca-de9bcac91c34"],
        prompt: "Audit one bounded authorization boundary.",
        status: "completed"
      }
    });
    const enteredHume = trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["019f775d-8629-7db0-8fca-de9bcac91c35"],
        prompt: "Test one independent authorization boundary.",
        status: "completed"
      }
    });
    const returned = trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: [
          "019f775d-8629-7db0-8fca-de9bcac91c34",
          "019f775d-8629-7db0-8fca-de9bcac91c35"
        ],
        agents_states: {
          "019f775d-8629-7db0-8fca-de9bcac91c34": {
            status: "completed",
            message: "raw Subject response"
          },
          "019f775d-8629-7db0-8fca-de9bcac91c35": {
            status: "completed",
            message: "another raw Subject response"
          }
        },
        status: "completed"
      }
    });
    const observed = trace.bindReports([
      {
        subjectId: "019f775d-8629-7db0-8fca-de9bcac91c34",
        name: "Laplace",
        role: "Explorer",
        findings: ["The owner predicate is missing."],
        artefactPaths: ["api_views/books.py"]
      },
      {
        subjectId: "019f775d-8629-7db0-8fca-de9bcac91c35",
        name: "Hume",
        role: "Test engineer",
        findings: ["The cross-owner request is not covered."],
        artefactPaths: ["tests/test_authorization.py"]
      }
    ]);

    expect(enteredLaplace[0]).toMatchObject({
      type: "subject",
      metadata: {
        subjectId: "019f775d-8629-7db0-8fca-de9bcac91c34",
        subjectState: "started"
      }
    });
    expect(enteredHume[0]).toMatchObject({
      type: "subject",
      metadata: {
        subjectId: "019f775d-8629-7db0-8fca-de9bcac91c35",
        subjectState: "started"
      }
    });
    expect(returned[0]).toMatchObject({
      type: "subject",
      metadata: {
        subjectId: "019f775d-8629-7db0-8fca-de9bcac91c34",
        subjectState: "completed"
      }
    });
    expect(returned[1]).toMatchObject({
      type: "subject",
      metadata: {
        subjectId: "019f775d-8629-7db0-8fca-de9bcac91c35",
        subjectState: "completed"
      }
    });
    expect(observed).toEqual([
      {
        id: "019f775d-8629-7db0-8fca-de9bcac91c34",
        name: "Laplace",
        role: "Explorer",
        mission: "Bounded independent investigation selected by Codex.",
        threadId: "019f775d-8629-7db0-8fca-de9bcac91c34"
      },
      {
        id: "019f775d-8629-7db0-8fca-de9bcac91c35",
        name: "Hume",
        role: "Test engineer",
        mission: "Bounded independent investigation selected by Codex.",
        threadId: "019f775d-8629-7db0-8fca-de9bcac91c35"
      }
    ]);
    expect(JSON.stringify([...enteredLaplace, ...enteredHume, ...returned])).not.toContain("raw Subject response");
  });

  it("replays Sol task-path Subjects from the native thread registry", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "inception-sol-subjects-"));
    const sessions = path.join(root, "sessions");
    const worktree = path.join(root, "worktree");
    fs.mkdirSync(sessions);
    fs.mkdirSync(worktree);
    const fixture = JSON.parse(fs.readFileSync(
      new URL("./fixtures/sol-subject-registry.json", import.meta.url),
      "utf8"
    )) as {
      parentThreadId: string;
      children: Array<{
        threadId: string;
        agentPath: string;
        agentNickname: string;
        reportName: string;
        reportRole: string;
      }>;
    };
    const database = new DatabaseSync(path.join(root, "state_5.sqlite"));
    database.exec(`
      CREATE TABLE thread_spawn_edges (
        parent_thread_id TEXT NOT NULL,
        child_thread_id TEXT NOT NULL PRIMARY KEY,
        status TEXT NOT NULL
      );
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        agent_path TEXT,
        agent_nickname TEXT,
        agent_role TEXT,
        first_user_message TEXT NOT NULL,
        rollout_path TEXT NOT NULL,
        cwd TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
    `);
    const createdAtMs = Date.now();
    const insertEdge = database.prepare(
      "INSERT INTO thread_spawn_edges (parent_thread_id, child_thread_id, status) VALUES (?, ?, ?)"
    );
    const insertThread = database.prepare(`
      INSERT INTO threads (
        id, agent_path, agent_nickname, agent_role, first_user_message,
        rollout_path, cwd, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const rolloutPaths = new Map<string, string>();
    try {
      for (const child of fixture.children) {
        const rolloutPath = path.join(sessions, `${child.threadId}.jsonl`);
        rolloutPaths.set(child.threadId, rolloutPath);
        fs.writeFileSync(rolloutPath, JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            content: "raw Subject message must not cross the registry boundary"
          }
        }));
        insertEdge.run(fixture.parentThreadId, child.threadId, "open");
        insertThread.run(
          child.threadId,
          child.agentPath,
          child.agentNickname,
          null,
          "Bounded independent investigation.",
          rolloutPath,
          worktree,
          createdAtMs
        );
      }
      database.close();

      const reality = RealityEntity.create({
        depth: 0,
        kind: "waking",
        name: "Waking Reality",
        premise: constitution.premise,
        constitution
      }).bindRuntime(fixture.parentThreadId, worktree, "inception/reality").snapshot();
      const trace = new CodexSubjectRegistryTrace({
        codexHome: root,
        sqliteHome: root,
        reality,
        subjects: [],
        startedAtMs: createdAtMs
      });
      const events = trace.observe(fixture.parentThreadId);
      const reports = fixture.children.map((child) => ({
        subjectId: child.agentPath,
        name: child.reportName,
        role: child.reportRole,
        findings: ["One bounded finding."],
        artefactPaths: []
      }));

      expect(events.filter((event) => event.metadata?.subjectState === "started")).toHaveLength(2);
      expect(events.filter((event) => event.metadata?.subjectState === "completed")).toHaveLength(0);
      expect(events.every((event) =>
        event.metadata?.collaborationTool === "thread_registry"
      )).toBe(true);
      expect(JSON.stringify(events)).not.toContain("raw Subject message");
      expect(() => trace.bindReports(fixture.parentThreadId, reports)).toThrowError(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "missing_codex_return_evidence" })
          ])
        })
      );

      for (const child of fixture.children) {
        fs.appendFileSync(rolloutPaths.get(child.threadId)!, `\n${JSON.stringify({
          type: "event_msg",
          payload: { type: "task_complete", last_agent_message: "hidden output" }
        })}`);
      }
      const completedEvents = trace.observe(fixture.parentThreadId);
      expect(completedEvents.filter(
        (event) => event.metadata?.subjectState === "completed"
      )).toHaveLength(2);
      expect(JSON.stringify(completedEvents)).not.toContain("hidden output");
      expect(trace.bindReports(fixture.parentThreadId, reports)).toEqual(
        fixture.children.map((child) => ({
          id: child.agentPath,
          name: child.reportName,
          role: child.reportRole,
          mission: "Bounded independent investigation selected by Codex.",
          threadId: child.threadId
        }))
      );
    } finally {
      try {
        database.close();
      } catch {
        // The success path closes before the registry opens the database read-only.
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects opportunistic Subject reports without matching native return evidence", () => {
    const trace = new SubjectCollaborationTrace([]);
    trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["native-thread-1"],
        prompt: "Audit one bounded boundary.",
        status: "completed"
      }
    });
    trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: ["native-thread-1"],
        agents_states: {
          "native-thread-1": { status: "completed" }
        },
        status: "completed"
      }
    });

    expect(() => trace.bindReports([{
      subjectId: "invented-thread",
      name: "Invented",
      role: "Explorer",
      findings: ["Unsupported finding."],
      artefactPaths: []
    }])).toThrow(/subjectReports.*subject_native_trace_mismatch/);
  });

  it("retains the Reality thread ID in the safe thread-start event", () => {
    expect(toSafeCodexRuntimeEvent({
      type: "thread.started",
      thread_id: "019f775b-ef89-7550-9834-e0f4244d2ac0"
    }, "Waking Reality", "authorization review")).toMatchObject({
      type: "progress",
      metadata: {
        stage: "thread",
        status: "started",
        threadId: "019f775b-ef89-7550-9834-e0f4244d2ac0"
      }
    });
  });

  it("does not misclassify fallback model metadata as a failed turn", () => {
    expect(toSafeCodexRuntimeEvent({
      type: "item.completed",
      item: {
        id: "model-metadata",
        type: "error",
        message: "Model metadata for `gpt-5.6` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."
      }
    }, "Waking Reality", "password-reset review")).toMatchObject({
      type: "decision",
      summary: "Codex continued with fallback model metadata.",
      metadata: {
        stage: "model",
        status: "updated"
      }
    });
  });

  it("pins real Reality threads to GPT-5.6 with the full worktree capability", () => {
    const previousModel = process.env.INCEPTION_CODEX_MODEL;
    delete process.env.INCEPTION_CODEX_MODEL;
    try {
      const reality = RealityEntity.create({
        depth: 0,
        kind: "waking",
        name: "Waking",
        premise: constitution.premise,
        constitution
      }).bindRuntime("thread-1", "/tmp/reality-worktree", "inception/reality").snapshot();

      expect(configuredCodexModel()).toBe("gpt-5.6-sol");
      expect(codexThreadOptions(reality)).toMatchObject({
        model: "gpt-5.6-sol",
        modelReasoningEffort: "high",
        workingDirectory: "/tmp/reality-worktree",
        sandboxMode: "danger-full-access",
        approvalPolicy: "never",
        networkAccessEnabled: true,
        webSearchMode: "live"
      });
    } finally {
      if (previousModel === undefined) delete process.env.INCEPTION_CODEX_MODEL;
      else process.env.INCEPTION_CODEX_MODEL = previousModel;
    }
  });

  it("accepts only auditable Subject spawn and terminal wait evidence", () => {
    const trace = new SubjectCollaborationTrace([{
      id: "subject-attacker",
      realityId: "dream-1",
      name: "Ariadne",
      role: "Attacker",
      mission: "Probe source rotation.",
      status: "entered",
      findings: []
    }]);
    const entered = trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["thread-subject-1"],
        prompt: "SUBJECT_ID:subject-attacker\nsecret task detail",
        status: "completed"
      }
    });
    const returned = trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: ["thread-subject-1"],
        agents_states: {
          "thread-subject-1": {
            status: "completed",
            message: "raw Subject response must never be persisted"
          }
        },
        status: "completed"
      }
    });

    expect(entered[0]).toMatchObject({
      type: "subject",
      metadata: {
        subjectId: "subject-attacker",
        subjectThreadId: "thread-subject-1",
        subjectState: "started",
        collaborationTool: "spawn_agent"
      }
    });
    expect(returned[0]).toMatchObject({
      type: "subject",
      metadata: {
        subjectId: "subject-attacker",
        subjectState: "completed",
        collaborationTool: "wait"
      }
    });
    expect(JSON.stringify([...entered, ...returned])).not.toContain("secret task detail");
    expect(JSON.stringify([...entered, ...returned])).not.toContain("raw Subject response");
    expect(() => trace.requireComplete()).not.toThrow();
  });

  it("accepts a completed native close as Subject return evidence", () => {
    const trace = new SubjectCollaborationTrace([{
      id: "subject-reviewer",
      realityId: "reality-1",
      name: "Ariadne",
      role: "Boundary reviewer",
      mission: "Inspect one independent boundary.",
      status: "entered",
      findings: []
    }]);
    trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["thread-subject-close"],
        prompt: "SUBJECT_ID:subject-reviewer",
        status: "completed"
      }
    });

    const returned = trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "close_agent",
        receiver_thread_ids: [],
        agents_states: {
          "thread-subject-close": {
            status: "completed",
            message: "raw Subject response must never be persisted"
          }
        },
        status: "completed"
      }
    });

    expect(returned).toEqual([
      expect.objectContaining({
        type: "subject",
        metadata: expect.objectContaining({
          subjectId: "subject-reviewer",
          subjectState: "completed",
          collaborationTool: "close_agent"
        })
      })
    ]);
    expect(JSON.stringify(returned)).not.toContain("raw Subject response");
    expect(() => trace.requireComplete()).not.toThrow();
  });

  it("does not accept closing a running Subject as return evidence", () => {
    const trace = new SubjectCollaborationTrace([{
      id: "subject-running",
      realityId: "reality-1",
      name: "Eames",
      role: "Test engineer",
      mission: "Run one decisive proof.",
      status: "entered",
      findings: []
    }]);
    trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["thread-subject-running"],
        prompt: "SUBJECT_ID:subject-running",
        status: "completed"
      }
    });
    trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "close_agent",
        receiver_thread_ids: ["thread-subject-running"],
        agents_states: {
          "thread-subject-running": { status: "running" }
        },
        status: "completed"
      }
    });

    expect(() => trace.requireComplete()).toThrow(/missing_codex_return_evidence/);
  });

  it("rejects a Subject report when no native Codex return is observed", () => {
    const trace = new SubjectCollaborationTrace([{
      id: "subject-test",
      realityId: "dream-1",
      name: "Eames",
      role: "Test engineer",
      mission: "Build a decisive test.",
      status: "entered",
      findings: []
    }]);
    trace.observe({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["thread-subject-2"],
        prompt: "SUBJECT_ID:subject-test",
        status: "completed"
      }
    });

    try {
      trace.requireComplete();
      throw new Error("Expected missing native Subject evidence to be rejected.");
    } catch (error) {
      expect(error).toMatchObject({
        contract: "InvestigationReportSchema",
        issues: [{
          path: "subjectReports.subject-test",
          code: "missing_codex_return_evidence"
        }]
      });
    }
  });
});
