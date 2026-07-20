# Product Brief

**Product version:** 0.1.0
**Track:** Developer Tools
**Status:** Hackathon submission candidate
**Last reviewed:** 2026-07-19

## The Problem

Coding agents increasingly make changes across unfamiliar systems, but an agent can carry one incorrect assumption through planning, implementation, testing, and review. The same conversation that creates a change often judges whether the change is correct. By the time a hidden requirement is discovered, the branch, tests, and subsequent agent context may already depend on it.

The cost falls on:

- engineers reviewing a large or contaminated patch;
- maintainers responsible for requirements the agent never discovered;
- security teams investigating incomplete invariants;
- users affected by regressions or unsafe behavior;
- platform teams that cannot explain why an agent-authored change was admitted.

## The Product

Reality Engine turns one material uncertainty into isolated counterfactual software worlds. Codex may edit, test, and delegate freely inside each world, while Reality remains unchanged. A Dream returns only structured Memory: what it believed, what it experienced, what changed, which conclusions generalise, which artefacts reproduce the finding, and what remains uncertain. A Zod-validated Wake Report is the technical contract underlying that Memory.

The parent does not trust Memory because it is well written. The Totem Check binds it to evidence, source state, immutable requirements, artefacts, descendant Memories, and any sealed adversarial intervention. Invalid or unsupported Memory is quarantined automatically. Admitted Memories can be synthesised only after competing worlds are compared, and Reality's implementation must still pass parent-owned proofs.

## The Mental Model

| Product term | Meaning |
| --- | --- |
| **Reality** | One premise, constitution, history, Codex thread, and isolated worktree |
| **Dream** | A counterfactual child world created to experience one Uncertainty |
| **Subject** | A bounded Codex subagent investigating inside one Reality |
| **Kick** | Stop exploration and request structured Memory |
| **Memory** | Evidence-backed knowledge and safe artefacts proposed to a parent |
| **Totem Check** | Automatic parent-owned memory-integrity gate |
| **Reality Anchor** | Immutable requirement or proof a Dream cannot rewrite |
| **Reality Mirror** | Comparison of sibling Dreams: shared truth and disagreement |

This language makes a complex coding-agent workflow legible to non-specialists: isolated Dreams may discover or test ideas, but only verified memories may change Reality.

## Why Nested And Competing Dreams

A depth counter shows effort; a Reality graph shows alternatives. Each node in Reality Engine remains a real selectable world with its own Codex history and filesystem. Sibling Dreams experience materially different premises, while nested Dreams examine uncertainty discovered inside a parent world.

The Reality Mirror does not average sibling conclusions. It admits shared invariants, preserves disagreements as uncertainty, and shows the evidence coverage behind each conclusion. This prevents one persuasive Dream from silently becoming the truth.

## Adversarial Subject

The optional Adversarial Subject tests whether other Subjects can detect a sealed, code-level fault without being told what changed. The operator owns its allowed paths, protected paths, fault classes, patch size, time, token budget, target depth, and rollback checkpoint.

At Kick:

1. investigators report while the mutation is observable;
2. the private intervention ledger is revealed;
3. the Totem Check compares diagnosis with the actual mutation;
4. the orchestrator captures only independent investigator artefacts;
5. the pre-intervention checkpoint is restored;
6. every injected path is removed from the Wake Report;
7. a missed or partial diagnosis quarantines the memory.

An exact diagnosis admits the knowledge that generalises, never the planted code. This makes memory poisoning and regression resistance visible without requiring a human approval prompt at every Dream level.

## Product Experience

- collapsible parent-child graph with every Nested Dream and sibling Dream plus its bounded Subject nodes;
- current premise, constitution, runtime, worktree, and Codex thread;
- uncertainty, Subject, evidence, belief, memory, proof, and diff ledgers;
- live timestamped event stream with search, filtering, sorting, and event detail;
- plan snapshots and auditable native Subject lifecycle without hidden reasoning;
- simulated Dream time and replayable timeline for a three-minute explanation;
- staged Memory return: collect, seal, contain, return;
- Reality Mirror for shared invariants and explicit disagreements;
- bounded recording and guided-real auto modes that never start on page load;
- separate Admin controls for processes, logs, reset, cleanup, and saved Missions.

The password-reset Demo Mission provides a reliable first-run proof. Mission Control exposes the same complete experience for trusted local repositories, including the pinned VAmPI educational target.

## Measurable Outcome

The canonical completed run presents:

- **Before:** `12/12` rotating-source requests deliver a reset and public responses expose account existence.
- **After:** `3/12` requests deliver across two service instances sharing one identifier budget, and known/unknown public response payloads match.
- **Integrity:** one planted boundary mutation is rolled back and zero injected files ascend.
- **Proof:** four parent requirements plus returned regression artefacts pass.

Every run also records Memories verified or quarantined, adversarial faults detected or missed, injected artefacts excluded, Reality files changed, unresolved disagreements, retained post-budget uncertainty, and exact evidence/source lineage for each admitted conclusion.

The product claim is therefore inspectable: it should show which unsafe change was prevented, which requirement survived every world, and which tested improvement reached Reality.

## Product Boundaries

- It is a trusted local developer tool, not a hosted multi-tenant executor.
- Real mode remains fully capable inside Reality-owned worktrees.
- No Codex usage begins implicitly.
- No raw reasoning, raw model response, credential, or unrestricted SDK payload is persisted.
- Schema validity is not treated as truth; memory integrity and proof are separate gates.
- Dream depth, siblings, Subjects, actions, wall time, and observed tokens are bounded.
- Mock mode exists for recording and offline inspection; live Codex is the technical evaluation path.

For the implementation, see [Architecture](./ARCHITECTURE.md). For the exact judge flow, see the [Judge Guide](./JUDGING.md).
