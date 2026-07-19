import { randomUUID } from "node:crypto";
import { Codex, type Thread, type ThreadOptions } from "@openai/codex-sdk";
import {
  AdversarialInterventionReportSchema,
  InvestigationReportSchema,
  SynthesisReportSchema,
  WakeReportSchema,
  buildDreamPrompt,
  type AdversarialInterventionReport,
  type InvestigationReport,
  type MissionInterventionContract,
  type Reality,
  type SynthesisReport,
  type Subject,
  type WakeReport
} from "@inception/domain";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CodexOutputValidationError,
  CodexRuntimeEventSchema,
  type CodexExecutionResult,
  type CodexInterventionResult,
  type CodexObservedSubject,
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexSynthesisResult,
  type CodexWakeResult
} from "./types";
import { WakeReportParser, WakeReportValidationError } from "./wake-report-parser";
import {
  normaliseCodexExecutionError,
  prepareCodexExecutionEnvironment,
  type CodexExecutionEnvironmentOptions
} from "./codex-execution-environment";

const CODEX_SDK_VERSION = "0.144.6";

export function configuredCodexModel(): string {
  return process.env.INCEPTION_CODEX_MODEL?.trim() || "gpt-5.6";
}

export function codexThreadOptions(reality: Reality): ThreadOptions {
  if (!reality.worktreePath) {
    throw new Error(`Reality ${reality.id} has no worktree.`);
  }
  return {
    model: configuredCodexModel(),
    modelReasoningEffort: "high",
    workingDirectory: reality.worktreePath,
    sandboxMode: "danger-full-access",
    approvalPolicy: "never",
    networkAccessEnabled: true,
    webSearchMode: "live"
  };
}

function compact(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalised = value
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(
      /(\b(?:OPENAI_API_KEY|CODEX_API_KEY|API_KEY|ACCESS_TOKEN|AUTH_TOKEN|PASSWORD|SECRET)=)(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
      "$1[REDACTED]"
    )
    .replace(
      /(\b--?(?:api[-_]?key|access[-_]?token|auth[-_]?token|password|secret)(?:=|\s+))(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
      "$1[REDACTED]"
    )
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalised) return undefined;
  return normalised.length > maximum ? `${normalised.slice(0, maximum - 3)}...` : normalised;
}

function compactCommand(value: unknown, maximum: number): string | undefined {
  return compact(
    typeof value === "string" ? value.replace(/\r?\n+/g, " ; ") : value,
    maximum
  );
}

function integer(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function parseStructuredJson<T>(
  raw: string,
  contract: "InvestigationReportSchema" | "AdversarialInterventionReportSchema" | "SynthesisReportSchema",
  parse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; code: string }> } }
): T {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new CodexOutputValidationError(contract, [{ path: "$", code: "invalid_json" }]);
  }
  const result = parse(value);
  if (!result.success) {
    throw new CodexOutputValidationError(
      contract,
      result.error.issues.map((issue) => ({
        path: issue.path.length ? issue.path.join(".") : "$",
        code: issue.code
      }))
    );
  }
  return result.data;
}

interface CommandFailure {
  failureKind: "test" | "environment" | "configuration" | "missing-tool" | "build" | "command";
  diagnostic: string;
}

