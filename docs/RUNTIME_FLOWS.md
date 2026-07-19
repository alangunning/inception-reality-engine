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
  participant T as Reality Totem
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
  O->>T: seal report, source, anchors, evidence, artefacts
  T-->>O: verified depth-two memory
  Judge->>UI: Kick parent Dream
  C-->>O: validated parent memory
  O->>T: verify depth-two seal and seal parent memory
  T-->>O: verified descendant chain
  Judge->>UI: Synthesise
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
  W2 --> T2[Integrity seal L2]
  T2 --> R1
  R1 -->|validated memories and artefacts| W1[Wake Report]
  W1 --> T1[Integrity seal L1 includes L2]
  T1 --> R0
  R0 --> Proofs[Immutable anchors + returned regressions]
```

Child changes never flow directly into a parent branch. A validated Wake Report is only a memory proposal. The parent receives it after the automatic integrity gate binds report and source digests, confirms its inherited anchors, evidence and artefacts, and verifies every descendant seal. Synthesis applies only currently matching verified seals.

## Mission Composer

```mermaid
sequenceDiagram
  actor Developer
  participant M as Mission Composer
  participant O as MissionOrchestrator
  participant C as Codex GPT-5.6
  participant S as Native Subjects
  participant G as Target Git repository

  Developer->>M: Choose pinned VAmPI or trusted local repository
  opt Curated target
    Developer->>M: Prepare VAmPI locally
    M->>G: Clone allowlisted pinned revision
    Note over M,C: No install, server, traffic, or Codex call
  end
  Developer->>M: Define mission, premise, proofs, depth, Subjects
  M->>O: Form waking Reality
  O->>G: Create isolated root worktree
  Note over O,C: No Codex call yet
  loop Until depth budget or uncertainty resolved
    Developer->>O: Explicit next action
    O->>G: Checkpoint the active Reality
    O->>C: Review local source for the bounded maintenance task
    C-->>O: thread.started; persist resumable Reality thread
    C-->>O: Evidence, belief changes, Dream proposal
    alt Waking inspection or rejected contract
      O->>G: Restore checkpoint
    else Validated Dream inspection
      O->>G: Retain world-local changes
    end
    Developer->>O: Create Dream
    O->>G: Fork current Reality state
    opt Bounded intervention at configured depth
      Developer->>O: Run sealed intervention
      O->>G: Retain rollback checkpoint
      O->>C: Start fresh coordinator
      C->>S: spawn exact chaos-engineer Subject
      S-->>C: one bounded reversible mutation
      O->>G: validate diff and seal private commit
    end
  end
  Developer->>O: Kick deepest Dream
  C-->>O: Validated Wake Report
  O->>O: Verify Reality Totem and descendant seals
  alt Any integrity check fails
    O-->>M: Memory quarantined; uncertainty reopened
  else Integrity verified
    O-->>M: Memory may propagate
  end
  Developer->>O: Kick remaining Dreams
  Developer->>O: Synthesise memories
  O->>G: Recheck sealed commit and clean source worktree
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
  W[Schema-valid Wake Reports] --> T{Current integrity seals and lineage match?}
  T -->|No| X[Quarantine memory / reopen uncertainty]
  T -->|Yes| M[Admitted memories]
  M --> S[Synthesis in waking worktree]
  S --> A[Run parent-owned anchors]
  A --> R[Run returned regression artefacts]
  R --> P{Every proof passes?}
  P -->|No| F[Reality fracture / repair action]
  F --> S
  P -->|Yes| Z[Reality stabilised]
```
