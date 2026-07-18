# ADR-0001: One Thread and Worktree per Reality

**Status:** Accepted
**Date:** 2026-07-18
**Applies to:** 0.1.0

## Context

A counterfactual exploration is not credible if its code mutations, conversation history, or assumptions leak into the waking world or a sibling Dream.

## Decision

Every Reality owns exactly one persisted Codex thread ID and one Git worktree. A child worktree inherits its parent's current tracked changes and untracked evidence at creation. Later mutations remain isolated. Cleanup roots and branch prefixes are owner-scoped.

## Consequences

- Later interactions resume the same world history.
- Nested experiments can change code without contaminating a parent.
- Wake artefacts require an explicit validated return path.
- Worktree recovery and lifecycle management are required operational behavior, not temporary scaffolding.
