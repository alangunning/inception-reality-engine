import { Codex } from "@openai/codex-sdk";
import { WakeReportSchema, buildDreamPrompt, type Reality } from "@inception/domain";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { CodexExecutionResult, CodexRuntime, CodexRuntimeEvent, CodexWakeResult } from "./types";
import { WakeReportParser } from "./wake-report-parser";

interface ThreadLike {
  id: string;
  run(prompt: string, options?: Record<string, unknown>): Promise<{ finalResponse: string }>;
  runStreamed(prompt: string): Promise<{ events: AsyncIterable<unknown> }>;
}

export class RealCodexRuntime implements CodexRuntime {
  private readonly codex: Codex;
  private readonly parser = new WakeReportParser();

  constructor() {
    this.codex = new Codex({
      config: {
        show_raw_agent_reasoning: false
      }
    });
  }

  async inspect(reality: Reality): Promise<CodexExecutionResult> {
    const thread = this.threadFor(reality);
    const prompt = `${buildDreamPrompt(reality)}\n\nTASK\nInspect and improve the password-reset feature. Report only concise evidence, artefacts, decisions, and uncertainties. Use Subjects only for bounded independent investigation.`;
    const streamed = await thread.runStreamed(prompt);
    const events: CodexRuntimeEvent[] = [];

    for await (const rawEvent of streamed.events) {
      const event = this.toSafeEvent(rawEvent);
      if (event) events.push(event);
    }

    return {
      threadId: thread.id,
      events,
      summary: events.at(-1)?.summary ?? "Codex inspection completed inside the Reality worktree."
    };
  }

  async wake(reality: Reality): Promise<CodexWakeResult> {
    const thread = this.threadFor(reality);
    const outputSchema = zodToJsonSchema(WakeReportSchema, {
      target: "openAi",
      $refStrategy: "none"
    }) as Record<string, unknown>;
    const result = await thread.run(
      `${buildDreamPrompt(reality)}\n\nKICK\nStop exploring now. Return the Wake Report as JSON only. Do not include raw reasoning.`,
      { outputSchema }
    );
    const report = this.parser.parse(result.finalResponse);
    return {
      threadId: thread.id,
      report,
      events: [
        { type: "decision", summary: "Kick accepted." },
        { type: "file", summary: "Validated memory returned to the parent Reality." }
      ]
    };
  }

  private threadFor(reality: Reality): ThreadLike {
    if (!reality.worktreePath) {
      throw new Error(`Reality ${reality.id} has no worktree.`);
    }
    const thread = reality.codexThreadId
      ? this.codex.resumeThread(reality.codexThreadId)
      : this.codex.startThread({ workingDirectory: reality.worktreePath });
    return thread as unknown as ThreadLike;
  }

  private toSafeEvent(rawEvent: unknown): CodexRuntimeEvent | null {
    if (!rawEvent || typeof rawEvent !== "object") return null;
    const event = rawEvent as { type?: string; item?: { type?: string; path?: string } };
    if (event.type === "item.completed" && event.item?.type === "file_change") {
      return { type: "file", summary: `Codex changed ${event.item.path ?? "a file"}.` };
    }
    if (event.type === "turn.completed") {
      return { type: "progress", summary: "Codex turn completed." };
    }
    if (event.type === "item.started") {
      return { type: "tool", summary: "Codex began a bounded operation." };
    }
    return null;
  }
}
