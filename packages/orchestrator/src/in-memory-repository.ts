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
    return structuredClone(this.missionRuns.get(id) ?? null);
  }
  async listMissionRuns(limit = 20): Promise<MissionRun[]> {
    return [...this.missionRuns.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map((run) => structuredClone(run));
  }
  async deleteMissionRun(id: string): Promise<void> {
    this.missionRuns.delete(id);
  }
  async deleteAll(): Promise<void> {
    this.realities.clear();
    this.events = [];
    this.session = null;
  }
}
