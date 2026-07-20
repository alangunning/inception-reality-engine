# Demo Video Packages

Two complete, evidence-matched cuts are available. Both use preserved real
Codex runs and finish at `02:58`, leaving two seconds below the Devpost limit.

| Cut | Strongest judging signal | Use when |
| --- | --- | --- |
| [VAmPI generalized Mission](./vampi/ACTOR_SCRIPT.md) | Technological implementation, novelty, generality | The 15-node graph remains legible in the final capture. This is the recommended competition cut. |
| [Password-reset Demo Mission](./password-reset/ACTOR_SCRIPT.md) | Immediate impact, clean containment story, measured before/after result | A simpler one-take narrative is more reliable or the dense VAmPI graph is not readable after video compression. |

Do not splice both full stories into one three-minute video. That would weaken
the explanation of Reality, Dream, Subject, Kick, Totem Check, and outcome. The
project description covers both runs, while the video should commit to one.

Each package contains:

- `ACTOR_SCRIPT.md`: silent stage directions, scroll targets, UI actions, and
  the proof that must be visible;
- `VOICE_TRANSCRIPT.md`: spoken words only, generated from the timing source;
- `subtitles.srt`: sentence-level, line-wrapped captions with exact timecodes.

The source of truth for timing is
[`scripts/demo-video-cues.mjs`](../../scripts/demo-video-cues.mjs). Regenerate
and validate derived assets with:

```bash
npm run demo:video:assets
npm run demo:video:check
```

The optional Playwright actor can perform the same moves against an already
stabilised local run. It never starts Codex or changes Mission state:

```bash
# Visible browser, synchronized at real speed.
npm run demo:video -- --scenario vampi

# Password-reset alternative.
npm run demo:video -- --scenario password-reset

# Produce a synchronized, captioned H.264 master plus its audit report.
npm run demo:video -- --scenario vampi --record-dir artifacts/vampi-video

# Optionally mux a duration-matched narration track into the master.
npm run demo:video -- --scenario vampi --record-dir artifacts/vampi-video --audio narration.wav
```

Use `--mission-id <id>` to choose a particular VAmPI run, `--headless` for CI,
or `--speed 5` for an accelerated synchronization check. A recorded run writes
the raw Playwright WebM, a frame-trimmed captioned H.264 MP4, a matching SRT
sidecar, and a JSON timing report containing every action's measured drift.
Captions and browser actions use the same cue clock, including across route
changes. `--audio` accepts a pre-recorded narration track only when its duration
is within 500 ms of the selected cut, then muxes it without shifting video or
captions. `ffmpeg` and `ffprobe` are required only for recording, not for running
or judging Reality Engine. Keep `artifacts/` uncommitted.

The VAmPI package is authored for normal speed and ends at `02:58`. Use the
generated `vampi-sync.json` as the acceptance record: the output duration must
be 178 seconds and `maximumActionDriftMs` must remain below the configured
recording ceiling (750 ms by default).
