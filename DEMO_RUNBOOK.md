# Demo Mission Runbook

**Runbook version:** 0.1.0
**Last verified:** 2026-07-20
**Authoritative script:** [OpenAI Build Week Submission](./docs/SUBMISSION.md#three-minute-video)

Use this runbook to produce one trustworthy real Codex run, preserve it, and
record the three-minute submission through timeline replay. Docker is not part
of the judge or recording path. The final video should use one of the two
[synchronized demo packages](./docs/demo/): VAmPI for maximum technical depth,
or password reset for the clearest measured impact story.

## 1. Preflight

From a clean clone:

```bash
npm ci
npm run codex:check
npm test
npm run typecheck
npm run build
```

Start full-power real mode:

```bash
npm run judge:demo
```

Open `http://localhost:3000/missions`. Choose the preserved VAmPI run or the
immutable password-reset Demo Mission. Confirm the run header shows `REAL
CODEX`, `gpt-5.6-sol`, and the intended authentication source. Loading,
refreshing, opening Admin, and moving the replay timeline must not start Codex.

## 2. Produce The Real Run

1. In Admin, use **Full reset and cleanup** only before the run starts.
2. Select **Start guided auto**. This is the first action that may use Codex.
3. Resume at each explicit Dream-premise gate after checking the proposed
   uncertainty.
4. Resume at the sealed Adversarial Subject gate. Mal must remain bounded to
   one reversible source change.
5. Do not retry a validation, quota, safety, or token-budget rejection blindly.
   Inspect the event and Admin evidence first.
6. Let synthesis, the four parent-owned Anchors, and stabilisation complete.

Real Codex chooses evidence-backed Dream titles. They do not need to match the
deterministic names. The verified 2026-07-20 run formed:

- `Reality` (ROOT);
- `Experience an atomic shared identifier budget`;
- `Transactional adapter contention and crash Dream`;
- `Independent-identifier campaign budget Dream`.

## 3. Acceptance Gate

Do not record a run unless all of these are visible:

- phase `10`, ROOT status `Reality stabilised`, and guided auto `completed`;
- four Realities with two sibling Nested Dreams at depth two;
- real `gpt-5.6-sol` model, Reality-thread, and native Subject events;
- three returned Memories with three verified nine-check Totem seals;
- Mal detected exactly, one planted change contained, and zero injected
  artefacts returned by the adversarial Dream;
- no open Dream proposals, validation rejections, or Reality fractures;
- all four parent-owned Anchors passed;
- the inherited regression suite passed all four files and nine tests;
- the final diff contains the implementation and five focused test/fixture
  files;
- the outcome states `12 of 12` before and `3 of 12` after without claiming a
  campaign-wide production budget.

One failed exploratory command is acceptable only when later evidence proves
recovery. Test failures are expected evidence in the vulnerable baseline and
counterfactual Dreams; they must be classified as tests, not runtime faults.

## 4. Preserve The Evidence

Before any reset, download **Export current run** from Admin. The repository
keeps a credential-redacted reference export at
[examples/run-exports/password-reset-real-stabilised-2026-07-20.json](./examples/run-exports/password-reset-real-stabilised-2026-07-20.json).

For the preserved reference runs already loaded locally, regenerate all four
sanitized fixtures and verify that they match the live state with:

```bash
npm run demo:exports
npm run demo:exports:check
```

The exporter refuses incomplete or fractured runs, replaces repository and home
paths with `$REPO_ROOT` and `$HOME`, redacts bearer-like values, and never resets
the database or worktrees.

The local Prisma database and `.inception/worktrees` are ignored runtime state.
A fresh clone starts clean. Do not commit authentication, `.env`, the runtime
database, or `.inception/codex-home`.

The repository also keeps the credential-redacted VAmPI snapshot and complete
event log in [`examples/run-exports`](./examples/run-exports/). Never replace a
known-good preserved run immediately before recording.

## 5. Record Through Replay

1. Open the completed run and return the timeline to **Live**.
2. Start the capture on the stabilised outcome and complete graph.
3. Follow either the
   [VAmPI actor script](./docs/demo/vampi/ACTOR_SCRIPT.md) or the
   [password-reset actor script](./docs/demo/password-reset/ACTOR_SCRIPT.md).
4. Keep the matching voice-only transcript and SRT file separate from actor
   directions when generating narration.
5. During the scripted holds, visibly prove one model event, one persisted
   Reality thread, one native Subject event, and intervention containment.
6. Show Memory admission, parent-owned proof, measured outcome, and final diff
   in the causal order specified by the chosen package.
7. Cut briefly to Mission Control, then return to the stabilised outcome.

The optional synchronized Playwright actor performs the exact scrolls and
interactions without starting Codex or mutating the run:

```bash
npm run demo:video -- --scenario vampi --record-dir artifacts/vampi-video
npm run demo:video -- --scenario password-reset --record-dir artifacts/password-reset-video
```

Each command produces a captioned H.264 master, matching SRT sidecar, and JSON
timing report from one shared cue clock. For the submission narration, record a
178-second track from the package's `VOICE_TRANSCRIPT.md`, then rerun with
`--audio narration.wav`; the runner rejects a mismatched duration instead of
silently desynchronizing it. An accelerated `--speed 5` capture is appropriate
for QA only, not the submitted cut.

Never show credentials, raw model output, raw Subject messages, or hidden
reasoning. Validate the generated narration and subtitles with
`npm run demo:video:check` before the final edit.

## 6. Recovery

- **Paused at a Dream or intervention gate:** inspect the pending premise, then
  press **Resume** once.
- **Quota or authentication failure:** stop. Preserve the export and use the
  completed real-run replay; do not spend the remaining allowance on retries.
- **Validation rejection:** inspect the schema path/code in the event. Retry
  only after fixing the contract or evidence mismatch.
- **Stuck local process:** use Admin **Stop all Codex CLI**. This preserves the
  Reality state and worktrees.
- **Discarded run:** export first, then use Admin **Full reset and cleanup**.
  It archives safe telemetry and removes owned worktrees and branches.

The credential-free fallback is `npm run record:demo`; it uses the same domain
and UI contracts, but the submitted technical evidence should remain the
completed real Codex run.
