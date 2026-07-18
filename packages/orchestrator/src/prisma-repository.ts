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

type RecordShape = Record<string, any>;
type PrismaDelegate = {
  upsert(args: RecordShape): Promise<RecordShape>;
  findUnique(args: RecordShape): Promise<RecordShape | null>;
  findMany(args?: RecordShape): Promise<RecordShape[]>;
  create(args: RecordShape): Promise<RecordShape>;
  deleteMany(args?: RecordShape): Promise<RecordShape>;
};

/**
 * Structural surface used so the repository remains buildable before `prisma generate`.
 * A generated PrismaClient satisfies this contract at runtime.
 */
export interface InceptionPrismaClient {
  realityRecord: PrismaDelegate;
  realityEventRecord: PrismaDelegate;
  demoSessionRecord: PrismaDelegate;
  realityRunArchiveRecord: PrismaDelegate;
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  $disconnect?(): Promise<void>;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function toReality(record: RecordShape): Reality {
  return RealitySchema.parse({
    id: record.id,
    parentId: record.parentId ?? null,
    depth: record.depth,
    kind: record.kind,
    name: record.name,
    status: record.status,
    premise: record.premise,
    constitution: parseJson(record.constitutionJson),
    worldState: parseJson(record.worldStateJson),
    subjects: parseJson(record.subjectsJson),
    beliefs: parseJson(record.beliefsJson),
    evidence: parseJson(record.evidenceJson),
    proposals: parseJson(record.proposalsJson),
    anchors: parseJson(record.anchorsJson),
    wakeReport: record.wakeReportJson ? parseJson(record.wakeReportJson) : undefined,
    codexThreadId: record.codexThreadId ?? undefined,
    worktreePath: record.worktreePath ?? undefined,
    branchName: record.branchName ?? undefined,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString()
  });
}

function toEvent(record: RecordShape): RealityEvent {
  return RealityEventSchema.parse({
    id: record.id,
    realityId: record.realityId,
    type: record.type,
    summary: record.summary,
    dreamTime: record.dreamTime,
    payload: parseJson(record.payloadJson),
    occurredAt: new Date(record.occurredAt).toISOString()
  });
}

function toSession(record: RecordShape): DemoSession {
  return DemoSessionSchema.parse({
    id: record.id,
    phase: record.phase,
    activeRealityId: record.activeRealityId ?? null,
    finalDiff: record.finalDiff,
    anchorResults: parseJson(record.anchorResultsJson),
    regressionResult: record.regressionResultJson ? parseJson(record.regressionResultJson) : undefined,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString()
  });
}

export class PrismaRealityRepository implements RealityRepository {
  constructor(private readonly prisma: InceptionPrismaClient) {}

  async saveReality(reality: Reality): Promise<void> {
    const data = {
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
      createdAt: new Date(reality.createdAt),
      updatedAt: new Date(reality.updatedAt)
    };
    await this.prisma.realityRecord.upsert({
      where: { id: reality.id },
      create: { id: reality.id, ...data },
      update: data
    });
  }

  async getReality(id: string): Promise<Reality | null> {
    const record = await this.prisma.realityRecord.findUnique({ where: { id } });
    return record ? toReality(record) : null;
  }

  async listRealities(): Promise<Reality[]> {
    const records = await this.prisma.realityRecord.findMany({ orderBy: [{ depth: "asc" }, { createdAt: "asc" }] });
    return records.map(toReality);
  }

  async appendEvent(event: RealityEvent): Promise<void> {
    await this.prisma.realityEventRecord.create({
      data: {
        id: event.id,
        realityId: event.realityId,
        type: event.type,
        summary: event.summary,
        dreamTime: event.dreamTime,
        payloadJson: JSON.stringify(event.payload),
        occurredAt: new Date(event.occurredAt)
      }
    });
  }

  async listEvents(limit = 80): Promise<RealityEvent[]> {
    const records = await this.prisma.realityEventRecord.findMany({
      orderBy: { occurredAt: "desc" },
      take: limit
    });
    return records.reverse().map(toEvent);
  }

  async saveSession(session: DemoSession): Promise<void> {
    const data = {
      phase: session.phase,
      activeRealityId: session.activeRealityId ?? null,
      finalDiff: session.finalDiff,
      anchorResultsJson: JSON.stringify(session.anchorResults),
      regressionResultJson: session.regressionResult ? JSON.stringify(session.regressionResult) : null,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt)
    };
    await this.prisma.demoSessionRecord.upsert({
      where: { id: session.id },
      create: { id: session.id, ...data },
      update: data
    });
  }

  async getSession(): Promise<DemoSession | null> {
    const record = await this.prisma.demoSessionRecord.findUnique({ where: { id: "singleton" } });
    return record ? toSession(record) : null;
  }

  async saveRunArchive(archive: RealityRunArchive): Promise<void> {
    const validated = RealityRunArchiveSchema.parse(archive);
    await this.prisma.realityRunArchiveRecord.upsert({
      where: { id: validated.id },
      create: {
        id: validated.id,
        snapshotJson: JSON.stringify(validated),
        archivedAt: new Date(validated.archivedAt)
      },
      update: {
        snapshotJson: JSON.stringify(validated),
        archivedAt: new Date(validated.archivedAt)
      }
    });
  }

  async listRunArchives(limit = 20): Promise<RealityRunArchive[]> {
    const records = await this.prisma.realityRunArchiveRecord.findMany({
      orderBy: { archivedAt: "desc" },
      take: limit
    });
    return records.map((record) => RealityRunArchiveSchema.parse(parseJson(record.snapshotJson)));
  }

  async getRunArchive(id: string): Promise<RealityRunArchive | null> {
    const record = await this.prisma.realityRunArchiveRecord.findUnique({ where: { id } });
    return record
      ? RealityRunArchiveSchema.parse(parseJson(record.snapshotJson))
      : null;
  }

  async deleteAll(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.realityEventRecord.deleteMany(),
      this.prisma.realityRecord.deleteMany(),
      this.prisma.demoSessionRecord.deleteMany()
    ]);
  }
}
