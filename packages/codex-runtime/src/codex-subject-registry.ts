import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { InvestigationReport, Reality, Subject } from "@inception/domain";
import {
  CodexOutputValidationError,
  CodexRuntimeEventSchema,
  type CodexObservedSubject,
  type CodexRuntimeEvent
} from "./types";
import { z } from "zod";

const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

const RegistryRowSchema = z.object({
  child_thread_id: z.string().min(1).max(100),
  edge_status: z.string().min(1).max(40),
  agent_path: z.string().max(100).nullable(),
  agent_nickname: z.string().max(100).nullable(),
  agent_role: z.string().max(100).nullable(),
  first_user_message: z.string(),
  rollout_path: z.string().min(1),
  cwd: z.string().min(1),
  created_at_ms: z.number().int().nonnegative()
}).strict();

type RegistryRow = z.infer<typeof RegistryRowSchema>;
type TerminalState = "running" | "completed" | "failed";

interface NativeSubjectRecord {
  identity: string;
  threadId: string;
  name: string;
  role: string;
  state: TerminalState;
}

export interface CodexSubjectRegistryOptions {
  codexHome: string;
  sqliteHome: string;
  reality: Reality;
  subjects: Subject[];
  startedAtMs?: number;
}

export class CodexSubjectRegistryTrace {
  private readonly codexHome: string;
  private readonly sqliteHome: string;
  private readonly reality: Reality;
  private readonly subjects: Map<string, Subject>;
  private readonly startedAtMs: number;
  private readonly entered = new Set<string>();
  private readonly terminal = new Set<string>();
  private handled = false;

  constructor(options: CodexSubjectRegistryOptions) {
    this.codexHome = options.codexHome;
    this.sqliteHome = options.sqliteHome;
    this.reality = options.reality;
    this.subjects = new Map(options.subjects.map((subject) => [subject.id, subject]));
    this.startedAtMs = options.startedAtMs ?? Date.now();
  }

  hasNativeEvidence(): boolean {
    return this.handled;
  }

  observe(parentThreadId: string): CodexRuntimeEvent[] {
    const records = this.records(parentThreadId);
    if (records.length) this.handled = true;
    const events: CodexRuntimeEvent[] = [];
    for (const record of records) {
      if (!this.entered.has(record.threadId)) {
        this.entered.add(record.threadId);
        events.push(CodexRuntimeEventSchema.parse({
          type: "subject",
          summary: `Subject entered native Codex thread: ${record.name}.`,
          metadata: {
            stage: "subject",
            status: "completed",
            subjectId: record.identity,
            subjectName: record.name,
            subjectRole: record.role,
            subjectThreadId: record.threadId,
            subjectState: "started",
            collaborationTool: "thread_registry"
          }
        }));
      }
      if (record.state === "running" || this.terminal.has(record.threadId)) continue;
      this.terminal.add(record.threadId);
      const failed = record.state === "failed";
      events.push(CodexRuntimeEventSchema.parse({
        type: "subject",
        summary: failed
          ? `Subject investigation failed: ${record.name}.`
          : `Subject completed bounded investigation: ${record.name}.`,
        metadata: {
          stage: "subject",
          status: failed ? "failed" : "completed",
          subjectId: record.identity,
          subjectName: record.name,
          subjectRole: record.role,
          subjectThreadId: record.threadId,
          subjectState: failed ? "failed" : "completed",
          collaborationTool: "thread_registry"
        }
      }));
    }
    return events;
  }

  bindReports(
    parentThreadId: string,
    reports: InvestigationReport["subjectReports"]
  ): CodexObservedSubject[] {
    const records = this.records(parentThreadId);
    if (records.length) this.handled = true;
    if (!this.handled) return [];

    for (const record of records) {
      if (record.state !== "completed") {
        throw new CodexOutputValidationError("InvestigationReportSchema", [{
          path: `subjectReports.${record.identity}`,
          code: "missing_codex_return_evidence"
        }]);
      }
    }

    const unexpected = reports.find((report) =>
      !records.some((record) => record.identity === report.subjectId)
    );
    const missing = records.find((record) =>
      !reports.some((report) => report.subjectId === record.identity)
    );
    if (unexpected || missing || reports.length !== records.length) {
      throw new CodexOutputValidationError("InvestigationReportSchema", [{
        path: "subjectReports",
        code: "subject_native_trace_mismatch"
      }]);
    }

    return reports.map((report) => {
      const record = records.find((entry) => entry.identity === report.subjectId)!;
      return {
        id: report.subjectId,
        name: report.name,
        role: report.role,
        mission: "Bounded independent investigation selected by Codex.",
        threadId: record.threadId
      };
    });
  }

