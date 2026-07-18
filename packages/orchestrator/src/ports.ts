import type { DemoSession, Reality, RealityEvent } from "@inception/domain";

export interface RealityRepository {
  saveReality(reality: Reality): Promise<void>;
  getReality(id: string): Promise<Reality | null>;
  listRealities(): Promise<Reality[]>;
  appendEvent(event: RealityEvent): Promise<void>;
  listEvents(limit?: number): Promise<RealityEvent[]>;
  saveSession(session: DemoSession): Promise<void>;
  getSession(): Promise<DemoSession | null>;
  deleteAll(): Promise<void>;
}

export interface RealityEventBus {
  publish(event: RealityEvent): void;
  subscribe(listener: (event: RealityEvent) => void): () => void;
}
