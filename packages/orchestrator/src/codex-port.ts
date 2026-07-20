import { z } from "zod";
import type {
  AdversarialInterventionReport,
  InvestigationReport,
  MissionInterventionContract,
  Reality,
  SynthesisReport,
  Subject,
  WakeReport
} from "@inception/domain";

export const CodexRuntimeEventMetadataSchema = z.object({
  stage: z.enum(["thread", "turn", "command", "file", "tool", "search", "plan", "subject", "model"]).optional(),
  status: z.enum(["started", "updated", "completed", "failed"]).optional(),
  detail: z.string().min(1).max(220).optional(),
  command: z.string().min(1).max(180).optional(),
  paths: z.array(z.string().min(1).max(240)).max(5).optional(),
  tool: z.string().min(1).max(120).optional(),
  exitCode: z.number().int().optional(),
  completedItems: z.number().int().nonnegative().optional(),
  totalItems: z.number().int().nonnegative().optional(),
  planSteps: z.array(z.object({
    text: z.string().min(1).max(160),
    status: z.enum(["pending", "completed"])
  }).strict()).max(20).optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  failureKind: z.enum([
    "test",
    "test-harness",
    "environment",
    "configuration",
    "missing-tool",
    "build",
    "command"
  ]).optional(),
  diagnostic: z.string().min(1).max(180).optional(),
  model: z.string().min(1).max(80).optional(),
  sdkVersion: z.string().min(1).max(40).optional(),
  authSource: z.enum(["cli", "api-key", "none"]).optional(),
  threadId: z.string().min(1).max(100).optional(),
  subjectId: z.string().min(1).max(100).optional(),
  subjectName: z.string().min(1).max(100).optional(),
  subjectRole: z.string().min(1).max(100).optional(),
  subjectThreadId: z.string().min(1).max(100).optional(),
  subjectState: z.enum(["started", "completed", "failed"]).optional(),
  collaborationTool: z.enum(["spawn_agent", "wait", "close_agent", "thread_registry"]).optional()
}).strict().superRefine((metadata, context) => {
  if (
    metadata.stage === "subject"
    && metadata.subjectState
    && metadata.status !== metadata.subjectState
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "Subject event status must match its lifecycle state."
    });
  }
});

export const CodexRuntimeEventSchema = z.object({
  type: z.enum(["progress", "tool", "file", "decision", "subject"]),
  summary: z.string().min(1).max(240),
  metadata: CodexRuntimeEventMetadataSchema.optional()
}).strict();

export type CodexRuntimeEvent = z.infer<typeof CodexRuntimeEventSchema>;

export interface CodexRuntimeInfo {
  mode: "mock" | "real";
  model: string;
  sdkVersion: string;
  authSource?: "cli" | "api-key" | "none";
}

export interface CodexActiveOperation {
  id: string;
  realityId: string;
  model: string;
  startedAt: string;
}

export interface CodexExecutionResult {
  threadId: string;
  events: CodexRuntimeEvent[];
  summary: string;
  report: InvestigationReport;
  observedSubjects?: CodexObservedSubject[];
}

export interface CodexObservedSubject {
  id: string;
  name: string;
  role: string;
  mission: string;
  threadId: string;
}

export interface CodexWakeResult {
  threadId: string;
  events: CodexRuntimeEvent[];
  report: WakeReport;
}

export interface CodexInterventionResult {
  coordinatorThreadId: string;
  subjectThreadId: string;
  events: CodexRuntimeEvent[];
  report: AdversarialInterventionReport;
}

export interface CodexSynthesisResult {
  threadId: string;
  events: CodexRuntimeEvent[];
  report: SynthesisReport;
  applied: boolean;
}

export interface CodexRuntime {
  readonly mode: CodexRuntimeInfo["mode"];
  info(): CodexRuntimeInfo;
  activeOperations(): CodexActiveOperation[];
  abortAll(): number;
  inspect(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexExecutionResult>;
  intervene(
    reality: Reality,
    contract: MissionInterventionContract,
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>
  ): Promise<CodexInterventionResult>;
  wake(reality: Reality, onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>): Promise<CodexWakeResult>;
  synthesise(
    reality: Reality,
    reports: WakeReport[],
    onEvent?: (event: CodexRuntimeEvent) => void | Promise<void>,
    repairContext?: string
  ): Promise<CodexSynthesisResult>;
}

export interface SubjectCollaborationEvidence {
  subject: Pick<Subject, "id" | "name" | "role">;
  threadId: string;
  returned: boolean;
}

export interface WakeReportValidationIssue {
  path: string;
  code: string;
}

export class CodexOutputValidationError extends Error {
  constructor(
    readonly contract:
      | "InvestigationReportSchema"
      | "AdversarialInterventionReportSchema"
      | "WakeReportSchema"
      | "SynthesisReportSchema"
      | "CodexCommandPolicy",
    readonly issues: WakeReportValidationIssue[] = []
  ) {
    const first = issues[0];
    super(first
      ? `${contract} rejected ${first.path || "output"} (${first.code}).`
      : `${contract} failed schema validation.`);
    this.name = "CodexOutputValidationError";
  }
}

export class WakeReportValidationError extends CodexOutputValidationError {
  constructor(issues: WakeReportValidationIssue[] = []) {
    super("WakeReportSchema", issues);
    this.name = "WakeReportValidationError";
  }
}
