import { describe, expect, it } from "vitest";
import {
  autopilotActiveMilliseconds,
  pauseAutopilotClock,
  resumeAutopilotClock
} from "../src/autopilot-clock";

describe("autopilot active-time clock", () => {
  it("does not count time before start or while paused", () => {
    const fourHoursAgo = new Date("2026-07-19T18:00:00.000Z").getTime();
    const now = new Date("2026-07-19T22:00:00.000Z").getTime();
    const legacyPausedState = {
      activeMilliseconds: 42_000,
      startedAt: "2026-07-19T18:00:00.000Z"
    };

    expect(autopilotActiveMilliseconds(legacyPausedState, now)).toBe(42_000);
    expect(now - fourHoursAgo).toBeGreaterThan(180 * 60_000);
  });

  it("accumulates only open running segments across pauses and resumes", () => {
    const firstStart = "2026-07-19T22:00:00.000Z";
    const firstPause = "2026-07-19T22:02:00.000Z";
    const resumedAt = "2026-07-19T23:30:00.000Z";
    const secondPause = "2026-07-19T23:31:00.000Z";
    const running = resumeAutopilotClock({ activeMilliseconds: 0 }, firstStart);
    const paused = pauseAutopilotClock(running, firstPause);
    const resumed = resumeAutopilotClock(paused, resumedAt);
    const finished = pauseAutopilotClock(resumed, secondPause);

    expect(paused.activeMilliseconds).toBe(2 * 60_000);
    expect(finished.activeMilliseconds).toBe(3 * 60_000);
    expect(finished.activeSince).toBeUndefined();
  });
});