function classifyCommandFailure(command: string | undefined, output: unknown): CommandFailure {
  const text = typeof output === "string" ? output : "";
  if (/\b(?:EPERM|EACCES)\b|permission denied|operation not permitted/i.test(text)) {
    return {
      failureKind: "environment",
      diagnostic: "The command could not write a required cache or temporary file."
    };
  }
  if (/non-standard [\"']NODE_ENV[\"']|NODE_ENV value/i.test(text)) {
    return {
      failureKind: "environment",
      diagnostic: "The command inherited a development NODE_ENV during a production operation."
    };
  }
  if (/__dirname is not defined|failed to load config|config(?:uration)? error/i.test(text)) {
    return {
      failureKind: "configuration",
      diagnostic: "The command reached an incompatible or unloadable project configuration."
    };
  }
  if (/command not found|cannot find (?:module|package)|module_not_found/i.test(text)) {
    return {
      failureKind: "missing-tool",
      diagnostic: "A required executable or package was unavailable in this Reality."
    };
  }
  if (/Failed Tests|AssertionError|(?:tests?|assertions?).{0,40}\bfailed\b/i.test(text)) {
    const count = text.match(/(\d+)\s+failed/i)?.[1];
    return {
      failureKind: "test",
      diagnostic: count
        ? `The test suite ran and returned ${count} failing assertion${count === "1" ? "" : "s"} as evidence.`
        : "The test suite ran and returned failing assertions as evidence."
    };
  }
  if (/\bbuild\b/i.test(command ?? "") || /build failed|prerendering page|failed to compile/i.test(text)) {
    return {
      failureKind: "build",
      diagnostic: "The production build returned a non-zero exit code."
    };
  }
  return {
    failureKind: "command",
    diagnostic: "The command returned a non-zero exit code without a recognised safe diagnostic."
  };
}

function itemStatus(eventType: string | undefined, itemStatusValue: string | undefined): "started" | "updated" | "completed" | "failed" | undefined {
  if (eventType === "item.started") return "started";
  if (eventType === "item.updated") return "updated";
  if (eventType === "item.completed") return itemStatusValue === "failed" ? "failed" : "completed";
  return undefined;
}

const CollabEventSchema = z.object({
  type: z.enum(["item.started", "item.updated", "item.completed"]),
  item: z.object({
    type: z.literal("collab_tool_call"),
    tool: z.enum(["spawn_agent", "send_input", "wait", "close_agent"]),
    receiver_thread_ids: z.array(z.string()),
    prompt: z.string().nullable().optional(),
    agents_states: z.record(z.object({
      status: z.enum(["pending_init", "running", "interrupted", "completed", "errored", "shutdown", "not_found"]),
      message: z.unknown().optional()
    }).passthrough()).optional(),
    status: z.enum(["in_progress", "completed", "failed"])
  }).passthrough()
}).passthrough();

export class SubjectCollaborationTrace {
  private readonly subjects: Map<string, Pick<Subject, "id" | "name" | "role">>;
  private readonly acceptsOpportunisticSubjects: boolean;
  private readonly opportunistic = new Set<string>();
  private readonly subjectByThread = new Map<string, string>();
  private readonly spawned = new Set<string>();
  private readonly returned = new Set<string>();
  private readonly failed = new Set<string>();

  constructor(subjects: Subject[]) {
    this.subjects = new Map(subjects.map((subject) => [subject.id, subject]));
    this.acceptsOpportunisticSubjects = subjects.length === 0;
  }

  observe(rawEvent: unknown): CodexRuntimeEvent[] {
    const parsed = CollabEventSchema.safeParse(rawEvent);
    if (!parsed.success || parsed.data.type !== "item.completed") return [];
    const item = parsed.data.item;

    if (item.tool === "spawn_agent" && item.status === "completed") {
      const subjectId = item.prompt?.match(/\bSUBJECT_ID:([A-Za-z0-9_-]+)\b/)?.[1];
      const threadId = item.receiver_thread_ids[0];
      let subject = subjectId ? this.subjects.get(subjectId) : undefined;
      if (!subject && this.acceptsOpportunisticSubjects && threadId) {
        subject = {
          id: threadId,
          name: `Codex Subject ${this.opportunistic.size + 1}`,
          role: "Independent investigator"
        };
        this.subjects.set(subject.id, subject);
        this.opportunistic.add(subject.id);
      }
      if (!subject || !threadId) return [];
      this.spawned.add(subject.id);
      this.subjectByThread.set(threadId, subject.id);
      return [CodexRuntimeEventSchema.parse({
        type: "subject",
        summary: `Subject entered Codex thread: ${subject.name}.`,
        metadata: {
          stage: "subject",
          status: "completed",
          subjectId: subject.id,
          subjectName: subject.name,
          subjectRole: subject.role,
          subjectThreadId: threadId,
          subjectState: "started",
          collaborationTool: "spawn_agent"
        }
      })];
    }

    if (item.tool !== "wait") return [];
    const events: CodexRuntimeEvent[] = [];
    for (const threadId of item.receiver_thread_ids) {
      const subjectId = this.subjectByThread.get(threadId);
      const subject = subjectId ? this.subjects.get(subjectId) : undefined;
      if (!subject) continue;
      const state = item.agents_states?.[threadId]?.status;
      if (item.status === "failed" || (state && ["interrupted", "errored", "shutdown", "not_found"].includes(state))) {
        this.failed.add(subject.id);
        events.push(CodexRuntimeEventSchema.parse({
          type: "subject",
          summary: `Subject investigation failed: ${subject.name}.`,
          metadata: {
            stage: "subject",
            status: "failed",
            subjectId: subject.id,
            subjectName: subject.name,
            subjectRole: subject.role,
            subjectThreadId: threadId,
            subjectState: "failed",
            collaborationTool: "wait"
          }
        }));
      } else if (state === "completed") {
        this.returned.add(subject.id);
        events.push(CodexRuntimeEventSchema.parse({
          type: "subject",
          summary: `Subject completed bounded investigation: ${subject.name}.`,
          metadata: {
            stage: "subject",
            status: "completed",
            subjectId: subject.id,
            subjectName: subject.name,
            subjectRole: subject.role,
            subjectThreadId: threadId,
            subjectState: "completed",
            collaborationTool: "wait"
          }
        }));
      }
    }
    return events;
  }

  requireComplete(): void {
    for (const subject of this.subjects.values()) {
      if (!this.spawned.has(subject.id)) {
        throw new CodexOutputValidationError("InvestigationReportSchema", [{
          path: `subjectReports.${subject.id}`,
          code: "missing_codex_spawn_evidence"
        }]);
      }
      if (this.failed.has(subject.id) || !this.returned.has(subject.id)) {
        throw new CodexOutputValidationError("InvestigationReportSchema", [{
          path: `subjectReports.${subject.id}`,
          code: "missing_codex_return_evidence"
        }]);
      }
    }
  }

  bindReports(
    reports: InvestigationReport["subjectReports"]
  ): CodexObservedSubject[] {
    this.requireComplete();
    if (!this.opportunistic.size) return [];

    const unexpected = reports.find((report) =>
      !this.opportunistic.has(report.subjectId)
      || !this.returned.has(report.subjectId)
    );
    if (unexpected || reports.length !== this.opportunistic.size) {
      throw new CodexOutputValidationError("InvestigationReportSchema", [{
        path: "subjectReports",
        code: "subject_native_trace_mismatch"
      }]);
    }

    return reports.map((report) => ({
      id: report.subjectId,
      name: report.name,
      role: report.role,
      mission: "Bounded independent investigation selected by Codex.",
      threadId: this.threadIdFor(report.subjectId)!
    }));
  }

  threadIdFor(subjectId: string): string | undefined {
    for (const [threadId, mappedSubjectId] of this.subjectByThread) {
      if (mappedSubjectId === subjectId && this.returned.has(subjectId)) return threadId;
    }
    return undefined;
  }
}

export function buildSubjectOrchestrationPrompt(reality: Reality): string {
  const activeSubjects = reality.subjects.filter((subject) =>
    subject.status === "entered" || subject.status === "investigating"
  );
  if (!activeSubjects.length) {
    return `SUBJECT ORCHESTRATION
Delegate only when you identify at least two bounded, independent investigations that can run concurrently. When that condition is met, use Codex subagent collaboration tools, wait for every Subject to return, and incorporate only concise findings and evidence. Keep sequential or tightly coupled work in this thread.
For every opportunistic Subject, use the native child thread ID returned by spawn_agent as subjectReports[].subjectId and return exactly one Subject report after that thread reaches a completed terminal state.`;
  }

  const charters = activeSubjects
    .map((subject) => `- SUBJECT_ID:${subject.id} | ${subject.name} (${subject.role}): ${subject.mission}`)
    .join("\n");
  return `SUBJECT ORCHESTRATION
Use Codex subagent collaboration tools to spawn one direct subagent for each Subject below. Run them in parallel when capacity allows, keep every investigation bounded to its charter, and wait for every Subject to return before synthesis.
${charters}
Include the exact SUBJECT_ID marker in each spawn_agent task so the returned child thread can be bound to its charter. Use wait_agent with timeout_ms=3600000 and wait again until every Subject is terminal.
Subjects inherit this Reality's worktree, constitution, model, and immutable anchors. They must return concise evidence and artefacts only, and must not spawn further subagents.`;
}

export function toSafeCodexRuntimeEvent(rawEvent: unknown, realityName: string, scope: string): CodexRuntimeEvent | null {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const event = rawEvent as {
    type?: string;
    thread_id?: unknown;
    message?: unknown;
    error?: { message?: unknown };
    usage?: {
      input_tokens?: unknown;
      output_tokens?: unknown;
      reasoning_output_tokens?: unknown;
    };
    item?: {
      type?: string;
      command?: unknown;
      aggregated_output?: unknown;
      exit_code?: unknown;
      status?: string;
      server?: unknown;
      tool?: unknown;
      query?: unknown;
      changes?: Array<{ path?: unknown; kind?: unknown }>;
      items?: Array<{ completed?: unknown; text?: unknown }>;
      message?: unknown;
      text?: unknown;
    };
  };
  const safeRealityName = compact(realityName, 80) ?? "the Reality";
  const safeScope = compact(scope, 100) ?? "Reality";

  if (event.type === "thread.started") {
    return CodexRuntimeEventSchema.parse({
      type: "progress",
      summary: `Codex thread entered ${safeRealityName} worktree.`,
      metadata: {
        stage: "thread",
        status: "started",
        threadId: compact(event.thread_id, 100)
      }
    });
  }
  if (event.type === "turn.started") {
    return CodexRuntimeEventSchema.parse({
      type: "progress",
      summary: `${safeScope} entered ${safeRealityName}.`,
      metadata: { stage: "turn", status: "started" }
    });
  }
  if (event.type === "turn.completed") {
    return CodexRuntimeEventSchema.parse({
      type: "progress",
      summary: `${safeScope} returned from ${safeRealityName}.`,
      metadata: {
        stage: "turn",
        status: "completed",
        inputTokens: integer(event.usage?.input_tokens),
        outputTokens: integer(event.usage?.output_tokens),
        reasoningTokens: integer(event.usage?.reasoning_output_tokens)
      }
    });
  }
  if (event.type === "turn.failed" || event.type === "error") {
    return CodexRuntimeEventSchema.parse({
      type: "decision",
      summary: `${safeScope} could not complete in ${safeRealityName}.`,
      metadata: {
        stage: "turn",
        status: "failed",
        detail: compact(event.error?.message ?? event.message, 220)
      }
    });
  }

  const item = event.item;
  if (!item?.type || item.type === "reasoning" || item.type === "agent_message") return null;
  if (event.type === "item.updated" && item.type !== "todo_list") return null;
  const status = itemStatus(event.type, item.status);
  if (!status) return null;

  if (item.type === "command_execution") {
    const command = compactCommand(item.command, 180);
    const exitCode = integer(item.exit_code);
    const failure: Partial<CommandFailure> = status === "failed"
      ? classifyCommandFailure(command, item.aggregated_output)
      : {};
    return CodexRuntimeEventSchema.parse({
      type: "tool",
      summary: status === "started"
        ? `Command entered${command ? `: ${command}` : ""}.`
        : status === "failed"
          ? failure.failureKind === "test"
            ? `Test evidence returned${exitCode === undefined ? "" : ` with exit ${exitCode}`}.`
            : `Command failed${exitCode === undefined ? "" : ` with exit ${exitCode}`}.`
          : `Command returned${exitCode === undefined ? "" : ` with exit ${exitCode}`}.`,
      metadata: {
        stage: "command",
        status,
        command,
        exitCode,
        ...failure
      }
    });
  }

  if (item.type === "file_change") {
    const paths = (item.changes ?? [])
      .map((change) => compact(change.path, 240))
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, 5);
    const firstPath = paths[0];
    if (!firstPath) return null;
    return CodexRuntimeEventSchema.parse({
      type: "file",
      summary: status === "started"
        ? `File change entered: ${firstPath}.`
        : status === "failed"
          ? `File change failed: ${firstPath}.`
          : `File changed: ${firstPath}.`,
      metadata: {
        stage: "file",
        status,
        paths
      }
    });
  }

  if (item.type === "mcp_tool_call") {
    const server = compact(item.server, 50);
    const tool = compact(item.tool, 60);
    const toolName = [server, tool].filter(Boolean).join(" / ");
    return CodexRuntimeEventSchema.parse({
      type: "tool",
      summary: status === "started"
        ? `Tool entered${toolName ? `: ${toolName}` : ""}.`
        : status === "failed"
          ? `Tool failed${toolName ? `: ${toolName}` : ""}.`
          : `Tool returned${toolName ? `: ${toolName}` : ""}.`,
      metadata: {
        stage: "tool",
        status,
        tool: toolName || undefined
      }
    });
  }

  if (item.type === "web_search") {
    return CodexRuntimeEventSchema.parse({
      type: "tool",
      summary: status === "started" ? "Web search entered." : "Web search returned.",
      metadata: {
        stage: "search",
        status,
        detail: compact(item.query, 180)
      }
    });
  }

  if (item.type === "todo_list") {
    const totalItems = item.items?.length ?? 0;
    const completedItems = item.items?.filter((todo) => todo.completed === true).length ?? 0;
    const planSteps = (item.items ?? [])
      .map((todo) => {
        const text = compact(todo.text, 160);
        return text
          ? {
              text,
              status: todo.completed === true ? "completed" as const : "pending" as const
            }
          : null;
      })
      .filter((step): step is { text: string; status: "completed" | "pending" } => Boolean(step))
      .slice(0, 20);
    return CodexRuntimeEventSchema.parse({
      type: "progress",
      summary: `Plan updated: ${completedItems} of ${totalItems} steps complete.`,
      metadata: {
        stage: "plan",
        status,
        completedItems,
        totalItems,
        planSteps
      }
    });
  }

  if (item.type === "error") {
    return CodexRuntimeEventSchema.parse({
      type: "decision",
      summary: "Codex reported an operation error.",
      metadata: {
        stage: "turn",
        status: "failed",
        detail: compact(item.message, 220)
      }
    });
  }

  return null;
}