  requireSubject(parentThreadId: string, subjectId: string): string | undefined {
    const records = this.records(parentThreadId);
    if (records.length) this.handled = true;
    const record = records.find((entry) => entry.identity === subjectId);
    if (!record) return undefined;
    if (record.state !== "completed") {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: `subjectReports.${subjectId}`,
        code: "missing_codex_return_evidence"
      }]);
    }
    return record.threadId;
  }

  private records(parentThreadId: string): NativeSubjectRecord[] {
    const databasePath = this.stateDatabasePath();
    if (!databasePath || !this.reality.worktreePath) return [];

    let database: DatabaseSyncType | undefined;
    try {
      database = new DatabaseSync(databasePath, { readOnly: true });
      const rows = database.prepare(`
        SELECT
          e.child_thread_id,
          e.status AS edge_status,
          t.agent_path,
          t.agent_nickname,
          t.agent_role,
          t.first_user_message,
          t.rollout_path,
          t.cwd,
          t.created_at_ms
        FROM thread_spawn_edges e
        JOIN threads t ON t.id = e.child_thread_id
        WHERE e.parent_thread_id = ?
          AND t.cwd = ?
          AND t.created_at_ms >= ?
        ORDER BY t.created_at_ms, t.id
      `).all(
        parentThreadId,
        this.reality.worktreePath,
        Math.max(0, this.startedAtMs - 2_000)
      );
      return rows
        .map((row) => RegistryRowSchema.safeParse(row))
        .filter((result): result is { success: true; data: RegistryRow } => result.success)
        .map(({ data }) => this.toRecord(data));
    } catch {
      return [];
    } finally {
      database?.close();
    }
  }

  private toRecord(row: RegistryRow): NativeSubjectRecord {
    const charterId = row.first_user_message.match(/\bSUBJECT_ID:([A-Za-z0-9_-]+)\b/)?.[1];
    const charter = charterId ? this.subjects.get(charterId) : undefined;
    const identity = charter?.id
      ?? row.agent_path?.trim()
      ?? row.child_thread_id;
    return {
      identity,
      threadId: row.child_thread_id,
      name: charter?.name
        ?? identity.split("/").filter(Boolean).at(-1)
        ?? row.agent_nickname?.trim()
        ?? "Codex Subject",
      role: charter?.role
        ?? row.agent_role?.trim()
        ?? "Independent investigator",
      state: this.terminalState(row.rollout_path)
    };
  }

  private terminalState(rolloutPath: string): TerminalState {
    const safePath = this.safeRolloutPath(rolloutPath);
    if (!safePath) return "running";
    try {
      let failed = false;
      for (const line of fs.readFileSync(
        /* turbopackIgnore: true */ safePath,
        "utf8"
      ).split(/\n/)) {
        if (!line.trim()) continue;
        let event: { type?: unknown; payload?: { type?: unknown } };
        try {
          event = JSON.parse(line) as typeof event;
        } catch {
          continue;
        }
        if (event.type !== "event_msg") continue;
        if (event.payload?.type === "task_complete") return "completed";
        if (event.payload?.type === "turn_aborted" || event.payload?.type === "stream_error") {
          failed = true;
        }
      }
      return failed ? "failed" : "running";
    } catch {
      return "running";
    }
  }

  private safeRolloutPath(rolloutPath: string): string | null {
    let candidate: string;
    try {
      candidate = fs.realpathSync(/* turbopackIgnore: true */ rolloutPath);
    } catch {
      return null;
    }
    const roots = [
      path.join(this.codexHome, "sessions"),
      path.join(this.sqliteHome, "sessions")
    ].flatMap((root) => {
      try {
        return [fs.realpathSync(/* turbopackIgnore: true */ root)];
      } catch {
        return [];
      }
    });
    return roots.some((root) => candidate.startsWith(`${root}${path.sep}`))
      ? candidate
      : null;
  }

  private stateDatabasePath(): string | null {
    for (const candidate of [
      path.join(this.sqliteHome, "state_5.sqlite"),
      path.join(this.sqliteHome, "sqlite", "state_5.sqlite")
    ]) {
      if (fs.existsSync(/* turbopackIgnore: true */ candidate)) return candidate;
    }
    return null;
  }
}
