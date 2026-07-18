export interface PasswordResetResponse {
  message: string;
}

interface Counter {
  count: number;
  windowStartedAt: number;
}

export class PasswordResetService {
  private readonly ipCounters = new Map<string, Counter>();

  constructor(
    private readonly accounts: Set<string>,
    private readonly deliverReset: (email: string) => void = () => undefined,
    private readonly now: () => number = Date.now
  ) {}

  request(rawEmail: string, ip: string): PasswordResetResponse {
    const email = rawEmail.trim().toLowerCase();
    const timestamp = this.now();
    const counter = this.ipCounters.get(ip);

    if (counter && timestamp - counter.windowStartedAt < 60 * 60 * 1000 && counter.count >= 5) {
      return { message: "Too many reset attempts from this address." };
    }

    if (!counter || timestamp - counter.windowStartedAt >= 60 * 60 * 1000) {
      this.ipCounters.set(ip, { count: 1, windowStartedAt: timestamp });
    } else {
      counter.count += 1;
    }

    if (!this.accounts.has(email)) {
      return { message: "Account not found." };
    }

    this.deliverReset(email);
    return { message: "Reset link sent." };
  }
}

export function isResetTokenValid(issuedAt: number, now: number, ttlMs = 15 * 60 * 1000): boolean {
  return now >= issuedAt && now - issuedAt <= ttlMs;
}
