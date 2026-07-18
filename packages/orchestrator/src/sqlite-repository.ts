import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import {
  DemoSessionSchema,
  RealityEventSchema,
  RealityRunArchiveSchema,
  RealitySchema,
  type DemoSession,
  type Reality,
  type RealityEvent,
  type RealityRunArchive
} from "@inception/domain";
import type { RealityRepository } from "./ports";

type Row = Record<string, unknown>;
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

function parseJson<T>(value: unknown): T {
  return JSON.parse(String(value)) as T;
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

export class SqliteRealityRepository implements RealityRepository {
  private readonly db: DatabaseSyncType;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS RealityRecord (
        id TEXT PRIMARY KEY,
        parentId TEXT,
        depth INTEGER NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        premise TEXT NOT NULL,
        constitutionJson TEXT NOT NULL,
        worldStateJson TEXT NOT NULL,
        subjectsJson TEXT NOT NULL,
        beliefsJson TEXT NOT NULL,
        evidenceJson TEXT NOT NULL,
        proposalsJson TEXT NOT NULL,
        anchorsJson TEXT NOT NULL,
        wakeReportJson TEXT,
        codexThreadId TEXT,
        worktreePath TEXT,
        branchName TEXT,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      );
      CREATE INDEX IF NOT EXISTS RealityRecord_parentId_idx ON RealityRecord(parentId);
      CREATE INDEX IF NOT EXISTS RealityRecord_depth_idx ON RealityRecord(depth);

      CREATE TABLE IF NOT EXISTS RealityEventRecord (
        id TEXT PRIMARY KEY,
        realityId TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        dreamTime INTEGER NOT NULL,
        payloadJson TEXT NOT NULL,
        occurredAt DATETIME NOT NULL
      );
      CREATE INDEX IF NOT EXISTS RealityEventRecord_realityId_idx ON RealityEventRecord(realityId);
      CREATE INDEX IF NOT EXISTS RealityEventRecord_occurredAt_idx ON RealityEventRecord(occurredAt);

      CREATE TABLE IF NOT EXISTS DemoSessionRecord (
        id TEXT PRIMARY KEY,
        phase INTEGER NOT NULL,
        activeRealityId TEXT,
        finalDiff TEXT NOT NULL,
        anchorResultsJson TEXT NOT NULL,
        regressionResultJson TEXT,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      );

      CREATE TABLE IF NOT EXISTS RealityRunArchiveRecord (
        id TEXT PRIMARY KEY,
        snapshotJson TEXT NOT NULL,
        archivedAt DATETIME NOT NULL
      );
      CREATE INDEX IF NOT EXISTS RealityRunArchiveRecord_archivedAt_idx
        ON RealityRunArchiveRecord(archivedAt);
    `);
    const sessionColumns = this.db.prepare("PRAGMA table_info(DemoSessionRecord)").all() as Array<{ name: string }>;
    if (!sessionColumns.some((column) => column.name === "regressionResultJson")) {
      this.db.exec("ALTER TABLE DemoSessionRecord ADD COLUMN regressionResultJson TEXT;");
    }
  }

  async saveReality(reality: Reality): Promise<void> {
    this.db.prepare(`
      INSERT INTO RealityRecord (
        id, parentId, depth, kind, name, status, premise, constitutionJson,
        worldStateJson, subjectsJson, beliefsJson, evidenceJson, proposalsJson,
        anchorsJson, wakeReportJson, codexThreadId, worktreePath, branchName,
        createdAt, updatedAt
      ) VALUES (
        @id, @parentId, @depth, @kind, @name, @status, @premise, @constitutionJson,
        @worldStateJson, @subjectsJson, @beliefsJson, @evidenceJson, @proposalsJson,
        @anchorsJson, @wakeReportJson, @codexThreadId, @worktreePath, @branchName,
        @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        parentId=excluded.parentId,
        depth=excluded.depth,
        kind=excluded.kind,
        name=excluded.name,
        status=excluded.status,
        premise=excluded.premise,
        constitutionJson=excluded.constitutionJson,
        worldStateJson=excluded.worldStateJson,
        subjectsJson=excluded.subjectsJson,
        beliefsJson=excluded.beliefsJson,
        evidenceJson=excluded.evidenceJson,
        proposalsJson=excluded.proposalsJson,
        anchorsJson=excluded.anchorsJson,
        wakeReportJson=excluded.wakeReportJson,
        codexThreadId=excluded.codexThreadId,
        worktreePath=excluded.worktreePath,
        branchName=excluded.branchName,
        createdAt=excluded.createdAt,
        updatedAt=excluded.updatedAt
    `).run({
      id: reality.id,
      parentId: reality.parentId ?? null,
      depth: reality.depth,
      kind: reality.kind,
      name: reality.name,
      status: reality.status,
      premise: reality.premise,
      constitutionJson: JSON.stringify(reality.constitution),
      worldStateJson: JSON.stringify(reality.worldState),
      subjectsJson: JSON.stringify(reality.subjects),
      beliefsJson: JSON.stringify(reality.beliefs),
      evidenceJson: JSON.stringify(reality.evidence),
      proposalsJson: JSON.stringify(reality.proposals),
      anchorsJson: JSON.stringify(reality.anchors),
      wakeReportJson: reality.wakeReport ? JSON.stringify(reality.wakeReport) : null,
      codexThreadId: reality.codexThreadId ?? null,
      worktreePath: reality.worktreePath ?? null,
      branchName: reality.branchName ?? null,
      createdAt: reality.createdAt,
      updatedAt: reality.updatedAt
    });
  }

  async getReality(id: string): Promise<Reality | null> {
    const row = this.db.prepare("SELECT * FROM RealityRecord WHERE id = ?").get(id) as Row | undefined;
    return row ? this.toReality(row) : null;
  }

  async listRealities(): Promise<Reality[]> {
    const rows = this.db.prepare("SELECT * FROM RealityRecord ORDER BY depth ASC, createdAt ASC").all() as Row[];
    return rows.map((row) => this.toReality(row));
  }

  async appendEvent(event: RealityEvent): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO RealityEventRecord
      (id, realityId, type, summary, dreamTime, payloadJson, occurredAt)
      VALUES (@id, @realityId, @type, @summary, @dreamTime, @payloadJson, @occurredAt)
    `).run({
      id: event.id,
      realityId: event.realityId,
      type: event.type,
      summary: event.summary,
      dreamTime: event.dreamTime,
      payloadJson: JSON.stringify(event.payload),
      occurredAt: event.occurredAt
    });
  }

  async listEvents(limit = 80): Promise<RealityEvent[]> {
    const rows = this.db.prepare(
      "SELECT * FROM RealityEventRecord ORDER BY occurredAt DESC LIMIT ?"
    ).all(limit) as Row[];
    return rows.reverse().map((row) => RealityEventSchema.parse({
      id: row.id,
      realityId: row.realityId,
      type: row.type,
      summary: row.summary,
      dreamTime: row.dreamTime,
      payload: parseJson(row.payloadJson),
      occurredAt: iso(row.occurredAt)
    }));
  }

  async saveSession(session: DemoSession): Promise<void> {
    this.db.prepare(`
      INSERT INTO DemoSessionRecord
      (id, phase, activeRealityId, finalDiff, anchorResultsJson, regressionResultJson, createdAt, updatedAt)
      VALUES (@id, @phase, @activeRealityId, @finalDiff, @anchorResultsJson, @regressionResultJson, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        phase=excluded.phase,
        activeRealityId=excluded.activeRealityId,
        finalDiff=excluded.finalDiff,
        anchorResultsJson=excluded.anchorResultsJson,
        regressionResultJson=excluded.regressionResultJson,
        createdAt=excluded.createdAt,
        updatedAt=excluded.updatedAt
    `).run({
      id: session.id,
      phase: session.phase,
      activeRealityId: session.activeRealityId ?? null,
      finalDiff: session.finalDiff,
      anchorResultsJson: JSON.stringify(session.anchorResults),
      regressionResultJson: session.regressionResult ? JSON.stringify(session.regressionResult) : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });
  }

  async getSession(): Promise<DemoSession | null> {
    const row = this.db.prepare("SELECT * FROM DemoSessionRecord WHERE id = 'singleton'").get() as Row | undefined;
    return row ? DemoSessionSchema.parse({
      id: row.id,
      phase: row.phase,
      activeRealityId: row.activeRealityId ?? null,
      finalDiff: row.finalDiff,
      anchorResults: parseJson(row.anchorResultsJson),
      regressionResult: row.regressionResultJson ? parseJson(row.regressionResultJson) : undefined,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    }) : null;
  }

  async saveRunArchive(archive: RealityRunArchive): Promise<void> {
    const validated = RealityRunArchiveSchema.parse(archive);
    this.db.prepare(`
      INSERT INTO RealityRunArchiveRecord (id, snapshotJson, archivedAt)
      VALUES (@id, @snapshotJson, @archivedAt)
      ON CONFLICT(id) DO UPDATE SET
        snapshotJson=excluded.snapshotJson,
        archivedAt=excluded.archivedAt
    `).run({
      id: validated.id,
      snapshotJson: JSON.stringify(validated),
      archivedAt: validated.archivedAt
    });
  }

  async listRunArchives(limit = 20): Promise<RealityRunArchive[]> {
    const rows = this.db.prepare(
      "SELECT snapshotJson FROM RealityRunArchiveRecord ORDER BY archivedAt DESC LIMIT ?"
    ).all(limit) as Row[];
    return rows.map((row) => RealityRunArchiveSchema.parse(parseJson(row.snapshotJson)));
  }

  async getRunArchive(id: string): Promise<RealityRunArchive | null> {
    const row = this.db.prepare(
      "SELECT snapshotJson FROM RealityRunArchiveRecord WHERE id = ?"
    ).get(id) as Row | undefined;
    return row
      ? RealityRunArchiveSchema.parse(parseJson(row.snapshotJson))
      : null;
  }

  async deleteAll(): Promise<void> {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM RealityEventRecord").run();
      this.db.prepare("DELETE FROM RealityRecord").run();
      this.db.prepare("DELETE FROM DemoSessionRecord").run();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  private toReality(row: Row): Reality {
    return RealitySchema.parse({
      id: row.id,
      parentId: row.parentId ?? null,
      depth: row.depth,
      kind: row.kind,
      name: row.name,
      status: row.status,
      premise: row.premise,
      constitution: parseJson(row.constitutionJson),
      worldState: parseJson(row.worldStateJson),
      subjects: parseJson(row.subjectsJson),
      beliefs: parseJson(row.beliefsJson),
      evidence: parseJson(row.evidenceJson),
      proposals: parseJson(row.proposalsJson),
      anchors: parseJson(row.anchorsJson),
      wakeReport: row.wakeReportJson ? parseJson(row.wakeReportJson) : undefined,
      codexThreadId: row.codexThreadId ?? undefined,
      worktreePath: row.worktreePath ?? undefined,
      branchName: row.branchName ?? undefined,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    });
  }
}
