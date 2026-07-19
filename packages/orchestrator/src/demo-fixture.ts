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

export const ENUMERATION_RESPONSE_TEST = `import { describe, expect, it } from "vitest";
import { PasswordResetService } from "../src/password-reset";

describe("account-enumeration attack", () => {
  it("returns one public response for known and unknown accounts", () => {
    const service = new PasswordResetService(new Set(["alan@example.com"]));

    expect(service.request("alan@example.com", "198.51.100.1"))
      .toEqual(service.request("nobody@example.com", "198.51.100.2"));
  });
});
`;

export const SECURE_PASSWORD_RESET_IMPLEMENTATION = `export interface PasswordResetResponse {
  message: string;
}

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number, timestamp: number): boolean;
}

const GENERIC_MESSAGE = "If the account exists, reset instructions will be sent.";
const WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_WINDOW_MS = 60 * 1000;

interface Counter {
  count: number;
  windowStartedAt: number;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, Counter>();

  consume(key: string, limit: number, windowMs: number, timestamp: number): boolean {
    const current = this.counters.get(key);
    if (!current || timestamp - current.windowStartedAt >= windowMs) {
      this.counters.set(key, { count: 1, windowStartedAt: timestamp });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }
}

export class PasswordResetService {
  constructor(
    private readonly accounts: Set<string>,
    private readonly deliverReset: (email: string) => void = () => undefined,
    private readonly now: () => number = Date.now,
    private readonly rateLimits: RateLimitStore = new InMemoryRateLimitStore()
  ) {}

  request(rawEmail: string, ip: string): PasswordResetResponse {
    const email = rawEmail.trim().toLowerCase();
    const timestamp = this.now();
    const allowed =
      this.rateLimits.consume(\`ip:\${ip}\`, 5, WINDOW_MS, timestamp) &&
      this.rateLimits.consume(\`identifier:\${email}\`, 3, WINDOW_MS, timestamp) &&
      this.rateLimits.consume("global", 100, GLOBAL_WINDOW_MS, timestamp);

    if (allowed && this.accounts.has(email)) {
      try {
        this.deliverReset(email);
      } catch {
        // Delivery failures remain behind the enumeration-safe public boundary.
      }
    }

    return { message: GENERIC_MESSAGE };
  }
}

// Production adapters must make consume an atomic Redis or database increment.
export function isResetTokenValid(issuedAt: number, now: number, ttlMs = 15 * 60 * 1000): boolean {
  return now >= issuedAt && now - issuedAt <= ttlMs;
}
`;
