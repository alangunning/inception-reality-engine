import { z } from "zod";
import type { Reality, WakeReport } from "@inception/domain";

export const CodexRuntimeEventMetadataSchema = z.object({
  stage: z.enum(["thread", "turn", "command", "file", "tool", "search", "plan"]).optional(),
  status: z.enum(["started", "updated", "completed", "failed"]).optional(),
  detail: z.string().min(1).max(220).optional(),
  command: z.string().min(1).max(180).optional(),
  paths: z.array(z.string().min(1).max(240)).max(5).optional(),
  tool: z.string().min(1).max(120).optional(),
  exitCode: z.number().int().optional(),
  completedItems: z.number().int().nonnegative().optional(),
  totalItems: z.number().int().nonnegative().optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  failureKind: z.enum(["test", "environment", "configuration", "missing-tool", "build", "command"]).optional(),
  diagnostic: z.string().min(1).max(180).optional()
}).strict();

export const CodexRuntimeEventSchema = z.object({
  type: z.enum(["progress", "tool", "file", "decision"]),
  summary: z.string().min(1).max(240),
  metadata: CodexRuntimeEventMetadataSchema.optional()
}).strict();

export type CodexRuntimeEvent = z.infer<typeof CodexRuntimeEventSchema>;

export interface CodexExecutionResult {
  threadId: string;
  events: CodexRuntimeEvent[];
  summary: string;
}

export interface CodexWakeResult {
  threadId: string;
  events: CodexRuntimeEvent[];
  report: WakeReport;
}

export interface CodexRuntime {
  inspect(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexExecutionResult>;
  wake(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexWakeResult>;
}

export interface WakeReportValidationIssue {
  path: string;
  code: string;
}

export class WakeReportValidationError extends Error {
  constructor(readonly issues: WakeReportValidationIssue[] = []) {
    super("Wake Report failed schema validation.");
    this.name = "WakeReportValidationError";
  }
}
