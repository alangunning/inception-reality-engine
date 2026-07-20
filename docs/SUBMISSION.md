# OpenAI Build Week Submission

**Submission version:** 0.1.0
**Status:** Completed real run verified; recording and manual fields pending
**Track:** Developer Tools
**Last reviewed:** 2026-07-20

This document is the source of truth for the Devpost project description,
three-minute video, repository evidence, and final submission checklist.
[Demo Mission Runbook](../DEMO_RUNBOOK.md) owns operational preparation,
acceptance, preservation, and recovery. `JUDGING.md` owns
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

Software agents usually investigate, edit, and validate inside one shared
context. That creates a dangerous feedback loop: an unsupported assumption or
regression introduced deep in an agent workflow can influence every later
plan, test, and implementation, while the same context judges whether its own
change is correct. Teams need the exploratory power of Codex without allowing
one persuasive branch of work to silently become truth.

I built **Inception: Reality Engine**, a counterfactual runtime that lets Codex
dream before it changes a protected repository. The product turns the familiar
film concepts into enforceable software boundaries. **Reality** is the root
repository and its parent-owned requirements. Every **Dream** is an isolated
child Reality with its own premise, persistent Codex SDK thread, Git worktree,
history, and evidence. A **Nested Dream** explores uncertainty discovered inside
another Dream. Bounded **Subjects** are native Codex subagents that can inspect,
edit, run commands, and test at full power only inside their assigned world.

A **Kick** stops one Dream and returns a Zod-validated Wake Report containing
belief changes, evidence, invariants, artefacts, and remaining uncertainty. The
parent-owned **Totem Check** binds that Memory to the exact Git source state,
evidence lineage, descendant seals, immutable **Reality Anchors**, and any
sealed adversarial intervention. Unsupported Memory is quarantined. A
**Reality Mirror** compares sibling Dreams, admits shared invariants, and keeps
disagreement visible. Only verified Memory can ascend level by level; only
proof-backed synthesis can alter Reality.

The focused password-reset Demo Mission proves both directions of that gate in
four real Codex Realities. Codex finds that per-IP limiting still permits
rotating-source abuse and account enumeration. Two sibling Nested Dreams test
transactional-store failure and campaign spread. Mal, a bounded Adversarial
Subject, plants one two-line off-by-one regression while an independent
investigator is not told what changed. The Totem Check identifies the exact
fault, restores the baseline, and prevents the injected code from ascending,
while three evidence-backed Wake Reports and safe regression artefacts return.
Before synthesis, rotating sources deliver `12/12` reset attempts; afterward,
an atomic shared identifier budget delivers `3/12`, known and unknown accounts
receive the same public payload, nine regression tests pass, and all four
parent-owned Anchors survive.

The generalized VAmPI Mission proves this is not a hardcoded security scene. A
preserved real run explores an authorized local educational repository through
**15 isolated Realities, 14 Dreams, depth three, 44 native Subject returns, 115
evidence records, 14 verified Memories, and seven sibling Reality Mirrors**.
One sealed authorization fault is independently detected and contained. The
final synthesis removes an unscoped secret lookup, enforces owner-qualified
book access, fails closed on missing identities, preserves administrator-only
deletion, and adds 12 service-free authorization tests. The final Reality
records seven changed files; its judge-facing diff contains four product and
test files after excluding engine-owned controls. The immutable proof passes
before Reality stabilises.

Reality Engine is built with TypeScript, Next.js, `@openai/codex-sdk`, SQLite
with Prisma, Git worktrees, Server-Sent Events, Zod, Vitest, and Playwright.
Mission Control applies the runtime to trusted repositories with configurable
premises, Anchors, Subject charters, sibling strategy, Dream depth, dependency
bootstrap, and budgets. It runs deterministically without credentials for a
rehearsable recording, while real mode uses the judge's own Codex CLI login or
OpenAI API key and never starts usage until an explicit action.

## Three-Minute Video

### Recording Contract

- Publish a public YouTube video shorter than three minutes.
- Target a final duration of 2:50 to 2:58, leaving a safety margin.
- Record one clean, completed real Codex run through timeline replay. Use the
  VAmPI cut for maximum technical depth or password reset for the clearest
  impact story. Do not wait for live Codex during the recording.
- Do not use a run with visible validation, quota, or budget-retry detours as
  the primary take.
- Show one real GPT-5.6 model event, one persisted Reality-thread event, one
  native Subject event, and one containment event.
- Use captions, clean microphone audio, an uncluttered desktop, and no
  copyrighted music.
- Never show credentials, `auth.json`, raw model output, raw Subject messages,
  or hidden reasoning.
- Use the sticky chapter bar in its causal order: **Realities**, **Investigation**,
  **Totem Check**, **Memories**, then **Anchor Proof**. The detailed event archive
  remains the retrospective evidence layer; open individual milestones from the
  timeline or event stream only for the four required execution-evidence shots.

### Script Packages

The video must commit to one complete story. The
[VAmPI generalized Mission package](./demo/vampi/ACTOR_SCRIPT.md) is the
recommended competition cut because it most strongly proves technical depth,
counterfactual breadth, native Subject use, and generality. Use the
[password-reset package](./demo/password-reset/ACTOR_SCRIPT.md) when its cleaner
measured before/after story will survive recording and compression more
reliably. Do not combine both full narratives inside three minutes.

Each package separates silent actor directions from spoken narration and
includes sentence-level SRT subtitles. Both end at `02:58`. Their exact shared
timing source also drives an optional Playwright actor:

```bash
npm run demo:video -- --scenario vampi
npm run demo:video -- --scenario password-reset
```

See [Demo Video Packages](./demo/README.md) for rehearsal, silent video capture,
fast timing validation, and acceptance criteria.

### Required Evidence Shots

1. `gpt-5.6-sol`, SDK version, and real runtime badge.
2. One persisted Reality thread and its isolated worktree.
3. One native Subject child thread with terminal completion evidence.
4. Nested and sibling Dreams attached to their actual parent nodes.
5. Totem Check and one planted change contained.
6. Zero injected files or paths entered Reality.
7. Verified Memory returning through exact parent-child lineage.
8. Passing parent-owned Anchor proof after synthesis.
9. A measured outcome: password reset's `12/12` to `3/12`, or VAmPI's 12
   authorization tests and four-file judge-facing correction.
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
- keep the safe completed real-run export linked from the README;
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
