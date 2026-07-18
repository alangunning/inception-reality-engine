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
    const session: DemoSession = {
      id: "singleton",
      phase: 0,
      activeRealityId: reality.id,
      finalDiff: "",
      anchorResults: [],
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
    expect((await repository.getMissionRun("mission-1"))?.definition.name).toBe("General mission");
    await repository.deleteAll();
    expect((await repository.getRunArchive("archive-1"))?.realities[0]?.id).toBe(reality.id);
    expect((await repository.getMissionRun("mission-1"))?.status).toBe("exploring");
    await repository.deleteMissionRun("mission-1");
    expect(await repository.getMissionRun("mission-1")).toBeNull();
    repository.close();
  });
});
