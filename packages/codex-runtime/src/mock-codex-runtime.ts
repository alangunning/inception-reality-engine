import { randomUUID } from "node:crypto";
import {
  InvestigationReportSchema,
  SynthesisReportSchema,
  WakeReportSchema,
  type InvestigationReport,
  type Reality,
  type WakeReport
} from "@inception/domain";
import {
  CodexRuntimeEventSchema,
  type CodexExecutionResult,
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexSynthesisResult,
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
  readonly mode = "mock" as const;

  info() {
    return { mode: this.mode, model: "deterministic-mock", sdkVersion: "0.144.6" } as const;
  }

  activeOperations() {
    return [];
  }

  abortAll(): number {
    return 0;
  }

  async inspect(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexExecutionResult> {
    const nested = reality.depth > 0;
    const subjectEvents = reality.subjects.flatMap((subject) => [
      {
        type: "subject",
        summary: `Subject entered Codex thread: ${subject.name}.`,
        metadata: {
          stage: "subject",
          status: "completed",
          subjectId: subject.id,
          subjectName: subject.name,
          subjectRole: subject.role,
          subjectThreadId: `mock-subject-${subject.id}`,
          subjectState: "started",
          collaborationTool: "spawn_agent"
        }
      },
      {
        type: "subject",
        summary: `Subject completed bounded investigation: ${subject.name}.`,
        metadata: {
          stage: "subject",
          status: "completed",
          subjectId: subject.id,
          subjectName: subject.name,
          subjectRole: subject.role,
          subjectThreadId: `mock-subject-${subject.id}`,
          subjectState: "completed",
          collaborationTool: "wait"
        }
      }
    ]);
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
        ...subjectEvents,
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
    const generatedAt = new Date().toISOString();
    const report: InvestigationReport = reality.depth === 0
      ? {
          realityId: reality.id,
          summary: "The implementation limits requests by IP but exposes account state and lacks identifier-level protection.",
          evidence: [{
            kind: "code",
            title: "IP-only throttle",
            summary: "The implementation counts requests by source IP but has no identifier-level or global safety budget.",
            source: "demo/password-reset/src/password-reset.ts",
            artefactPath: "demo/password-reset/src/password-reset.ts",
            synthetic: false
          }],
          subjectReports: [],
          changedBeliefs: [],
          dreamProposal: {
            title: "Under coordinated attack",
            premise: "Assume an attacker coordinates requests across accounts and source addresses.",
            uncertainty: "Does per-IP rate limiting actually prevent abuse?",
            rationale: "The implementation has only been evaluated in a single-source world.",
            impactProbability: 0.82,
            expectedInsight: "Determine whether identifier and global controls are necessary.",
            estimatedTokens: 18_000,
            costClass: "medium"
          },
          remainingUncertainty: ["Whether coordinated sources can bypass the IP-only boundary."],
          changedFiles: [],
          generatedAt
        }
      : {
          realityId: reality.id,
          summary: "Enumeration is observable and distributed source addresses have no shared identifier budget.",
          evidence: [
            {
              kind: "observation",
              title: "Account enumeration remains possible",
              summary: "The incomplete service returns a distinct message when an account does not exist.",
              source: "attacker-subject",
              artefactPath: null,
              synthetic: false
            },
            {
              kind: "code",
              title: "Distributed abuse has no shared budget",
              summary: "Requests from new IP addresses begin with fresh counters even when the same account is targeted.",
              source: "investigator-subject",
              artefactPath: "demo/password-reset/src/password-reset.ts",
              synthetic: false
            }
          ],
          subjectReports: reality.subjects.map((subject) => ({
            subjectId: subject.id,
            name: subject.name,
            role: subject.role,
            findings: subject.role === "Attacker"
              ? ["Known and unknown accounts receive distinguishable responses."]
              : subject.role === "Investigator"
                ? ["Counters are keyed only by IP; identifiers have no cooldown."]
                : ["A rotating-source test will decide whether the defence generalises."],
            artefactPaths: []
          })),
          changedBeliefs: [{
            from: reality.beliefs.at(-1)?.statement ?? "Per-IP limiting prevents practical abuse.",
            to: "Per-IP throttling alone does not generalise to coordinated or distributed abuse.",
            confidence: 0.93,
            evidenceTitles: [
              "Account enumeration remains possible",
              "Distributed abuse has no shared budget"
            ]
          }],
          dreamProposal: {
            title: "Rotating IP swarm",
            premise: "Assume one attacker can rotate source IPs for every request against one identifier.",
            uncertainty: "Can source rotation obtain effectively unlimited reset deliveries?",
            rationale: "A nested world can isolate the distributed-address assumption and produce one decisive test.",
            impactProbability: 0.91,
            expectedInsight: "Produce a deterministic distributed-address abuse test.",
            estimatedTokens: 9_000,
            costClass: "low"
          },
          remainingUncertainty: ["Whether rotating source addresses bypass the defence in a deterministic test."],
          changedFiles: [],
          generatedAt
        };
    return {
      threadId: mockThreadId(reality),
      summary: report.summary,
      report: InvestigationReportSchema.parse(report),
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

  async synthesise(
    reality: Reality,
    reports: WakeReport[],
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexSynthesisResult> {
    const event = CodexRuntimeEventSchema.parse({
      type: "decision",
      summary: "Validated memories are ready for deterministic demo synthesis.",
      metadata: { stage: "turn", status: "completed" }
    });
    await onEvent?.(event);
    return {
      threadId: mockThreadId(reality),
      events: [event],
      report: SynthesisReportSchema.parse({
        realityId: reality.id,
        summary: "Layered abuse controls and returned attack tests are ready to enter the waking Reality.",
        appliedMemories: reports.map((report) => report.realityId),
        changedFiles: [],
        retainedArtefacts: reports.flatMap((report) => report.artefacts.map((artefact) => artefact.path)),
        unresolved: reports.flatMap((report) => report.remainingUncertainty),
        generatedAt: new Date().toISOString()
      }),
      applied: false
    };
  }
}
