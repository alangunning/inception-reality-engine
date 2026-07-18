import type { Reality, WakeReport } from "@inception/domain";

export interface CodexRuntimeEvent {
  type: "progress" | "tool" | "file" | "decision";
  summary: string;
}

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
  inspect(reality: Reality): Promise<CodexExecutionResult>;
  wake(reality: Reality): Promise<CodexWakeResult>;
}
