# Inception: Three-Minute Demo Runbook

**Runbook version:** 0.1.0
**Target:** Desktop or tablet Chromium
**Last rehearsed against UI:** 2026-07-19

## Choose The Runtime

Use deterministic recording mode for the submitted video:

```bash
npm ci
npm run demo:reset
npm run record:demo
```

Use live Codex for technical evaluation:

```bash
npm ci
codex login              # skip if already authenticated or using an API key
npm run judge:demo
```

Open `http://localhost:3000`. An ignored `.env` containing `CODEX_API_KEY` or `OPENAI_API_KEY` is the alternative to CLI auth. Docker is not required.

Page load, refresh, Admin, Mission creation, and timeline replay do not call Codex. In live mode, the action dock explicitly says **STARTS REAL CODEX CLI IN THE ACTIVE WORKTREE** before a usage-bearing action.

## Preflight

1. Open `/missions/password-reset` or click **Demo Mission** in the header.
2. Confirm the header reports **Live memory stream** and the expected runtime.
3. Confirm the action dock shows phase `0 / 10` and **Run Codex audit**.
4. Confirm the Reality graph contains only **Waking Reality**.
5. Keep the timeline on **Live**.

For a consistent recording, click **Start recording auto**. The controller advances the deterministic path, can be paused/resumed/stopped, and never starts merely because the page opened. For a narrated manual recording, use the steps below.

## Three-Minute Sequence

### 0:00 - Establish The Waking Reality

Show:

- the initial belief;
- parent-owned hidden anchors;
- the single waking graph node;
- the idle operation band and zero observed usage.

Say: “Reality Engine lets Codex experience risky assumptions in isolated software worlds before they can change the waking repository.”

The **Next move** band reads **Ask Codex to audit and improve password-reset security**. Click **Run Codex audit**.

In live mode, point to the bound Reality thread, worktree, elapsed time, SDK token evidence, and timestamped milestones. Do not wait on a generic spinner; follow the operation band and Reality Events.

### 0:25 - Turn Uncertainty Into A Dream

Show the proposal asking whether coordinated sources can bypass per-IP protection.

Click **Create Dream: Under coordinated attack**. Review the premise, expected insight, model-estimated impact, token estimate, and cost class. Click **Confirm and create Dream**.

Say: “A Dream is a real child world with its own Codex thread and Git worktree, not another chat panel.”

### 0:45 - Enter Bounded Subjects

The **Next move** band describes entering attacker, investigator, and test-engineer Subjects. Click **Enter Subjects**, then click **Run Codex investigation**.

Show Ariadne, Arthur, and Eames as bounded roles inside the current Dream. In real mode, open a Subject event to show the native child thread ID, completed `spawn_agent`, and terminal `wait` evidence. Do not display raw Subject messages or reasoning.

Show the resulting evidence:

- account-specific behavior can still reveal state;
- per-IP counters do not impose an identifier-level budget;
- the initial belief loses confidence.

### 1:10 - Descend And Return Memory

Click **Create nested Dream: Rotating IP swarm**, review the narrower counterfactual, and click **Confirm and create Dream**.

Say: “The uncertainty discovered inside one Dream becomes a deeper isolated Reality.”

Click **Kick and return memory**. During the staged Wake, call out:

1. lived evidence collected;
2. Reality Totem checking identity, source, anchors, evidence, artefacts, and lineage;
3. validated memory returning upward.

Show the failing `rotating-ip.attack.spec.ts` artefact and the memory path on the graph. Then click **Kick and return memory** again to wake **Under coordinated attack**.

### 1:45 - Change Reality Only Through Proof

Click **Synthesise memories**.

Show that returned knowledge changes the waking implementation while the Dream worktrees remain isolated. Click **Run anchor tests** and pause on:

- Enumeration-safe response;
- Token expiry preserved;
- Rotating-IP resistance;
- the returned rotating-IP regression.

If proof fails in live mode, the engine offers **Repair proof** and cannot stabilise. On the successful path, click **Stabilise Reality**.

### 2:20 - Close On The Differentiator

Show:

- the complete nested Reality graph and exact return paths;
- Memories before/after;
- Reality Totem seals and inherited lineage;
- final proof results;
- **Reveal code** for the waking Git diff;
- timestamped, searchable events with inspectable metadata;
- the Reality Timeline moving through earlier states and returning to **Live**.

Say: “Good evidence and tested artefacts can wake into Reality. Unsupported assumptions, stale lineage, and planted changes are quarantined before they cross a Kick boundary.”

If time permits, open **Mission Control** and show the generalized VAmPI preset, editable proofs and Subject charters, sibling-Dream strategy, and bounded controlled Subject. Do not prepare or run it during the three-minute canonical recording.

## Optional Controlled-Subject Shot

Use a previously completed generalized Mission or a dedicated recording fixture. Show:

1. **Injected Subject / contained** in the intervention ledger;
2. the diagnosis verdict;
3. the restored baseline and excluded injected artefact count;
4. **Memory verified** or **Memory quarantined**;
5. the containment event and upward memory path.

The correct claim is: the injected mutation never ascends. An exact diagnosis may return independent knowledge and safe investigator tests; a partial or missed diagnosis quarantines the entire Wake Report.

## Recovery

When no operation is active, **Full reset** in the action dock clearly resets the Demo Mission. It is not a refresh control.

For process and filesystem cleanup:

1. open the Admin gear;
2. choose **Stop all Codex CLI** if an operation is active;
3. choose **Full reset and cleanup** and confirm.

The reset archives safe telemetry, removes only Demo Mission-owned Reality/worktree state, prunes owned branches, and forms a clean waking Reality. The equivalent terminal command is:

```bash
npm run demo:reset
```

User-created Missions are reset or deleted separately from the Admin Mission Library. The immutable password-reset Demo Mission can be opened, exported, and reset, but not deleted.

## Accuracy Guardrails

- Say **model-reported estimate** for belief confidence, Dream impact, token estimate, and cost.
- Say **observed SDK token ceiling**, not provider billing cap.
- Say **validated** for schema conformance and **verified** only after Reality Totem/proof checks.
- Mock recording events are deterministic equivalents; native Subject thread evidence is a live-mode claim.
- Never show `auth.json`, API keys, raw Codex output, raw Subject messages, or hidden reasoning.
