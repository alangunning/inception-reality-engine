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

# Save a silent WebM for later narration and subtitle muxing.
npm run demo:video -- --scenario vampi --record-dir artifacts/vampi-video
```

Use `--mission-id <id>` to choose a particular VAmPI run, `--headless` for CI,
or `--speed 50` for a fast rehearsal. Video capture has no audio; add the
generated voice track and SRT captions in the editor. Keep `artifacts/`
uncommitted.
