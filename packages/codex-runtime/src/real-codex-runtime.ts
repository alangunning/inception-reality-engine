import { Codex, type Thread, type ThreadOptions } from "@openai/codex-sdk";
import { WakeReportSchema, buildDreamPrompt, type Reality } from "@inception/domain";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CodexRuntimeEventSchema,
  type CodexExecutionResult,
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexWakeResult
} from "./types";
import { WakeReportParser, WakeReportValidationError } from "./wake-report-parser";

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

export function buildSubjectOrchestrationPrompt(reality: Reality): string {
  const activeSubjects = reality.subjects.filter((subject) =>
    subject.status === "entered" || subject.status === "investigating"
  );
  if (!activeSubjects.length) {
    return `SUBJECT ORCHESTRATION
Delegate only when you identify at least two bounded, independent investigations that can run concurrently. When that condition is met, use Codex subagent collaboration tools, wait for every Subject to return, and incorporate only concise findings and evidence. Keep sequential or tightly coupled work in this thread.`;
  }

  const charters = activeSubjects
    .map((subject) => `- ${subject.name} (${subject.role}): ${subject.mission}`)
    .join("\n");
  return `SUBJECT ORCHESTRATION
Use Codex subagent collaboration tools to spawn one direct subagent for each Subject below. Run them in parallel when capacity allows, keep every investigation bounded to its charter, and wait for every Subject to return before synthesis.
${charters}
Subjects inherit this Reality's worktree, constitution, and immutable anchors. They must return concise evidence and artefacts only, and must not spawn further subagents.`;
}

export function toSafeCodexRuntimeEvent(rawEvent: unknown, realityName: string, scope: string): CodexRuntimeEvent | null {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const event = rawEvent as {
    type?: string;
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
      items?: Array<{ completed?: unknown }>;
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
      metadata: { stage: "thread", status: "started" }
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
    return CodexRuntimeEventSchema.parse({
      type: "progress",
      summary: `Plan updated: ${completedItems} of ${totalItems} steps complete.`,
      metadata: {
        stage: "plan",
        status,
        completedItems,
        totalItems
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
  private readonly codex: Codex;
  private readonly parser = new WakeReportParser();

  constructor() {
    const apiKey = process.env.CODEX_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
    this.codex = new Codex({
      apiKey: apiKey || undefined,
      env: Object.fromEntries(
        Object.entries(process.env)
          .filter(([key, value]) => key !== "NODE_ENV" && value !== undefined)
      ) as Record<string, string>,
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

  async inspect(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexExecutionResult> {
    const thread = this.threadFor(reality);
    const scope = reality.constitution.scope ?? reality.name;
    const operationLabel = `${scope} audit`;
    const prompt = `${buildDreamPrompt(reality)}

${buildSubjectOrchestrationPrompt(reality)}

TASK
Audit and improve ${scope}. Report only concise evidence, artefacts, decisions, and uncertainties.`;
    const streamed = await thread.runStreamed(prompt);
    const events: CodexRuntimeEvent[] = [];

    for await (const rawEvent of streamed.events) {
      const event = toSafeCodexRuntimeEvent(rawEvent, reality.name, operationLabel);
      if (event) {
        events.push(event);
        await onEvent?.(event);
      }
    }

    return {
      threadId: this.requireThreadId(thread),
      events,
      summary: events.at(-1)?.summary ?? "Codex inspection completed inside the Reality worktree."
    };
  }

  async wake(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexWakeResult> {
    const thread = this.threadFor(reality);
    const outputSchema = zodToJsonSchema(WakeReportSchema, {
      target: "openAi",
      $refStrategy: "none"
    }) as Record<string, unknown>;
    const streamed = await thread.runStreamed(
      `${buildDreamPrompt(reality)}\n\nKICK\nStop exploring now. Return the Wake Report as JSON only. Do not include raw reasoning.`,
      { outputSchema }
    );
    const events: CodexRuntimeEvent[] = [];
    let finalResponse = "";
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
      const event = toSafeCodexRuntimeEvent(rawEvent, reality.name, "Wake Report generation");
      if (event) {
        events.push(event);
        await onEvent?.(event);
      }
    }
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

  private threadFor(reality: Reality): Thread {
    if (!reality.worktreePath) {
      throw new Error(`Reality ${reality.id} has no worktree.`);
    }
    const options = {
      workingDirectory: reality.worktreePath,
      sandboxMode: "danger-full-access",
      approvalPolicy: "never",
      networkAccessEnabled: true,
      webSearchMode: "live"
    } satisfies ThreadOptions;
    return reality.codexThreadId
      ? this.codex.resumeThread(reality.codexThreadId, options)
      : this.codex.startThread(options);
  }

  private requireThreadId(thread: Thread): string {
    if (!thread.id) {
      throw new Error("Codex did not return a thread identifier.");
    }
    return thread.id;
  }
}
