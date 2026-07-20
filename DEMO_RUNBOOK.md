# Demo Mission Runbook

**Runbook version:** 0.1.0
**Last verified:** 2026-07-20
**Authoritative script:** [OpenAI Build Week Submission](./docs/SUBMISSION.md#three-minute-video)

Use this runbook to produce one trustworthy real Codex run, preserve it, and
record the three-minute submission through adaptive replay. Docker is not part
of the judge or recording path.

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

Open `http://localhost:3000/missions/password-reset`. Confirm the header shows
`REAL CODEX`, `gpt-5.6-sol`, and the intended authentication source. Loading,
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

The local Prisma database and `.inception/worktrees` are ignored runtime state.
A fresh clone starts clean. Do not commit authentication, `.env`, the runtime
database, or `.inception/codex-home`.

## 5. Record Through Replay

1. Open the completed run and return the timeline to **Live**.
2. Start the capture on the stabilised outcome and complete graph.
3. Select **Play adaptive timeline replay**. It uses high-signal holds rather
   than moving through every event at constant speed.
4. During the scripted holds, open one model event, one persisted
   Reality-thread event, one native Subject event, and the intervention reveal.
5. Show the two depth-two sibling Dreams, Memory ascent, Totem seals, four
   passing Anchors, measured outcome, and final diff.
6. Cut briefly to Mission Control, then return to the stabilised graph.

Follow the exact 2:58 narration and shots in
[docs/SUBMISSION.md](./docs/SUBMISSION.md#shot-and-narration-script). Never show
credentials, raw model output, raw Subject messages, or hidden reasoning.

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
