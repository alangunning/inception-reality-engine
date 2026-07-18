# ADR-0003: Deterministic and Real Runtimes Share Contracts

**Status:** Accepted
**Date:** 2026-07-18
**Applies to:** 0.1.0

## Context

A hackathon demo must be reliable without credentials, while the product claim requires real Codex threads, file changes, commands, and subagents.

## Decision

The orchestrator depends on a `CodexRuntime` port. Mock and real adapters return the same validated investigation, Wake, synthesis, and safe-event contracts. The canonical flow works in both modes. Mission Composer is real-mode-only.

## Consequences

- Judges can run the full concept without API usage.
- Real mode retains full capability rather than becoming read-only.
- Deterministic events are labelled and cannot be confused with native Subject evidence.
- Contract tests apply across both runtimes.
