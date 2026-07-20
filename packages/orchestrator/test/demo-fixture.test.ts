import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SECURE_PASSWORD_RESET_IMPLEMENTATION } from "../src/demo-fixture";

describe("password-reset Demo fixture", () => {
  it("keeps the Reality source vulnerable until synthesis applies the secure implementation", () => {
    const startingSource = fs.readFileSync(
      path.resolve("demo/password-reset/src/password-reset.ts"),
      "utf8"
    );

    expect(startingSource).toContain("private readonly ipCounters");
    expect(startingSource).toContain('message: "Account not found."');
    expect(startingSource).toContain('message: "Reset link sent."');
    expect(startingSource).not.toContain("RateLimitStore");

    expect(SECURE_PASSWORD_RESET_IMPLEMENTATION).toContain("export interface RateLimitStore");
    expect(SECURE_PASSWORD_RESET_IMPLEMENTATION).toContain("InMemoryRateLimitStore");
    expect(SECURE_PASSWORD_RESET_IMPLEMENTATION).toContain("Redis or database increment");
  });
});
