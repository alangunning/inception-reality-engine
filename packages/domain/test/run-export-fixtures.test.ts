import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DemoSessionSchema,
  MissionRunSchema,
  RealityEventSchema,
  RealityRunArchiveSchema,
  RealitySchema
} from "../src";

const fixturePath = (name: string) => fileURLToPath(
  new URL(`../../../examples/run-exports/${name}`, import.meta.url)
);

const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(fixturePath(name), "utf8"));

const RuntimeEvidenceSchema = z.object({
  codexMode: z.enum(["mock", "real"]),
  persistence: z.string().min(1),
  model: z.string().min(1),
  sdkVersion: z.string().min(1),
  authSource: z.enum(["cli", "api-key", "none"]).optional()
});

const MissionHistorySchema = z.object({
  session: DemoSessionSchema,
  realities: z.array(RealitySchema),
  events: z.array(RealityEventSchema),
  activeReality: RealitySchema,
  operation: z.null(),
  nextAction: z.null(),
  runtime: RuntimeEvidenceSchema
});

function expectCredentialRedacted(value: unknown): void {
  const serialized = JSON.stringify(value);
  const credentialScan = serialized
    .replaceAll("Bearer synthetic-token", "Bearer [synthetic]")
    .replaceAll("Bearer synthetic-local-token", "Bearer [synthetic]");
  expect(credentialScan).not.toMatch(/sk-[A-Za-z0-9_-]{12,}/);
  expect(credentialScan).not.toMatch(/Bearer [A-Za-z0-9._~+/-]{12,}/);
  expect(serialized).not.toMatch(/(?:OPENAI|CODEX)_API_KEY\s*[=:]\s*\S+/);
  expect(serialized).not.toContain("/.codex/auth.json");
  expect(serialized).not.toMatch(/\/Users\/[^/"\\]+/);

  const forbiddenKeys = new Set([
    "apiKey",
    "accessToken",
    "refreshToken",
    "authorization",
    "credential",
    "credentials"
  ]);
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    for (const [key, nested] of Object.entries(entry)) {
      expect(forbiddenKeys.has(key)).toBe(false);
      visit(nested);
    }
  };
  visit(value);
}

describe("committed real-run exports", () => {
  it("keeps the safe run log importable through the archive contract", () => {
    const raw = loadFixture("password-reset-real-stabilised-2026-07-20.json");
    const archive = RealityRunArchiveSchema.parse(raw);

    expect(archive.session.phase).toBe(10);
    expect(archive.realities).toHaveLength(4);
    expect(archive.events).toHaveLength(215);
    expect(archive.session.memoryIntegrity).toHaveLength(3);
    expect(archive.session.anchorResults.every((result) => result.status === "passed")).toBe(true);
    expectCredentialRedacted(raw);
  });

  it("keeps the safe mission history aligned with the completed live state", () => {
    const raw = loadFixture("password-reset-real-mission-history-2026-07-20.json");
    const snapshot = MissionHistorySchema.parse(raw);

    expect(snapshot.session.phase).toBe(10);
    expect(snapshot.session.activeRealityId).toBe(snapshot.activeReality.id);
    expect(snapshot.realities).toHaveLength(4);
    expect(snapshot.events).toHaveLength(215);
    expect(snapshot.runtime).toMatchObject({
      codexMode: "real",
      model: "gpt-5.6-sol",
      authSource: "cli"
    });
    expectCredentialRedacted(raw);
  });

  it("keeps the VAmPI Mission history aligned with its stabilised real state", () => {
    const raw = loadFixture("vampi-real-mission-history-2026-07-20.json");
    const history = z.object({
      snapshot: z.object({
        run: MissionRunSchema,
        activeReality: RealitySchema,
        operation: z.null(),
        nextAction: z.null()
      }),
      runtime: z.object({
        mode: z.literal("real"),
        model: z.string().min(1),
        sdkVersion: z.string().min(1),
        authSource: z.literal("cli")
      })
    }).parse(raw);

    expect(history.snapshot.run.status).toBe("stabilised");
    expect(history.snapshot.run.realities).toHaveLength(15);
    expect(history.snapshot.run.memories).toHaveLength(14);
    expect(history.snapshot.run.memoryIntegrity).toHaveLength(14);
    expect(history.snapshot.run.events).toHaveLength(1_048);
    expect(history.snapshot.run.proofResults.every((result) => result.status === "passed"))
      .toBe(true);
    expect(history.snapshot.run.realities.flatMap((reality) => reality.proposals)
      .every((proposal) => proposal.status === "resolved")).toBe(true);
    expect(history.snapshot.run.finalDiff).not.toContain(".inception/");
    expectCredentialRedacted(raw);
  });

  it("keeps the standalone VAmPI event log complete and schema-valid", () => {
    const raw = loadFixture("vampi-real-run-log-2026-07-20.json");
    const log = z.object({
      format: z.literal("inception-mission-event-log"),
      version: z.literal(1),
      mission: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        status: z.literal("stabilised"),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime()
      }),
      runtime: z.object({
        mode: z.literal("real"),
        model: z.string().min(1),
        sdkVersion: z.string().min(1),
        authSource: z.literal("cli")
      }),
      eventCount: z.literal(1_048),
      events: z.array(RealityEventSchema).length(1_048)
    }).parse(raw);

    expect(log.events.at(-1)?.type).toBe("autopilot.completed");
    expectCredentialRedacted(raw);
  });
});