export class RealCodexRuntime implements CodexRuntime {
  readonly mode = "real" as const;
  private readonly codex: Codex;
  private readonly parser = new WakeReportParser();
  private readonly operations = new Map<string, {
    controller: AbortController;
    realityId: string;
    model: string;
    startedAt: string;
  }>();

  constructor(options: CodexExecutionEnvironmentOptions = {}) {
    const executionEnvironment = prepareCodexExecutionEnvironment(options);
    const apiKey = executionEnvironment.env.CODEX_API_KEY?.trim()
      || executionEnvironment.env.OPENAI_API_KEY?.trim();
    this.codex = new Codex({
      apiKey: apiKey || undefined,
      env: executionEnvironment.env,
      config: {
        show_raw_agent_reasoning: false,
        features: {
          multi_agent: true
        },
        agents: {
          max_threads: 6,
          max_depth: 1,
          job_max_runtime_seconds: 3600
        }
      }
    });
  }

  info() {
    return {
      mode: this.mode,
      model: configuredCodexModel(),
      sdkVersion: CODEX_SDK_VERSION
    } as const;
  }

  activeOperations() {
    return [...this.operations].map(([id, operation]) => ({
      id,
      realityId: operation.realityId,
      model: operation.model,
      startedAt: operation.startedAt
    }));
  }

