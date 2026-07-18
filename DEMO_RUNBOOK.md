# Inception — Three-Minute Demo Runbook

## Before presenting

```bash
npm install
npm run demo:reset
npm run codex:check
npm run dev:real
```

Open `http://localhost:3000`. This uses the existing Codex CLI login in `~/.codex/auth.json`.

For the deterministic backup, run `npm run dev:mock`. It follows the same UI sequence without network or account dependencies.

## Presentation sequence

### 1. Establish the waking Reality

Point to the central Reality graph, immutable anchors, initial belief, and isolated worktree.

Say: “This is not an agent dashboard. It is one software world with a premise, history, evidence, constitution, Codex thread, and Git worktree.”

Click **Ask Codex to audit and improve password-reset security**. The live operation band confirms the real CLI is active, shows elapsed wall time, and names each validated command, tool, and file milestone. Its tool-call total includes terminal commands, file changes, MCP tools, and searches; the adjacent counters retain the command/file breakdown.

### 2. Surface uncertainty

Show the uncertainty card: whether per-IP rate limiting prevents abuse.

Say: “The agent does not immediately commit to a fix. It proposes a counterfactual world capable of changing a belief.”

Click **Create Dream: Under coordinated attack**, review its impact probability, expected insight, and estimated Codex budget, then confirm the Dream.

### 3. Populate the Dream with bounded Subjects

Click **Enter attacker, investigator, and test engineer into Under coordinated attack**, then **Ask Codex to investigate coordinated password-reset abuse**.

Show Ariadne, Arthur, and Eames as attacker, investigator, and test engineer. Emphasise that Subjects operate inside one Reality; they are not sibling worlds.

In real mode these Subject charters are direct Codex subagent requests. Codex runs bounded investigations concurrently when capacity allows and waits for every Subject to return before synthesis.

Show the returned evidence:

- Account enumeration remains possible.
- IP counters do not share an identifier-level budget.
- The inherited belief loses confidence.

### 4. Descend one level deeper

Click **Create nested Dream: Rotating IP swarm**, review the narrower proposal, then confirm the nested Dream.

Say: “The remaining uncertainty is narrow enough for a nested Dream: one identifier, a new IP on every request.”

Click **Kick and return memory**.

Show the Wake Report and failing `rotating-ip.attack.spec.ts` artefact. Say: “The Dream returns memories, not raw reasoning.”

### 5. Wake the parent Dream

Click **Kick and return memory**.

Show its consolidated invariants and changed belief. Point out that parent-owned anchors remained immutable throughout both Dreams.

### 6. Synthesis and proof

Click **Synthesise returned memories into the Waking Reality implementation**.

Show the layered implementation: generic response, per-IP limit, identifier-level limit, and global circuit breaker.

Click **Run 3 parent-owned requirements**.

Pause on the three green anchor results:

- Enumeration-safe response
- Token expiry preserved
- Rotating-IP resistance

Click **Stabilise Waking Reality**.

### 7. Close on the differentiator

Show the full Reality tree, Memories panel, inherited evidence, and proof results. Click **Reveal code** only when discussing the final Git diff.

Drag the Reality Timeline through its narrative milestones to recap the complete run without replaying wall-clock Codex time. Detailed command, file, tool, and test events remain available in the filterable event stream. Return the timeline to **Live** before performing another Reality action.

Say: “Inception lets Codex explore assumptions in isolated software worlds, then wake with validated evidence that changes the implementation in the waking Reality.”

## Recovery

When no operation is active, click the labeled **Full reset** button and confirm, or run:

```bash
npm run demo:reset
```

The deterministic sequence can then be replayed from the beginning. Full reset archives the validated event log for retrospective analysis while removing all active Reality and worktree state.

If a Codex execution must be stopped first, open the gear menu, choose **Stop all Codex CLI**, then use **Full reset and cleanup**. These Admin controls are deliberately separate from the narrative UI.
