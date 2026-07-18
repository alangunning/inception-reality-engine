# ADR-0002: Validated Memories Instead of Raw Reasoning

**Status:** Accepted
**Date:** 2026-07-18
**Applies to:** 0.1.0

## Context

Raw model transcripts are difficult to trust, unsafe to persist, and inappropriate as the contract between a child counterfactual world and its parent.

## Decision

Codex-facing outputs cross strict Zod contracts. A Wake Report contains initial beliefs, experiences, changed beliefs, invariants, artefacts, remaining uncertainty, and a recommendation. Raw reasoning, raw SDK responses, and raw Subject messages are discarded.

## Consequences

- Parents receive inspectable claims and reproducible artefacts.
- Contract failures are explicit events and block state transitions.
- The UI can replay concise evidence without exposing hidden reasoning.
- Schemas become a security and architecture boundary.
