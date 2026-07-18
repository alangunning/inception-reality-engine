# ADR-0004: Automatic Memory Integrity and Bounded Adversarial Intervention

**Status:** Accepted
**Date:** 2026-07-18
**Applies to:** 0.1.0

## Context

A schema-valid Wake Report can still contain a false assumption, stale artefact, altered identity, or conclusion inherited from an unverified descendant. A deep memory must not influence the waking implementation merely because it is well-formed. Human approval at every Kick would make nested exploration slow and would not itself provide technical evidence.

## Decision

Every Kick creates an orchestrator-owned `MemoryIntegritySeal`. The seal binds the Wake Report digest to its source-state digest and Git checkpoint, compares parent and child anchor fingerprints, validates evidence and artefact resolution, and records the exact verified descendant-seal chain. The `memory-integrity/v2` policy has nine named checks. Synthesis recomputes report and lineage matches and requires the source worktree to remain clean at the sealed commit before admitting memory.

An optional operator-owned intervention contract may let one native Codex Subject inject a single reversible fault before investigator Subjects enter. The contract bounds fault class, paths, files, patch size, tokens, time, target depth, rollback, and reveal timing. An exact investigator diagnosis passes the integrity check; a partial or missed diagnosis quarantines the memory automatically.

## Consequences

- Deep memories have inspectable chain of custody across successive Kicks.
- Stale report mutation, descendant resealing, commit movement, and uncommitted post-Kick source edits are detected before synthesis.
- A controlled planted fault can test the engine without unbounded or unrelated chaos.
- Memory approval is evidence-driven and automatic rather than a repeated user prompt.
- Zod validation remains necessary but is explicitly not treated as semantic truth.
