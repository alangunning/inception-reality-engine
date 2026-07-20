# Concept Fidelity Audit

This document tracks the Reality Engine against the canonical product conversation and the validated behavior that was added afterward. Passing the concept audit must not regress operational behavior that already makes real mode usable.

## Product identity

- A Reality is a premise, constitution, history, evidence set, Codex thread, and isolated Git worktree.
- A Dream is a counterfactual child world created only by the orchestrator after an explicit human decision.
- A Subject is a bounded Codex sub-agent inside one Reality.
- A Kick ends exploration and returns a validated Wake Report.
- The product presents evidence, artefacts, decisions, belief changes, and uncertainty, never hidden reasoning.
- Password reset remains the canonical deterministic proof case.

## Implemented fidelity

- One persisted/resumable Codex SDK thread and one worktree per Reality.
- Schema-constrained Investigation, Subject, Wake, and Synthesis reports with exact Reality identity.
- Native opportunistic Subjects are admitted only when their reports bind to a completed child through SDK collaboration items or Codex's thread registry and structural task completion.
- Real Codex inspection and synthesis; deterministic mock behavior behind the same ports.
- Transactional root inspection restores its isolated Git checkpoint after returning knowledge; rejected turns restore the checkpoint while retaining the resumable Reality thread.
- Parent filesystem snapshot inheritance, including tracked changes, deletions, and untracked evidence.
- Wake artefact promotion and complete diffs that include untracked files.
- Parent-owned immutable anchors plus a complete inherited regression proof.
- Automatic Totem Check seals binding each Memory to source state, parent Anchors, evidence, artefacts, and verified descendant lineage.
- Memory quarantine on stale digests, missing lineage, unresolved evidence/artefacts, or an incompletely diagnosed sealed intervention.
- An optional Adversarial Subject with operator-owned paths, fault classes, budgets, rollback, target depth, and delayed reveal.
- Automatic post-diagnosis containment: injected paths are excluded, the pre-intervention checkpoint is restored, and only safe independent artefacts can ascend.
- Competing sibling Dreams, a Reality Mirror evidence matrix, shared-invariant synthesis, and explicit disagreement retention.
- A scrollable branching Reality graph that keeps every nested and sibling world visible instead of presenting only maximum depth.
- Staged Memory-return presentation covering evidence collection, Totem Check sealing, containment, and upward return.
- Generalized Reality outcomes that quantify verified/quarantined Memories, injected faults detected, proofs passed, and Reality files changed.
- Explicit recording and guided-real auto modes with persisted bounds and pause gates; neither begins on page load.
- Append-only cursor-readable Mission event history with incremental SSE and a bounded UI window.
- A pinned VAmPI authorization-testing preset plus arbitrary trusted local repositories in Mission Composer.
- Failed proof blocks stabilisation and offers a real Codex repair action.
- Reality-local constitution, agent contract, and redacted anchor manifest.
- An observed SDK token ceiling rejects over-ceiling reports and stops later actions; provider billing controls remain the hard spend boundary.
- Dream impact probability, expected insight, token estimate, cost class, and explicit confirmation.
- Per-Reality runtime laws and 1x, 12x, and 120x time dilation.
- Live safe events with timestamps, filtering, search, sorting, failure classification, and archived export.
- Replayable Reality Timeline, Memories comparison, Reality Mirror, final Dream collapse, and explicit code reveal.

## Preserved operational behavior

- Opening or refreshing the UI does not start Codex or consume usage.
- Real mode accepts the user's Codex CLI OAuth login or an explicit API key.
- Real Codex retains full worktree permissions, network access, and long-running multi-agent jobs.
- Refresh restores persisted progress and active-operation visibility.
- Admin controls list and stop Codex CLI processes separately from the narrative UI.
- Full reset archives safe telemetry and removes active/orphaned worktrees and branches.
- Mock mode remains deterministic and usable on a clean clone without credentials.
- Production build, strict type checking, Vitest, and Playwright visual QA remain required.

## Scope decision

The password-reset example is a strong canonical demo because it gives a specific audience, visible uncertainty, executable evidence, and a measurable outcome. A password-reset-only engine may still make the underlying platform appear scenario-specific.

Implemented direction: password reset remains the default first-run proof, while real-mode Mission Composer accepts a curated VAmPI training target or a user-selected trusted repository, mission, anchors, budget, and maximum Dream depth. It remains a Reality/Dream/Subject/Wake product rather than a generic agent dashboard.

## Deferred ideas

- A fully blank first-run engine without a canonical proof case.
- Unbounded recursive depth or unbounded Codex spend.
- Unbounded sibling or unrelated agent graphs without a parent-owned synthesis policy.
- Architect/manager organizational hierarchies that replace Reality, Dream, Subject, and Wake semantics.