  abortAll(): number {
    const active = [...this.operations.values()];
    for (const operation of active) operation.controller.abort();
    return active.length;
  }

  async inspect(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexExecutionResult> {
    const scope = reality.constitution.scope ?? reality.name;
    const operationLabel = `${scope} source review`;
    const diagnosisRequired = (reality.constitution.runtimeLaws ?? []).some((law) =>
      law.includes("sealed controlled intervention")
      || law.includes("sealed adversarial intervention")
    );
    const prompt = `${buildDreamPrompt(reality)}

${buildSubjectOrchestrationPrompt(reality)}

TASK
Inspect the local source for the defined repository-maintenance task covering ${scope}, then run decisive local tests inside this Reality. Do not contact a running service, external target, account, or network system. In a waking Reality, preserve the baseline implementation until counterfactual evidence returns; in a Dream, you may change code and create tests to experience the premise.
${reality.depth >= 2 ? "This nested Dream must create a real regression test that encodes the inherited invariant, execute it against the current implementation, and retain the failing test file in the worktree before returning. A prose-only or simulated artefact is invalid." : ""}
${diagnosisRequired ? "This Reality contains a sealed controlled intervention. Do not inspect Git reflogs, unreachable commits, or .inception control files. Diagnose only the observable implementation, behavior, tests, and evidence. Return adversarialDiagnosis with the suspected fault class, changed files, evidence titles, confidence, and remaining uncertainty." : ""}
Every active Subject must be represented by one subjectReports entry using its exact id, name, and role. Return only structured evidence, Subject findings, belief changes, Dream proposals when uncertainty remains, and changed file paths. Set synthetic=true for simulated evidence.
${reality.depth === 0 && reality.constitution.dreamStrategy === "competing-siblings"
    ? "Return dreamProposal and alternativeDreamProposal as two materially different, bounded, defensive counterfactuals that can test competing explanations. Neither may request external interaction."
    : "Return the single highest-value uncertainty in dreamProposal and set alternativeDreamProposal to null."}`;
    const outputSchema = zodToJsonSchema(InvestigationReportSchema, {
      target: "openAi",
      $refStrategy: "none"
    }) as Record<string, unknown>;
    const activeSubjects = reality.subjects.filter((subject) =>
      subject.status === "entered" || subject.status === "investigating"
    );
    const subjectTrace = new SubjectCollaborationTrace(activeSubjects);
    const { thread, events, finalResponse } = await this.streamStructured(
      reality,
      operationLabel,
      prompt,
      outputSchema,
      onEvent,
      subjectTrace
    );
    const report = parseStructuredJson<InvestigationReport>(
      finalResponse,
      "InvestigationReportSchema",
      (value) => InvestigationReportSchema.safeParse(value)
    );
    if (report.realityId !== reality.id) {
      throw new CodexOutputValidationError("InvestigationReportSchema", [{
        path: "realityId",
        code: "identity_mismatch"
      }]);
    }
    const observedSubjects = subjectTrace.bindReports(report.subjectReports);

    return {
      threadId: this.requireThreadId(thread),
      events,
      summary: report.summary,
      report,
      observedSubjects
    };
  }

  async intervene(
    reality: Reality,
    contract: MissionInterventionContract,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexInterventionResult> {
    const subjectReality: Reality = {
      ...reality,
      codexThreadId: reality.codexThreadId?.startsWith("unbound:")
        ? undefined
        : reality.codexThreadId,
      subjects: [{
        ...contract.subject,
        realityId: reality.id,
        status: "entered",
        findings: []
      }]
    };
    const subjectTrace = new SubjectCollaborationTrace(subjectReality.subjects);
    const outputSchema = zodToJsonSchema(AdversarialInterventionReportSchema, {
      target: "openAi",
      $refStrategy: "none"
    }) as Record<string, unknown>;
    const prompt = `${buildDreamPrompt(subjectReality)}

${buildSubjectOrchestrationPrompt(subjectReality)}

SEALED CONTROLLED RESILIENCE INTERVENTION
Introduce exactly one minimal, reversible local fault that tests this defensive hypothesis:
${contract.hypothesis}

Allowed fault classes: ${contract.faultClasses.join(", ")}
Allowed path patterns: ${contract.allowedPaths.join(", ")}
Protected path patterns: ${contract.protectedPaths.join(", ")}
Hard limits: at most ${contract.maxChangedFiles} changed files, ${contract.maxPatchLines} patch lines, ${contract.tokenBudget} tokens, and ${contract.maxMinutes} minutes.

Only the named controlled-intervention Subject may edit. Do not modify Git metadata, .inception control files, immutable proof definitions, protected paths, dependency lockfiles unless explicitly allowed, or anything outside this Reality worktree. Do not commit. Do not add explanatory comments, filenames, notes, or tests that reveal the injected cause. The altered implementation must remain diagnosable from observable behavior and ordinary code evidence.

Return only AdversarialInterventionReportSchema JSON. Set contractId to "${contract.id}", realityId to "${reality.id}", and subjectId to "${contract.subject.id}". Report exact changed paths and expected observable symptoms without raw reasoning.`;
    const { thread, events, finalResponse } = await this.streamStructured(
      subjectReality,
      "Sealed controlled resilience intervention",
      prompt,
      outputSchema,
      onEvent,
      subjectTrace,
      false,
      contract.maxMinutes * 60_000
    );
    const report = parseStructuredJson<AdversarialInterventionReport>(
      finalResponse,
      "AdversarialInterventionReportSchema",
      (value) => AdversarialInterventionReportSchema.safeParse(value)
    );
    if (
      report.contractId !== contract.id
      || report.realityId !== reality.id
      || report.subjectId !== contract.subject.id
    ) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "identity",
        code: "identity_mismatch"
      }]);
    }
    if (!contract.faultClasses.includes(report.faultClass)) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "faultClass",
        code: "fault_class_outside_contract"
      }]);
    }
    subjectTrace.requireComplete();
    const subjectThreadId = subjectTrace.threadIdFor(contract.subject.id);
    if (!subjectThreadId) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "subjectId",
        code: "missing_codex_subject_thread"
      }]);
    }
    return {
      coordinatorThreadId: this.requireThreadId(thread),
      subjectThreadId,
      events,
      report
    };
  }

  async wake(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexWakeResult> {
    const outputSchema = zodToJsonSchema(WakeReportSchema, {
      target: "openAi",
      $refStrategy: "none"
    }) as Record<string, unknown>;
    const { thread, events, finalResponse } = await this.streamStructured(
      reality,
      "Wake Report generation",
      `${buildDreamPrompt(reality)}\n\nKICK\nStop exploring now. Return the Wake Report as JSON only. Set realityId exactly to "${reality.id}". Every returned artefact path must be the exact safe relative path of a file retained in this Reality worktree. Do not include raw reasoning.`,
      outputSchema,
      onEvent
    );
    const report = this.parser.parse(finalResponse);
    if (report.realityId !== reality.id) {
      throw new WakeReportValidationError([{ path: "realityId", code: "identity_mismatch" }]);
    }
    const returnedEvent = CodexRuntimeEventSchema.parse({
      type: "file",
      summary: "Validated Wake Report returned to the parent Reality.",
      metadata: { stage: "file", status: "completed" }
    });
    events.push(returnedEvent);
    await onEvent?.(returnedEvent);
    return {
      threadId: this.requireThreadId(thread),
      report,
      events
    };
  }

  async synthesise(
    reality: Reality,
    reports: WakeReport[],
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>,
    repairContext?: string
  ): Promise<CodexSynthesisResult> {
    const outputSchema = zodToJsonSchema(SynthesisReportSchema, {
      target: "openAi",
      $refStrategy: "none"
    }) as Record<string, unknown>;
    const memory = JSON.stringify(reports, null, 2);
    const prompt = `${buildDreamPrompt(reality)}

RETURNED MEMORIES
${memory}

SYNTHESIS TASK
Apply the validated, generalisable memories to the waking implementation in this worktree. Preserve immutable anchors and public API semantics. Retain or strengthen every returned test artefact, run every parent-owned proof command plus the complete relevant test suite, and resolve failures caused by the implementation. Do not weaken or delete a test to make it pass.
${repairContext ? `\nREPAIR CONTEXT\n${repairContext}\nRepair the proof failure and rerun the complete suite.` : ""}
Return only the structured synthesis report after the implementation and tests are complete. Set realityId exactly to "${reality.id}", list every applied memory Reality ID, changed file, retained artefact, and unresolved risk.`;
    const { thread, events, finalResponse } = await this.streamStructured(
      reality,
      repairContext ? "Reality repair" : "Memory synthesis",
      prompt,
      outputSchema,
      onEvent
    );

    const report = parseStructuredJson<SynthesisReport>(
      finalResponse,
      "SynthesisReportSchema",
      (value) => SynthesisReportSchema.safeParse(value)
    );
    if (report.realityId !== reality.id) {
      throw new CodexOutputValidationError("SynthesisReportSchema", [{
        path: "realityId",
        code: "identity_mismatch"
      }]);
    }
    const missingMemory = reports.find((memoryReport) =>
      !report.appliedMemories.includes(memoryReport.realityId)
    );
    if (missingMemory) {
      throw new CodexOutputValidationError("SynthesisReportSchema", [{
        path: "appliedMemories",
        code: "missing_returned_memory"
      }]);
    }

    return {
      threadId: this.requireThreadId(thread),
      events,
      report,
      applied: true
    };
  }

  private threadFor(reality: Reality, forceNew = false): Thread {
    const options = codexThreadOptions(reality);
    return !forceNew && reality.codexThreadId
      ? this.codex.resumeThread(reality.codexThreadId, options)
      : this.codex.startThread(options);
  }

  private async streamStructured(
    reality: Reality,
    scope: string,
    prompt: string,
    outputSchema: Record<string, unknown>,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>,
    subjectTrace?: SubjectCollaborationTrace,
    forceNewThread = false,
    timeoutMilliseconds?: number
  ): Promise<{ thread: Thread; events: CodexRuntimeEvent[]; finalResponse: string }> {
    const thread = this.threadFor(reality, forceNewThread);
    const operationId = randomUUID();
    const controller = new AbortController();
    const timeout = timeoutMilliseconds
      ? setTimeout(() => controller.abort(), timeoutMilliseconds)
      : undefined;
    this.operations.set(operationId, {
      controller,
      realityId: reality.id,
      model: configuredCodexModel(),
      startedAt: new Date().toISOString()
    });
    const events: CodexRuntimeEvent[] = [];
    let finalResponse = "";
    let lastRuntimeFailure: string | undefined;
    const emit = async (event: CodexRuntimeEvent) => {
      events.push(event);
      await onEvent?.(event);
    };

    try {
      await emit(CodexRuntimeEventSchema.parse({
        type: "decision",
        summary: `${configuredCodexModel()} bound to ${reality.name}.`,
        metadata: {
          stage: "model",
          status: "completed",
          model: configuredCodexModel(),
          sdkVersion: CODEX_SDK_VERSION
        }
      }));
      const streamed = await thread.runStreamed(prompt, {
        outputSchema,
        signal: controller.signal
      });
      for await (const rawEvent of streamed.events) {
        const raw = rawEvent as {
          type?: string;
          item?: { type?: string; text?: unknown };
        };
        if (
          raw.type === "item.completed"
          && raw.item?.type === "agent_message"
          && typeof raw.item.text === "string"
        ) {
          finalResponse = raw.item.text;
        }
        for (const subjectEvent of subjectTrace?.observe(rawEvent) ?? []) {
          await emit(subjectEvent);
        }
        const event = toSafeCodexRuntimeEvent(rawEvent, reality.name, scope);
        if (event) {
          if (
            event.metadata?.status === "failed"
            && typeof event.metadata.detail === "string"
          ) {
            lastRuntimeFailure = event.metadata.detail;
          }
          await emit(event);
        }
      }
      return { thread, events, finalResponse };
    } catch (error) {
      throw normaliseCodexExecutionError(error, lastRuntimeFailure);
    } finally {
      if (timeout) clearTimeout(timeout);
      this.operations.delete(operationId);
    }
  }

  private requireThreadId(thread: Thread): string {
    if (!thread.id) {
      throw new Error("Codex did not return a thread identifier.");
    }
    return thread.id;
  }
}
