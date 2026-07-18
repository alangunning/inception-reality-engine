import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RealityEntity, type DemoSession } from "@inception/domain";
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

    expect((await repository.getReality(reality.id))?.parentId).toBeNull();
    expect((await repository.getSession())?.activeRealityId).toBe(reality.id);
    expect((await repository.getSession())?.regressionResult?.status).toBe("passed");
    await repository.deleteAll();
    expect((await repository.getRunArchive("archive-1"))?.realities[0]?.id).toBe(reality.id);
    repository.close();
  });
});
