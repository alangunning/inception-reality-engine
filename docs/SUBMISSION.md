# OpenAI Build Week Submission

**Submission version:** 0.1.0
**Status:** Recording-ready copy; final run evidence and manual fields pending
**Track:** Developer Tools
**Last reviewed:** 2026-07-20

This document is the source of truth for the Devpost project description,
three-minute video, repository evidence, and final submission checklist.
`DEMO_RUNBOOK.md` owns operational preparation and recovery. `JUDGING.md` owns
the live judge evaluation path. [Product Terminology](./TERMINOLOGY.md) owns
the vocabulary used by the script and UI.

The [official rules](https://openai.devpost.com/rules) and
[Build Week FAQ](https://openai.devpost.com/details/faqs) remain authoritative.
Before submission, the entrant should edit the description into their natural
voice and verify every claim against the final recorded run.

## Positioning

**Title:** Inception: Reality Engine

**Tagline:** Let Codex dream before it changes Reality.

**Primary claim:** Reality Engine lets Codex explore risky changes in isolated
software worlds, but only evidence-backed, proof-verified Memory can change the
protected repository.

The Inception metaphor is the product's explanation layer, not decoration. The
film provides a familiar model for nested worlds, injected participants,
planted ideas, Kicks, and a Totem Check that distinguishes trustworthy Memory.
Reality Engine translates those ideas into enforceable software boundaries.

Do not position the project primarily as a password-reset security tool or a
multi-agent dashboard. Password reset is the concrete proof of a general
counterfactual runtime for coding agents.

### Concept Translation

| Inception concept | Reality Engine meaning |
| --- | --- |
| Reality | The protected root repository and parent-owned requirements that must not be changed by an unverified Dream. The graph marks it **ROOT**. |
| Dream | A counterfactual child world with its own premise, persistent Codex thread, and isolated Git worktree. |
| Dream within a Dream | A Nested Dream created from uncertainty discovered inside its parent, without contaminating any world above it. |
| Subject | A bounded Codex subagent injected into one Dream with a specific role and independently auditable child thread. |
| Planted idea | A bad assumption, requirement, test, or code change that could silently influence higher levels if memory were trusted without proof. |
| Kick | Stop exploring one Dream and return structured Memory to its parent. |
| Totem Check | The product's adaptation of the film concept: an automatic parent-owned integrity check for source, evidence, artefacts, lineage, immutable requirements, and planted changes. |
| Reality Anchor | An immutable requirement or hidden proof inherited by every Dream but owned only by the parent. |
| Returning to Reality | Verified Memories and safe artefacts move upward level by level; only final synthesis and passing Anchors may change the protected repository. |

## Project Description

In Inception, an idea planted deep inside nested dreams can survive each return
toward reality and change it. Coding agents have an analogous failure
mode: an unsupported assumption or regression introduced deep in an agent
workflow can influence every later plan, test, and implementation. The same
agent context often creates the change and judges whether it is correct.

I built Reality Engine to turn that metaphor into a working safety architecture
for coding agents. Reality is the protected root repository, marked ROOT in the
graph. A Dream is an isolated counterfactual with its own premise, persistent
Codex SDK thread, and Git worktree. A Nested Dream explores uncertainty
discovered one level deeper. A Subject is a bounded native Codex subagent injected into that
world. Subjects can inspect, edit, run commands, and test at full power without
contaminating any Reality above them.

A Kick stops one Dream and proposes structured Memory to its parent: beliefs,
evidence, invariants, safe artefacts, and remaining uncertainty. The Totem
Check adapts the film's trust concept into an automatic integrity gate. It
binds that Memory to its exact Git source, evidence, descendant lineage, and
immutable parent-owned Anchors. Unsupported or planted Memory is quarantined;
verified Memory may return upward. A Reality Mirror compares sibling Dreams,
admits shared truth, and preserves disagreement.

The password-reset Demo Mission shows the complete flow. Codex discovers that
per-IP limiting still permits distributed abuse and account enumeration. Two
Nested Dreams test competing failure modes. Then Mal, an Adversarial Subject,
performs a deliberate inception attempt: it plants one bounded
regression deep in a child Dream while investigator Subjects remain unaware
of what changed. At the Kick, the Totem Check compares their independent
diagnosis with the actual Git mutation. It rolls back the planted code, excludes every
injected file, and allows only the independent regression test to return upward.

This proves both directions of the concept: poisoned Memory cannot influence
Reality, while useful discoveries and tested improvements can return through
every Dream level. GPT-5.6 then synthesises only verified Memories into
Reality's worktree. Before synthesis, rotating sources deliver 12 of 12 resets;
afterward, only 3 of 12 are delivered across two service instances sharing one
identifier budget. Known and unknown accounts receive the same response, the
planted mutation is contained, and all four immutable Anchors pass.

Reality Engine uses `@openai/codex-sdk`, native Codex Subjects, Git worktrees,
structured Memory, and proof-gated synthesis. Mission Control applies the same
engine to any trusted local repository with configurable premises, proofs,
Subject charters, sibling strategy, depth, and budgets.

## Three-Minute Video

### Recording Contract

- Publish a public YouTube video shorter than three minutes.
- Target a final duration of 2:50 to 2:58, leaving a safety margin.
- Record a clean, completed real Codex password-reset run through adaptive
  timeline replay. Do not wait for live Codex during the recording.
- Do not use a run with visible validation, quota, or budget-retry detours as
  the primary take.
- Show one real GPT-5.6 model event, one persisted Reality-thread event, one
  native Subject event, and one containment event.
- Use captions, clean microphone audio, an uncluttered desktop, and no
  copyrighted music.
- Never show credentials, `auth.json`, raw model output, raw Subject messages,
  or hidden reasoning.

### Shot And Narration Script

The script defines the Inception concepts before using the product vocabulary.
Rehearse at 135 to 140 words per minute and preserve the remaining time for UI
dwell, cuts, and short pauses around the measured outcome.

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00-0:22 | Open on the stabilised outcome and complete Reality graph. | "In the film Inception, an idea planted deep inside nested dreams can survive the return to reality and change it. Coding agents have the same failure mode: a bad assumption introduced deep in an agent workflow can infect later code, tests, and decisions. Reality Engine makes that risk visible and controllable." |
| 0:22-0:43 | Rewind to the single ROOT node, then reveal the first child edge. | "Reality is the protected repository, marked ROOT in the graph. A Dream is an isolated Codex thread and Git worktree. A Nested Dream explores uncertainty discovered one level down. A Subject is a bounded Codex subagent injected into that world." |
| 0:43-1:00 | Open the GPT-5.6 model event, persisted thread event, and real runtime badge. | "I built Reality Engine with Codex and GPT-5.6. Codex accelerated the architecture, SDK integration, debugging, and tests. At runtime, the Codex SDK powers this completed real run with persistent GPT-5.6 Reality threads." |
| 1:00-1:20 | Play the password-reset audit in Reality and first Dream creation. | "The starting belief is that per-IP rate limiting prevents password-reset abuse. Codex discovers that rotating sources can still target one account. Instead of changing Reality, the engine creates a Dream where that assumption can be experienced safely." |
| 1:20-1:41 | Expand the graph and open one native Subject event. | "Attacker, investigator, and test-engineer Subjects enter as native Codex child threads. Their evidence creates two deeper Dreams: one tests a shared abuse budget across service instances; the other tests account enumeration and boundary rollover." |
| 1:41-2:07 | Show Mal entering, the independent investigator, Totem Check, and containment result. | "The deliberate inception attempt happens here. Mal plants one bounded regression deep in a child Dream, while the investigators are not told what changed. A Kick stops that Dream and asks it to return Memory. The Totem Check compares that Memory with the actual Git mutation, evidence, source, and immutable requirements." |
| 2:07-2:27 | Show rollback, Memory ascent, and the Reality Mirror. | "The planted code is rolled back and zero injected files return upward. But the independently discovered regression test is safe, so that useful Memory survives the Kick. The Reality Mirror compares sibling Dreams, keeps shared truth, and preserves disagreement." |
| 2:27-2:47 | Show synthesis, four passing Anchors, outcome metrics, and final diff. | "Only verified Memory reaches Reality. Four parent-owned Anchors then prove the Dreams did not overwrite Reality's requirements. Before, rotating sources delivered twelve resets out of twelve. After, only three are delivered across two instances, and known and unknown accounts look identical." |
| 2:47-2:58 | Cut to Mission Control, then return to the stabilised graph. | "Mission Control applies this engine to any trusted repository. Good discoveries return as code; planted changes are contained before becoming Reality." |

### Required Evidence Shots

1. `gpt-5.6-sol`, SDK version, and real runtime badge.
2. One persisted Reality thread and its isolated worktree.
3. One native Subject child thread with terminal completion evidence.
4. Two sibling depth-two Dreams attached to their parent.
5. Totem Check and `1` planted change contained.
6. `0` injected files entered Reality.
7. Three verified Memories returning through their exact graph edges.
8. Four passing parent-owned Anchors, including the cross-instance budget.
9. The `12/12` before and `3/12` after outcome.
10. Final Reality Git diff and Mission Control generality.

## YouTube Package

**Proposed title:**

`Inception: Reality Engine - Let Codex Dream Before It Changes Reality`

**Proposed description:**

> Reality Engine is a counterfactual runtime for coding agents. It gives every
> Dream and Nested Dream its own Codex thread and Git worktree. It translates Dreams,
> Subjects, planted ideas, Kicks, and Totem Checks into enforceable software
> boundaries, then allows only evidence-backed, integrity-sealed
> Memory to reach the protected repository.
>
> Built with Codex and GPT-5.6 for the OpenAI Build Week Developer Tools track.
>
> Repository: https://github.com/alangunning/inception-reality-engine

Add the public instant-demo URL and final submission tag when available.

## Repository And Judge Path

**Repository:** https://github.com/alangunning/inception-reality-engine

**License:** Apache-2.0

**Real Codex evaluation:**

```bash
git clone https://github.com/alangunning/inception-reality-engine.git
cd inception-reality-engine
npm ci
codex login
npm run codex:check
npm run judge:demo
```

**Credential-free deterministic evaluation:**

```bash
npm ci
npm run record:demo
```

Before submission:

- commit and push the final verified worktree to `main`;
- create an immutable tag such as `v0.1.0-build-week`;
- add a stabilised dashboard screenshot below the README tagline;
- add top-fold links for the video, instant demo, real local mode, and
  architecture;
- link the safe completed real-run export from the README;
- publish a read-only deterministic replay URL when possible, while keeping
  local real mode as the technical evaluation path;
- verify `npm ci`, `npm run verify`, and `npm run test:e2e` from a clean clone.

## Codex And GPT-5.6 Evidence

The submission must show both build-time and runtime use:

- **Build time:** Codex and GPT-5.6 accelerated architecture inspection, SDK
  integration, failure analysis, implementation, test coverage, and visual QA.
- **Human decisions:** full-power real mode, no implicit usage, parent-owned
  Anchors, native Subject evidence, automatic memory integrity, adversarial
  intervention containment, sibling counterfactuals, and separate Admin
  controls.
- **Runtime:** the UI and safe event stream show `gpt-5.6-sol`, the SDK
  version, persisted Reality threads, native Subject threads, structured Wake
  Reports, and proof-gated synthesis.

See [Codex and GPT-5.6 Collaboration](./CODEX_COLLABORATION.md) for the complete
record.

## Feedback Session ID

Run `/feedback` in the primary Codex build thread and enter that exact Session
ID in Devpost. Application Reality IDs, Reality thread IDs, Subject thread IDs,
API keys, and exported runtime identifiers are not substitutes.

The Session ID is a manual submission field and must not be guessed:

`TBD - obtain from the primary Codex build thread`

## Final Checklist

- [ ] Developer Tools track selected.
- [ ] Project description edited into the entrant's natural voice.
- [ ] Every measured claim checked against the final clean real run.
- [ ] Public YouTube video is under three minutes and includes audio.
- [ ] Video visibly proves Codex and GPT-5.6 use.
- [ ] Public repository points to the exact recorded code.
- [ ] Apache-2.0 license remains present.
- [ ] Final changes are committed and pushed to `main`.
- [ ] Immutable submission tag is published.
- [ ] Clean-clone real and deterministic judge paths pass.
- [ ] Supported platforms and limitations are accurate.
- [ ] Instant judge-testing URL is added when available.
- [ ] `/feedback` Session ID is entered in Devpost.
- [ ] No credentials, raw reasoning, or private runtime data are submitted.

## Accuracy Language

- Use **model-reported estimate** for confidence, impact, and cost.
- Use **observed SDK token ceiling**, not provider billing cap.
- Use **validated** for schema conformance.
- Use **integrity sealed** only after the Totem Check passes.
- Use **verified** only after evidence or executable proof passes.
- Say the injected mutation never ascends. An exact diagnosis may return
  independent knowledge and safe investigator tests; a partial or missed
  diagnosis quarantines the Wake Report.
