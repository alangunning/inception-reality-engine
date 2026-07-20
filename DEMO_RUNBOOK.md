# Inception: Three-Minute Demo Runbook

**Runbook version:** 0.1.0
**Target:** Desktop or tablet Chromium
**Last verified against UI:** 2026-07-20

The authoritative Devpost description and word-for-word submitted-video
narration live in [OpenAI Build Week Submission](./docs/SUBMISSION.md). This
runbook owns runtime preparation, the manual live evaluation path, and
recovery. Do not combine its live-action timings with the edited replay script.

## Choose The Runtime

For the submitted video, first complete a fresh live run:

```bash
npm ci
npm run demo:reset
codex login              # skip if already authenticated or using an API key
npm run judge:demo
```

After Reality stabilises, open Admin and choose **Export current safe run log**. Keep that completed run loaded and record with the adaptive timeline replay; do not wait for live Codex during the recording itself. Open one model event, one persisted Reality-thread event, and one native Subject event while narrating how GPT-5.6 and Codex were used.

Use deterministic mode only as the credential-free fallback or to reproduce a fixed UI take:

```bash
npm ci
npm run demo:reset
npm run record:demo
```

Open `http://localhost:3000`. An ignored `.env` containing `CODEX_API_KEY` or `OPENAI_API_KEY` is the alternative to CLI auth. Docker is not required.

Page load, refresh, Admin, Mission creation, and timeline replay do not call Codex. In live mode, the action dock explicitly says **STARTS REAL CODEX CLI IN THE ACTIVE WORKTREE** before a usage-bearing action.

## Preflight

1. Open `/missions/password-reset` or click **Demo Mission** in the header.
2. Confirm the header reports **Live memory stream** and the expected runtime.
3. Confirm the action dock shows phase `0 / 10` and **Run Codex audit**.
4. Confirm the graph contains only **Reality** with a **ROOT** badge.
5. Keep the timeline on **Live**.

For a consistent mock recording, click **Start recording auto**. In live mode, click **Start guided auto** to advance bounded real Codex actions. Guided auto pauses before each new Dream premise and after failed immutable proof so the operator can inspect the evidence, then explicitly **Resume**. Both controllers can be paused or stopped and neither starts merely because the page opened. For manual live evaluation, use the steps below.

## Manual Live Evaluation Sequence

This action-complete walkthrough is for preparation and judge-led live
evaluation. A real run may take substantially longer than three minutes. The
submitted video must use the completed-run replay and narration in
`docs/SUBMISSION.md`.

The button names below use the canonical deterministic titles. A real GPT-5.6
run may return different concise Dream titles. Follow the displayed premise,
parent-child position, and evidence outcome rather than relying on an exact
generated name.

### Establish Reality

Show:

- the initial belief;
- parent-owned hidden anchors;
- the single ROOT graph node;
- the idle operation band and zero observed usage.

Say: “Reality Engine lets Codex experience risky assumptions in isolated software worlds before they can change the protected repository.”

The **Next move** band reads **Ask Codex to audit and improve password-reset security**. Click **Run Codex audit**.

In live mode, point to the bound Reality thread, worktree, elapsed time, SDK token evidence, and timestamped milestones. Do not wait on a generic spinner; follow the operation band and Reality Events.
The wall clock measures the active Codex operation. Subjective Dream time advances only at completed experience milestones and multiplies those minutes by the current Reality's dilation; waiting for narration or the next click does not change it.

### Turn Uncertainty Into A Dream

Show the proposal asking whether coordinated sources can bypass per-IP protection.

Click **Create Dream: Under coordinated attack**. Review the premise, expected insight, model-estimated impact, token estimate, and cost class. Click **Confirm and create Dream**.

Say: “A Dream is a real child world with its own Codex thread and Git worktree, not another chat panel.”

### Enter Bounded Subjects

The **Next move** band describes entering attacker, investigator, and test-engineer Subjects. Click **Enter Subjects**, then click **Run Codex investigation**.

Show Ariadne, Arthur, and Eames as bounded roles inside the current Dream. In real mode, open a Subject event to show the native child thread ID, completed `spawn_agent`, and terminal `wait` evidence. Do not display raw Subject messages or reasoning.

Show the resulting evidence:

- account-specific behavior can still reveal state;
- per-IP counters do not impose an identifier-level budget;
- the initial belief loses confidence.

### Compare Nested Dreams

Click **Create nested Dream: Rotating IP swarm**, review the narrower counterfactual, and click **Confirm and create Dream**.

Say: “The uncertainty discovered inside one Dream becomes a deeper isolated Nested Dream.”

