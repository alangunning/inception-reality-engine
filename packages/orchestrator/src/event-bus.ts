import type { RealityEvent } from "@inception/domain";
import type { RealityEventBus } from "./ports";

export class InMemoryRealityEventBus implements RealityEventBus {
  private readonly listeners = new Set<(event: RealityEvent) => void>();

  publish(event: RealityEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: RealityEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
