import { randomUUID } from "node:crypto";
import { WakeReportSchema, type Reality, type WakeReport } from "@inception/domain";
import {
  CodexRuntimeEventSchema,
  type CodexExecutionResult,
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexWakeResult
} from "./types";

function mockThreadId(reality: Reality): string {
  return reality.codexThreadId ?? `mock-thread-${reality.id}`;
}

function mockDelayMilliseconds(): number {
  const value = Number(process.env.INCEPTION_MOCK_DELAY_MS ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 10_000)) : 0;
}

export class MockCodexRuntime implements CodexRuntime {
  async inspect(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexExecutionResult> {
    const nested = reality.depth > 0;
    const events = [
        {
          type: "progress",
          summary: `Password-reset inspection entered ${reality.name}.`,
          metadata: { stage: "turn", status: "started" }
        },
        {
          type: "tool",
          summary: "Command returned with exit 0.",
          metadata: {
            stage: "command",
            status: "completed",
            command: "vitest run demo/password-reset",
            exitCode: 0
          }
        },
        {
          type: "file",
          summary: "Inspected demo/password-reset/src/password-reset.ts.",
          metadata: {
            stage: "file",
            status: "completed",
            paths: ["demo/password-reset/src/password-reset.ts"]
          }
        },
        {
          type: "decision",
          summary: nested
            ? "A rotating-IP attack test is the smallest decisive experiment."
            : "Per-IP throttling is not sufficient evidence of abuse resistance.",
          metadata: { stage: "turn", status: "completed" }
        }
      ].map((event) => CodexRuntimeEventSchema.parse(event));
    const eventDelay = Math.floor(mockDelayMilliseconds() / events.length);
    for (const event of events) {
      await onEvent?.(event);
      if (eventDelay) await new Promise((resolve) => setTimeout(resolve, eventDelay));
    }
    return {
      threadId: mockThreadId(reality),
      summary: nested
        ? "The dream reproduced abuse across independent source addresses."
        : "The implementation limits requests by IP but exposes account state and lacks identifier-level protection.",
      events
    };
  }

  async wake(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexWakeResult> {
    const generatedAt = new Date().toISOString();
    const report: WakeReport = reality.depth >= 2
      ? {
          realityId: reality.id,
          initialBeliefs: [{
            statement: "Per-IP throttling will stop repeated password-reset abuse.",
            confidence: 0.64
          }],
          experiences: [
            "Sent reset requests for one account from twelve rotating source IPs.",
            "Observed every request pass because each IP remained below its local threshold.",
            "Captured a deterministic failing test that reproduces the distributed attack."
          ],
          changedBeliefs: [{
            from: "Per-IP throttling will stop repeated password-reset abuse.",
            to: "Per-IP throttling must be combined with identifier-level and global safeguards.",
            confidence: 0.98,
            evidenceIds: reality.evidence.map((entry) => entry.id)
          }],
          invariants: [
            "The public response must not reveal whether an account exists.",
            "A defensive limit must survive source-address rotation."
          ],
          artefacts: [{
            name: "rotating-ip.attack.spec.ts",
            path: "demo/password-reset/tests/rotating-ip.attack.spec.ts",
            kind: "test",
            summary: "Fails against the incomplete implementation after six distributed requests.",
            content: "expect(results.filter(r => r.accepted)).toHaveLength(5);"
          }],
          remainingUncertainty: ["How aggressively should global circuit breaking respond during a real incident?"],
          recommendation: "Add per-identifier cooldown and a global safety budget while retaining per-IP limits.",
          generatedAt
        }
      : {
          realityId: reality.id,
          initialBeliefs: [{
            statement: "Per-IP limiting probably prevents practical password-reset abuse.",
            confidence: 0.72
          }],
          experiences: [
            "The attacker Subject observed account-specific response differences.",
            "The investigator Subject found no identifier-level cooldown.",
            "The test-engineer Subject inherited the rotating-IP failing test from the nested Dream."
          ],
          changedBeliefs: [{
            from: "Per-IP limiting probably prevents practical password-reset abuse.",
            to: "Abuse controls must be layered and responses must be enumeration-safe.",
            confidence: 0.97,
            evidenceIds: reality.evidence.map((entry) => entry.id)
          }],
          invariants: [
            "Known and unknown accounts receive the same public response.",
            "Reset tokens retain their existing expiry semantics.",
            "Parent-owned anchor tests remain immutable."
          ],
          artefacts: [{
            name: "coordinated-attack-memory.md",
            path: ".inception/memories/coordinated-attack.md",
            kind: "note",
            summary: "Consolidates enumeration and distributed-abuse evidence."
          }],
          remainingUncertainty: ["Production thresholds require telemetry calibration."],
          recommendation: "Synthesis should add generic responses, per-IP limits, per-identifier cooldown, and a global budget.",
          generatedAt
        };

    const events = [
      {
        type: "decision",
        summary: "The Kick was accepted and exploration stopped.",
        metadata: { stage: "turn", status: "completed" }
      },
      {
        type: "file",
        summary: `Memory artefact ${report.artefacts[0]?.name ?? randomUUID()} prepared.`,
        metadata: {
          stage: "file",
          status: "completed",
          paths: report.artefacts[0]?.path ? [report.artefacts[0].path] : undefined
        }
      }
    ].map((event) => CodexRuntimeEventSchema.parse(event));
    for (const event of events) await onEvent?.(event);

    return {
      threadId: mockThreadId(reality),
      report: WakeReportSchema.parse(report),
      events
    };
  }
}