Click **Kick: return memory**. During the staged return, call out:

1. lived evidence collected;
2. Totem Check validating identity, source, Anchors, evidence, artefacts, and lineage;
3. validated memory returning upward.

Show the failing `rotating-ip.attack.spec.ts` artefact and the Memory path on the graph. The parent retains the competing proposal rather than returning early.

Create **Account enumeration oracle**. Before its Kick, run **Run sealed intervention**:

1. Mal enters as a native Adversarial Subject with one allowed source path, one fault class, a line/token/time ceiling, and a rollback checkpoint;
2. the intervention changes one request-boundary condition while its private ledger remains sealed;
3. Arthur diagnoses the observable regression without seeing that ledger;
4. the Totem Check reveals the exact planted change at Kick;
5. the orchestrator restores the checkpoint and retains only the independent response-equivalence test.

Pause on **1 planted change contained / 0 injected files entered Reality**, then show the native Subject thread in the intervention ledger or its event detail. Collapse and re-expand the **Under coordinated attack** branch once to show that both Nested Dreams and their Memory paths remain independently inspectable.

Kick **Under coordinated attack** only after both nested memories return.

### Change Reality Only Through Proof

Click **Synthesise memories**.

Show that returned knowledge changes Reality's implementation while the Dream worktrees remain isolated. Click **Run anchor tests** and pause on:

- Enumeration-safe response;
- Token expiry preserved;
- Rotating-IP resistance;
- Cross-instance abuse budget using two service instances and one injected shared store;
- both returned nested regressions.

If proof fails in live mode, the engine offers **Repair proof** and cannot stabilise. On the successful path, click **Stabilise Reality**.

### Close On The Differentiator

Show:

- the complete Reality graph and exact Memory return paths;
- two sibling depth-two counterfactuals and graph-attached Subject nodes;
- Memories before/after;
- Totem Check results and inherited lineage;
- final proof results;
- **Reveal code** for the Reality Git diff;
- timestamped, searchable events with inspectable metadata;
- the Reality Timeline **Play** control replaying high-signal milestones at adaptive pacing and returning to **Live** after the final stabilisation hold;
- the measured outcome: **12/12** deliveries before, **3/12** after, **1** planted mutation rolled back, **0** injected files ascended, **4/4** parent requirements passed.

Say: “Good evidence and tested artefacts can return to Reality. Unsupported assumptions, stale lineage, and planted changes are quarantined before they cross a Kick boundary.”

If time permits, open **Mission Control** and show the generalized VAmPI preset, editable proofs and Subject charters, sibling-Dream strategy, and bounded Adversarial Subject. Do not prepare or run it during the three-minute canonical recording.

## Submitted Replay Preparation

Use the exact shot order and narration in
[OpenAI Build Week Submission](./docs/SUBMISSION.md#three-minute-video). On the
completed clean live run, press **Play** in the Reality Timeline. Each
milestone receives an evidence-sensitive dwell rather than a constant slider
speed. Press the eye icon to pause and inspect the current milestone, then
resume playback. Open:

1. the model-binding event to show `gpt-5.6-sol` and the SDK version;
2. a Reality thread event to show the persisted thread, worktree, and Git branch;
3. a Subject event to show the native child thread and terminal collaboration evidence;
4. the containment event to show that the rollback happened before memory admission.

The correct claim is: the injected mutation never ascends. An exact diagnosis may return independent knowledge and safe investigator tests; a partial or missed diagnosis quarantines the entire Wake Report. Event details contain only validated safe metadata, never raw Subject messages or hidden reasoning.

## Recovery

When no operation is active, **Full reset** in the action dock clearly resets the Demo Mission. It is not a refresh control.

For process and filesystem cleanup:

1. open the Admin gear;
2. choose **Stop all Codex CLI** if an operation is active;
3. choose **Full reset and cleanup** and confirm.

The reset archives safe telemetry, removes only Demo Mission-owned Reality/worktree state, prunes owned branches, and creates a clean Reality. The equivalent terminal command is:

```bash
npm run demo:reset
```

User-created Missions are reset or deleted separately from the Admin Mission Library. The immutable password-reset Demo Mission can be opened, exported, and reset, but not deleted.

## Accuracy Guardrails

- Say **model-reported estimate** for belief confidence, Dream impact, token estimate, and cost.
- Say **observed SDK token ceiling**, not provider billing cap.
- Say **validated** for schema conformance and **verified** only after Totem Check and proof checks.
- Mock recording events are deterministic equivalents; native Subject thread evidence is a live-mode claim.
- Never show `auth.json`, API keys, raw Codex output, raw Subject messages, or hidden reasoning.
