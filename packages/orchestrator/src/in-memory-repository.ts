import type {
  DemoSession,
  MissionRun,
  Reality,
  RealityEvent,
  RealityRunArchive
} from "@inception/domain";
import type { RealityRepository } from "./ports";

export class InMemoryRealityRepository implements RealityRepository {
  private realities = new Map<string, Reality>();
  private events: RealityEvent[] = [];
  private session: DemoSession | null = null;
  private archives: RealityRunArchive[] = [];
  private missionRuns = new Map<string, MissionRun>();
  private missionEvents = new Map<string, RealityEvent[]>();

  async saveReality(reality: Reality): Promise<void> {
    this.realities.set(reality.id, structuredClone(reality));
  }
  async getReality(id: string): Promise<Reality | null> {
    return structuredClone(this.realities.get(id) ?? null);
  }
  async listRealities(): Promise<Reality[]> {
    return [...this.realities.values()].sort((a, b) => a.depth - b.depth || a.createdAt.localeCompare(b.createdAt)).map((item) => structuredClone(item));
  }
  async appendEvent(event: RealityEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
  async listEvents(limit = 80): Promise<RealityEvent[]> {
    return this.events.slice(-limit).map((item) => structuredClone(item));
  }
  async saveSession(session: DemoSession): Promise<void> {
    this.session = structuredClone(session);
  }
  async getSession(): Promise<DemoSession | null> {
    return structuredClone(this.session);
  }
  async saveRunArchive(archive: RealityRunArchive): Promise<void> {
    this.archives = [
      ...this.archives.filter((entry) => entry.id !== archive.id),
      structuredClone(archive)
    ];
  }
  async listRunArchives(limit = 20): Promise<RealityRunArchive[]> {
    return this.archives.slice(-limit).reverse().map((item) => structuredClone(item));
  }
  async getRunArchive(id: string): Promise<RealityRunArchive | null> {
    return structuredClone(this.archives.find((entry) => entry.id === id) ?? null);
  }
  async saveMissionRun(run: MissionRun): Promise<void> {
    this.missionRuns.set(run.id, structuredClone(run));
  }
  async getMissionRun(id: string): Promise<MissionRun | null> {
    const run = structuredClone(this.missionRuns.get(id) ?? null);
    if (!run) return null;
    const events = this.missionEvents.get(id) ?? run.events;
    run.eventCount = Math.max(run.eventCount, events.length);
    if (!run.observedTokens) {
      run.observedTokens = events.reduce((total, event) => {
        const metadata = event.payload.metadata;
        if (!metadata || typeof metadata !== "object") return total;
        const values = metadata as Record<string, unknown>;
        return total
          + (typeof values.inputTokens === "number" ? values.inputTokens : 0)
          + (typeof values.outputTokens === "number" ? values.outputTokens : 0);
      }, 0);
    }
    return run;
  }
  async listMissionRuns(limit = 20): Promise<MissionRun[]> {
    return [...this.missionRuns.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map((run) => structuredClone(run));
  }
  async appendMissionEvent(missionId: string, event: RealityEvent): Promise<void> {
    const events = this.missionEvents.get(missionId) ?? [];
    if (!events.some((candidate) => candidate.id === event.id)) {
      events.push(structuredClone(event));
      this.missionEvents.set(missionId, events);
    }
  }
  async listMissionEvents(missionId: string, limit = 500, before?: string): Promise<RealityEvent[]> {
    const [beforeTime, beforeId] = before?.split("|") ?? [];
    return (this.missionEvents.get(missionId) ?? [])
      .filter((event) => !beforeTime
        || event.occurredAt < beforeTime
        || (event.occurredAt === beforeTime && event.id < (beforeId ?? "")))
      .slice(-limit)
      .map((event) => structuredClone(event));
  }
  async deleteMissionRun(id: string): Promise<void> {
    this.missionRuns.delete(id);
    this.missionEvents.delete(id);
  }
  async deleteAll(): Promise<void> {
    this.realities.clear();
    this.events = [];
    this.session = null;
  }
}
