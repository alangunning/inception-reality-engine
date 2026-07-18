# Runtime Flows

**Flow version:** 0.1.0
**Status:** Hackathon submission candidate
**Last reviewed:** 2026-07-18

## Canonical Three-Level Flow

```mermaid
sequenceDiagram
  actor Judge
  participant UI
  participant O as RealityOrchestrator
  participant C as CodexRuntime
  participant S as Codex Subjects
  participant G as Git worktrees
  participant P as Proof gate

  Judge->>UI: Ask Codex to audit password-reset security
  UI->>O: inspect
  O->>C: inspect waking Reality
  C-->>O: validated InvestigationReport + uncertainty
  Judge->>UI: Create Under coordinated attack Dream
  O->>G: fork parent state
  Judge->>UI: Enter bounded Subjects
  O->>C: investigate Dream
  C->>S: spawn attacker, investigator, test engineer
  S-->>C: terminal bounded findings
  C-->>O: validated evidence + nested proposal
  Judge->>UI: Create Rotating IP swarm Dream
  O->>G: fork attack-Dream state
  Judge->>UI: Kick nested Dream
  O->>C: inspect and create decisive failing test
  O->>G: execute returned test
  O->>C: request WakeReport on same thread
  C-->>O: validated memory + test artefact
  Judge->>UI: Kick parent Dream
  C-->>O: validated parent memory
  Judge->>UI: Synthesize
  O->>G: promote returned artefacts
  O->>C: apply memories in waking thread
  Judge->>UI: Run immutable anchors
  O->>P: execute anchors and inherited regression
  P-->>O: proof results
  Judge->>UI: Stabilise
  O-->>UI: final diff, beliefs, memories, Reality tree
```

The nested attack artefact is not prewritten in real mode. The nested Reality must create a real test in its own worktree, retain it, and execute it. The orchestrator requires the pre-synthesis test to fail, proving that the counterfactual exposed a real missing invariant.

## Subject Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Chartered
  Chartered --> Entered: Reality owns Subject
  Entered --> NativeThread: completed spawn_agent with SUBJECT_ID
  NativeThread --> Investigating
  Investigating --> Returned: terminal wait = completed
  Investigating --> Failed: terminal wait = errored/interrupted
  Returned --> ValidatedReport: identity-bound SubjectReport
  Failed --> Rejected
  ValidatedReport --> [*]
```

The safe event stream exposes Subject name, role, state, collaboration tool, and child thread ID. It never exposes the spawn prompt, Subject raw response, or hidden reasoning.

## Worktree Inheritance

```mermaid
flowchart LR
  R0[Waking worktree] -->|tracked diff + untracked evidence| R1[Dream worktree]
  R1 -->|tracked diff + untracked evidence| R2[Nested Dream worktree]
  R2 -->|validated artefacts only| W2[Wake Report]
  W2 --> R1
  R1 -->|validated memories and artefacts| W1[Wake Report]
  W1 --> R0
  R0 --> Proofs[Immutable anchors + returned regressions]
```

Child changes never flow directly into a parent branch. Only a validated Wake Report identifies returnable artefacts; synthesis applies them in the waking worktree.

## Mission Composer

```mermaid
sequenceDiagram
  actor Developer
  participant M as Mission Composer
  participant O as MissionOrchestrator
  participant C as Codex GPT-5.6
  participant G as Target Git repository

  Developer->>M: Define mission, premise, proofs, depth, Subjects
  M->>O: Form waking Reality
  O->>G: Create isolated root worktree
  Note over O,C: No Codex call yet
  loop Until depth budget or uncertainty resolved
    Developer->>O: Explicit next action
    O->>C: Inspect current Reality
    C-->>O: Evidence, belief changes, Dream proposal
    Developer->>O: Create Dream
    O->>G: Fork current Reality state
  end
  Developer->>O: Kick deepest Dream
  C-->>O: Validated Wake Report
  Developer->>O: Kick remaining Dreams
  Developer->>O: Synthesize memories
  O->>C: Apply validated memories
  Developer->>O: Run immutable proofs
  O->>G: Execute structured proof commands
  O-->>M: Stabilised or repair required
```

## Refresh and Failure Recovery

- Active operation identity is server-owned; refreshing reloads it from the singleton.
- Every persisted event has wall-clock time, event family, Reality identity, and safe metadata.
- SDK operations and OS-level `codex exec` processes are separately visible in Admin.
- Admin stop first aborts SDK streams, then terminates remaining CLI processes.
- Contract failures become `validation.rejected`; they do not persist malformed model output.
- Missing worktrees are reconstructed from persisted parent state and artefacts.
- Full reset archives safe telemetry, stops Codex, deletes active canonical state, and cleans only canonical-owned worktrees.

## Stabilisation Gate

```mermaid
flowchart TD
  M[Returned memories] --> S[Synthesis in waking worktree]
  S --> A[Run parent-owned anchors]
  A --> R[Run returned regression artefacts]
  R --> Q{Every proof passes?}
  Q -->|No| F[Reality fracture / repair action]
  F --> S
  Q -->|Yes| Z[Reality stabilised]
```
