import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MissionRunSchema,
  RealityEntity,
  type DemoSession
} from "@inception/domain";
import { SqliteRealityRepository } from "../src/sqlite-repository";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("SqliteRealityRepository", () => {
  it("persists nullable roots and restores validated domain state", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "inception-sqlite-"));
    directories.push(directory);
    const repository = new SqliteRealityRepository(path.join(directory, "demo.db"));
    const reality = RealityEntity.create({
      depth: 0,
      kind: "waking",
      name: "Waking Reality",
      premise: "Test premise",
      constitution: {
        mission: "Test mission",
        premise: "Test premise",
        constraints: [],
        wakeContract: [],
        parentTruths: []
      },
      inheritedAnchors: [],
      initialBeliefs: []
    }).snapshot();
    const now = new Date().toISOString();
    const memoryIntegrity = [{
      id: "seal-1",
      realityId: reality.id,
      parentRealityId: reality.id,
      reportDigest: "a".repeat(64),
      sourceStateDigest: "b".repeat(64),
      sourceCommit: "abcdef0",
      anchorFingerprint: "c".repeat(64),
      parentAnchorFingerprint: "c".repeat(64),
      descendantSealIds: [],
      descendantRealityIds: [],
      checks: ([
        "schema",
        "identity",
        "report-digest",
        "source-state",
        "anchor-fingerprint",
        "evidence-lineage",
        "artefact-resolution",
        "descendant-lineage",
        "intervention-diagnosis"
      ] as const).map((name) => ({
        name,
        status: "passed" as const,
        summary: `${name} passed.`
      })),
      verdict: "verified" as const,
      policyVersion: "memory-integrity/v2" as const,
      sealedAt: now
    }] satisfies DemoSession["memoryIntegrity"];
    const interventions = [{
      id: "intervention-1",
      contractId: "contract-1",
      realityId: reality.id,
      status: "revealed" as const,
      armedAt: now,
      startedAt: now,
      sealedAt: now,
      revealedAt: now,
      containedAt: now,
      baselineCommit: "a".repeat(40),
      subjectThreadId: "subject-thread-1",
      changedFileCount: 1,
      patchLineCount: 2,
      excludedArtefactPaths: []
    }] satisfies DemoSession["interventions"];
    const session: DemoSession = {
      id: "singleton",
      phase: 0,
      activeRealityId: reality.id,
      finalDiff: "",
      anchorResults: [],
      memoryIntegrity,
      interventions,
      autopilot: {
        mode: "off",
        kind: "demo",
        maxActions: 10,
        maxMinutes: 60,
        paceMilliseconds: 1_000,
        pauseOnDream: true,
        actionsCompleted: 0
      },
      regressionResult: {
        status: "passed",
        output: "4 tests passed",
        command: "vitest run demo/password-reset/tests",
        durationMs: 420,
        testFiles: ["demo/password-reset/tests/anchors.spec.ts"]
      },
      createdAt: now,
      updatedAt: now
    };

    await repository.saveReality(reality);
    await repository.saveSession(session);
    await repository.saveRunArchive({
      id: "archive-1",
      session,
      realities: [reality],
      events: [],
      archivedAt: now
    });
    const mission = MissionRunSchema.parse({
      id: "mission-1",
      definition: {
        id: "mission-1",
        name: "General mission",
        repositoryPath: directory,
        mission: "Test mission persistence.",
        scope: "repository",
        premise: "State should survive refresh.",
        constraints: ["Preserve contracts."],
        parentTruths: [],
        wakeContract: ["Return evidence."],
        proofs: [{
          id: "proof-1",
          name: "Tests",
          executable: "npm",
          args: ["test"]
        }],
        subjects: [],
        tokenBudget: 10_000,
        maxDreamDepth: 1,
        createdAt: now
      },
      status: "exploring",
      realities: [reality],
      events: [],
      activeRealityId: reality.id,
      memories: [],
      proofResults: [],
      finalDiff: "",
      createdAt: now,
      updatedAt: now
    });
    await repository.saveMissionRun(mission);

    expect((await repository.getReality(reality.id))?.parentId).toBeNull();
    expect((await repository.getSession())?.activeRealityId).toBe(reality.id);
    expect((await repository.getSession())?.regressionResult?.status).toBe("passed");
    expect((await repository.getSession())?.memoryIntegrity[0]?.id).toBe("seal-1");
    expect((await repository.getSession())?.interventions[0]).toMatchObject({
      id: "intervention-1",
      containedAt: now,
      changedFileCount: 1
    });
    expect((await repository.getMissionRun("mission-1"))?.definition.name).toBe("General mission");
    expect((await repository.getMissionRun("mission-1"))?.memoryIntegrity).toEqual([]);
    await repository.deleteAll();
    expect((await repository.getRunArchive("archive-1"))?.realities[0]?.id).toBe(reality.id);
    expect((await repository.getMissionRun("mission-1"))?.status).toBe("exploring");
    await repository.deleteMissionRun("mission-1");
    expect(await repository.getMissionRun("mission-1")).toBeNull();
    repository.close();
  });

  it("keeps Mission events append-only and pages older history without hydrating the full log", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "inception-events-"));
    directories.push(directory);
    const repository = new SqliteRealityRepository(path.join(directory, "events.db"));
    const reality = RealityEntity.create({
      depth: 0,
      kind: "waking",
      name: "Scalable Reality",
      premise: "The event stream remains reviewable.",
      constitution: {
        mission: "Retain validated events.",
        premise: "The event stream remains reviewable.",
        constraints: ["Persist safe metadata only."],
        wakeContract: ["Return evidence."],
        parentTruths: []
      },
      inheritedAnchors: [],
      initialBeliefs: []
    }).snapshot();
    const createdAt = "2026-07-19T00:00:00.000Z";
    const mission = MissionRunSchema.parse({
      id: "mission-events",
      definition: {
        id: "mission-events",
        name: "Event history",
        repositoryPath: directory,
        mission: "Prove cursor history.",
        scope: "event persistence",
        premise: "History remains available.",
        constraints: ["No raw reasoning."],
        parentTruths: [],
        wakeContract: ["Return evidence."],
        proofs: [{ id: "proof", name: "Tests", executable: "npm", args: ["test"] }],
        subjects: [],
        tokenBudget: 10_000,
        maxDreamDepth: 1,
        createdAt
      },
      status: "exploring",
      realities: [reality],
      events: [],
      eventCount: 550,
      observedTokens: 550,
      activeRealityId: reality.id,
      memories: [],
      proofResults: [],
      finalDiff: "",
      createdAt,
      updatedAt: createdAt
    });
    await repository.saveMissionRun(mission);
    for (let index = 0; index < 550; index += 1) {
      await repository.appendMissionEvent("mission-events", {
        id: `event-${index.toString().padStart(4, "0")}`,
        realityId: reality.id,
        type: "codex.progress",
        summary: `Validated event ${index}`,
        dreamTime: index,
        payload: {
          metadata: {
            stage: "turn",
            status: "completed",
            inputTokens: 1
          }
        },
        occurredAt: new Date(Date.parse(createdAt) + index).toISOString()
      });
    }

    const hydrated = await repository.getMissionRun("mission-events");
    expect(hydrated?.events).toHaveLength(500);
    expect(hydrated?.eventCount).toBe(550);
    expect(hydrated?.observedTokens).toBe(550);
    const recent = await repository.listMissionEvents("mission-events", 200);
    const earliestRecent = recent[0]!;
    const older = await repository.listMissionEvents(
      "mission-events",
      200,
      `${earliestRecent.occurredAt}|${earliestRecent.id}`
    );
    expect(recent).toHaveLength(200);
    expect(older).toHaveLength(200);
    expect(new Set([...recent, ...older].map((event) => event.id)).size).toBe(400);
    expect(older.at(-1)!.occurredAt < earliestRecent.occurredAt).toBe(true);
    repository.close();
  });
});
