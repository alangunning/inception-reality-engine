import { describe, expect, it } from "vitest";
import { RealityEntity } from "@inception/domain";
import { MockCodexRuntime, WakeReportParser } from "../src";

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
  });

  it("rejects malformed wake reports", () => {
    const parser = new WakeReportParser();
    expect(() => parser.parse('{"realityId":"x"}')).toThrow();
  });
});
