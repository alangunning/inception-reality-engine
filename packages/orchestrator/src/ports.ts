import type {
  DemoSession,
  MissionRun,
  Reality,
  RealityEvent,
  RealityRunArchive
} from "@inception/domain";

export interface RealityRepository {
  saveReality(reality: Reality): Promise<void>;
  getReality(id: string): Promise<Reality | null>;
  listRealities(): Promise<Reality[]>;
  appendEvent(event: RealityEvent): Promise<void>;
  listEvents(limit?: number): Promise<RealityEvent[]>;
  saveSession(session: DemoSession): Promise<void>;
  getSession(): Promise<DemoSession | null>;
  saveRunArchive(archive: RealityRunArchive): Promise<void>;
  listRunArchives(limit?: number): Promise<RealityRunArchive[]>;
  getRunArchive(id: string): Promise<RealityRunArchive | null>;
  saveMissionRun(run: MissionRun): Promise<void>;
  getMissionRun(id: string): Promise<MissionRun | null>;
  listMissionRuns(limit?: number): Promise<MissionRun[]>;
  appendMissionEvent(missionId: string, event: RealityEvent): Promise<void>;
  listMissionEvents(missionId: string, limit?: number, before?: string): Promise<RealityEvent[]>;
  deleteMissionRun(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface RealityEventBus {
  publish(event: RealityEvent): void;
  subscribe(listener: (event: RealityEvent) => void): () => void;
}
