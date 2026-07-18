import { describe, expect, it } from "vitest";
import { RealityEntity } from "@inception/domain";
import {
  buildSubjectOrchestrationPrompt,
  codexThreadOptions,
  configuredCodexModel,
  CodexRuntimeEventSchema,
  MockCodexRuntime,
  SubjectCollaborationTrace,
  toSafeCodexRuntimeEvent,
  WakeReportParser,
  WakeReportValidationError
} from "../src";

const constitution = {
  mission: "Test password reset",
  premise: "Rotating IPs may bypass limits",
  constraints: ["No raw reasoning"],
  wakeContract: ["Return JSON"],
  parentTruths: []
};

describe("Codex runtime", () => {
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
    expect(prompt).toContain("must not spawn further subagents");
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

      expect(configuredCodexModel()).toBe("gpt-5.6");
      expect(codexThreadOptions(reality)).toMatchObject({
        model: "gpt-5.6",
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
