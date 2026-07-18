import { describe, expect, it } from "vitest";
import { RealityEntity } from "@inception/domain";
import {
  buildSubjectOrchestrationPrompt,
  CodexRuntimeEventSchema,
  MockCodexRuntime,
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
});
