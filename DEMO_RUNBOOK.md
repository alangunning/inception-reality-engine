# Inception — Three-Minute Demo Runbook

## Before presenting

```bash
npm install
cp .env.example .env
npm run demo:reset
npm run dev
```

Open `http://localhost:3000`. Keep mock mode enabled for the judged demo.

## Presentation sequence

### 1. Establish the waking Reality

Point to the central Reality graph, immutable anchors, initial belief, and isolated worktree.

Say: “This is not an agent dashboard. It is one software world with a premise, history, evidence, constitution, Codex thread, and Git worktree.”

Click **Inspect password reset**.

### 2. Surface uncertainty

Show the uncertainty card: whether per-IP rate limiting prevents abuse.

Say: “The agent does not immediately commit to a fix. It proposes a counterfactual world capable of changing a belief.”

Click **Dream: coordinated attack**.

### 3. Populate the Dream with bounded Subjects

Click **Subjects enter**, then **Run bounded investigations**.

Show Ariadne, Arthur, and Eames as attacker, investigator, and test engineer. Emphasise that Subjects operate inside one Reality; they are not sibling worlds.

Show the returned evidence:

- Account enumeration remains possible.
- IP counters do not share an identifier-level budget.
- The inherited belief loses confidence.

### 4. Descend one level deeper

Click **Dream: rotating IP swarm**.

Say: “The remaining uncertainty is narrow enough for a nested Dream: one identifier, a new IP on every request.”

Click **Kick rotating-IP Dream**.

Show the Wake Report and failing `rotating-ip.attack.spec.ts` artefact. Say: “The Dream returns memories, not raw reasoning.”

### 5. Wake the parent Dream

Click **Kick coordinated-attack Dream**.

Show its consolidated invariants and changed belief. Point out that parent-owned anchors remained immutable throughout both Dreams.

### 6. Synthesis and proof

Click **Return memories to waking Reality**.

Show the layered implementation: generic response, per-IP limit, identifier-level limit, and global circuit breaker.

Click **Run immutable anchors**.

Pause on the three green anchor results:

- Enumeration-safe response
- Token expiry preserved
- Rotating-IP resistance

Click **Stabilise Reality**.

### 7. Close on the differentiator

Show the full Reality tree, Memories panel, inherited evidence, and final Git diff.

Say: “Inception lets Codex explore assumptions in isolated software worlds, then wake with validated evidence that changes the implementation in the waking Reality.”

## Recovery

At any point, click **Reset Reality** or run:

```bash
npm run demo:reset
```

The deterministic sequence can then be replayed from the beginning.
