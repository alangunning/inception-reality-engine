import { describe, expect, it } from "vitest";
import {
  InMemoryRateLimitStore,
  PasswordResetService,
  isResetTokenValid
} from "../src/password-reset";

describe("immutable Reality Anchors", () => {
  it("returns the same public response for known and unknown accounts", () => {
    const service = new PasswordResetService(new Set(["alan@example.com"]));
    expect(service.request("alan@example.com", "198.51.100.1"))
      .toEqual(service.request("nobody@example.com", "198.51.100.2"));
  });

  it("preserves the fifteen-minute token expiry invariant", () => {
    expect(isResetTokenValid(1_000, 1_000 + 15 * 60 * 1000)).toBe(true);
    expect(isResetTokenValid(1_000, 1_000 + 15 * 60 * 1000 + 1)).toBe(false);
  });

  it("limits one identifier even when source IPs rotate", () => {
    const delivered: string[] = [];
    const service = new PasswordResetService(new Set(["alan@example.com"]), (email) => delivered.push(email), () => 1_000);
    for (let index = 0; index < 12; index += 1) {
      service.request("alan@example.com", `203.0.113.${index}`);
    }
    expect(delivered).toHaveLength(3);
  });

  it("shares one identifier budget across service instances", () => {
    const delivered: string[] = [];
    const sharedLimits = new InMemoryRateLimitStore();
    const services = [0, 1].map(() => new PasswordResetService(
      new Set(["alan@example.com"]),
      (email) => delivered.push(email),
      () => 1_000,
      sharedLimits
    ));
    for (let index = 0; index < 12; index += 1) {
      services[index % services.length]!.request(
        "alan@example.com",
        `203.0.113.${index}`
      );
    }
    expect(delivered).toHaveLength(3);
  });
});
