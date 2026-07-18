# Concept Fidelity Audit

This document tracks the Reality Engine against the canonical product conversation and the validated behavior that was added afterward. Passing the concept audit must not regress operational behavior that already makes real mode usable.

## Product identity

- A Reality is a premise, constitution, history, evidence set, Codex thread, and isolated Git worktree.
- A Dream is a child Reality created only by the orchestrator after an explicit human decision.
- A Subject is a bounded Codex sub-agent inside one Reality.
- A Kick ends exploration and returns a validated Wake Report.
- The product presents evidence, artefacts, decisions, belief changes, and uncertainty, never hidden reasoning.
- Password reset remains the canonical deterministic proof case.

## Implemented fidelity

- One persisted/resumable Codex SDK thread and one worktree per Reality.
- Schema-constrained Investigation, Subject, Wake, and Synthesis reports with exact Reality identity.
- Real Codex inspection and synthesis; deterministic mock behavior behind the same ports.
- Parent filesystem snapshot inheritance, including tracked changes, deletions, and untracked evidence.
- Wake artefact promotion and complete diffs that include untracked files.
- Parent-owned immutable anchors plus a complete inherited regression proof.
- Failed proof blocks stabilisation and offers a real Codex repair action.
- Reality-local constitution, agent contract, and redacted anchor manifest.
- Dream impact probability, expected insight, token estimate, cost class, and explicit confirmation.
- Per-Reality runtime laws and 1x, 12x, and 120x time dilation.
- Live safe events with timestamps, filtering, search, sorting, failure classification, and archived export.
- Replayable Reality Timeline, Memories comparison, final Dream collapse, and explicit code reveal.

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

Recommended next direction, pending explicit approval: retain password reset as the default first-run path and add a separate real-mode Mission Composer for a user-selected repository, mission, anchors, budget, and maximum Dream depth. Do not replace the canonical demo or turn the main experience into a generic agent dashboard.

## Deferred ideas

- A fully blank first-run engine without a canonical proof case.
- Unbounded recursive depth or unbounded Codex spend.
- A global network of unrelated agent mirrors.
- Architect/manager organizational hierarchies that replace Reality, Dream, Subject, and Wake semantics.
