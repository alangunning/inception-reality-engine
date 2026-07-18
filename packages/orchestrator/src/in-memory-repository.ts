import type { DemoSession, Reality, RealityEvent } from "@inception/domain";
import type { RealityRepository } from "./ports";

export class InMemoryRealityRepository implements RealityRepository {
  private realities = new Map<string, Reality>();
  private events: RealityEvent[] = [];
  private session: DemoSession | null = null;

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
  async deleteAll(): Promise<void> {
    this.realities.clear();
    this.events = [];
    this.session = null;
  }
}
