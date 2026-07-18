import { randomUUID } from "node:crypto";
import type { Reality, WakeReport } from "@inception/domain";
import type { CodexExecutionResult, CodexRuntime, CodexWakeResult } from "./types";

function mockThreadId(reality: Reality): string {
  return reality.codexThreadId ?? `mock-thread-${reality.id}`;
}

export class MockCodexRuntime implements CodexRuntime {
  async inspect(reality: Reality): Promise<CodexExecutionResult> {
    const nested = reality.depth > 0;
    return {
      threadId: mockThreadId(reality),
      summary: nested
        ? "The dream reproduced abuse across independent source addresses."
        : "The implementation limits requests by IP but exposes account state and lacks identifier-level protection.",
      events: [
        { type: "progress", summary: "Codex inspected the password-reset boundary." },
        { type: "tool", summary: "Relevant implementation and tests were read inside the Reality worktree." },
        {
          type: "decision",
          summary: nested
            ? "A rotating-IP attack test is the smallest decisive experiment."
            : "Per-IP throttling is not sufficient evidence of abuse resistance."
        }
      ]
    };
  }

  async wake(reality: Reality): Promise<CodexWakeResult> {
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

    return {
      threadId: mockThreadId(reality),
      report,
      events: [
        { type: "decision", summary: "The Kick was accepted and exploration stopped." },
        { type: "file", summary: `Memory artefact ${report.artefacts[0]?.name ?? randomUUID()} prepared.` }
      ]
    };
  }
}
