export const ROTATING_IP_TEST = `import { describe, expect, it, vi } from "vitest";
import { PasswordResetService } from "../src/password-reset";

describe("rotating-IP attack", () => {
  it("caps reset delivery even when source addresses rotate", () => {
    const delivered: string[] = [];
    const service = new PasswordResetService(new Set(["alan@example.com"]), (email) => delivered.push(email), () => 1_000);

    for (let index = 0; index < 12; index += 1) {
      service.request("alan@example.com", \`203.0.113.\${index}\`);
    }

    expect(delivered).toHaveLength(3);
  });
});
`;

export const SECURE_PASSWORD_RESET_IMPLEMENTATION = `export interface PasswordResetResponse {
  message: string;
}

const GENERIC_MESSAGE = "If the account exists, reset instructions will be sent.";
const WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_WINDOW_MS = 60 * 1000;

interface Counter {
  count: number;
  windowStartedAt: number;
}

export class PasswordResetService {
  private readonly ipCounters = new Map<string, Counter>();
  private readonly identifierCounters = new Map<string, Counter>();
  private globalCounter: Counter = { count: 0, windowStartedAt: 0 };

  constructor(
    private readonly accounts: Set<string>,
    private readonly deliverReset: (email: string) => void = () => undefined,
    private readonly now: () => number = Date.now
  ) {}

  request(rawEmail: string, ip: string): PasswordResetResponse {
    const email = rawEmail.trim().toLowerCase();
    const timestamp = this.now();
    const allowed =
      this.consume(this.ipCounters, ip, 5, WINDOW_MS, timestamp) &&
      this.consume(this.identifierCounters, email, 3, WINDOW_MS, timestamp) &&
      this.consumeGlobal(100, GLOBAL_WINDOW_MS, timestamp);

    if (allowed && this.accounts.has(email)) {
      this.deliverReset(email);
    }

    return { message: GENERIC_MESSAGE };
  }

  private consume(store: Map<string, Counter>, key: string, limit: number, windowMs: number, timestamp: number): boolean {
    const current = store.get(key);
    if (!current || timestamp - current.windowStartedAt >= windowMs) {
      store.set(key, { count: 1, windowStartedAt: timestamp });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }

  private consumeGlobal(limit: number, windowMs: number, timestamp: number): boolean {
    if (timestamp - this.globalCounter.windowStartedAt >= windowMs) {
      this.globalCounter = { count: 1, windowStartedAt: timestamp };
      return true;
    }
    if (this.globalCounter.count >= limit) return false;
    this.globalCounter.count += 1;
    return true;
  }
}

export function isResetTokenValid(issuedAt: number, now: number, ttlMs = 15 * 60 * 1000): boolean {
  return now >= issuedAt && now - issuedAt <= ttlMs;
}
`;
