# Judge Guide

**Guide version:** 0.1.0
**Target track:** Developer Tools
**Last reviewed:** 2026-07-20

## Recommended Evaluation - Live Codex, No Docker

The primary judging path uses the judge's own Codex CLI authentication and runs GPT-5.6 in full-power real mode:

```bash
git clone https://github.com/alangunning/inception-reality-engine.git
cd inception-reality-engine
npm ci
codex login              # skip if already authenticated
npm run judge:demo
```

Open `http://localhost:3000`. An ignored `.env` containing `CODEX_API_KEY` or `OPENAI_API_KEY` is the alternative to CLI auth. Opening, refreshing, creating a Mission, inspecting Admin, and moving the timeline never launches Codex. Each Codex-backed action is explicit.

For offline product inspection or a credential-free deterministic fallback:

```bash
npm run record:demo
```

Recording mode exercises the same domain and presentation contracts, but live mode is the technical-evaluation path. The recommended submitted-video workflow is to finish one fresh real run, export its safe history, and record the completed UI using adaptive timeline playback. Its eye control pauses on the current milestone and opens model, Reality-thread, native Subject, containment, or proof evidence directly; playback returns to Live after the final stabilisation hold. Docker and a prebuilt image are not required.

## Three-Minute Demo Script

The authoritative 2:57 shot list and word-for-word narration are in
[OpenAI Build Week Submission](./SUBMISSION.md#three-minute-video). The
submitted video uses adaptive replay from a clean, completed real run; it does
not wait for Codex operations on camera.

The narrative must visibly establish:

1. the Inception mental model is translated before product terms are used:
   Reality is the protected repository marked ROOT, Dreams are isolated
   counterfactuals, Subjects are injected Codex subagents, a Kick proposes
   Memory upward, and the Totem Check verifies that Memory;
2. one risky assumption becomes an isolated Dream;
3. native Subjects investigate two nested counterfactuals;
4. the Totem Check contains one planted change and admits zero injected
   files;
5. verified memories synthesise only through parent-owned proof;
6. the measurable outcome changes from `12/12` to `3/12` deliveries and all
   four Anchors pass;
7. Mission Control applies the same engine beyond password reset.

## Real Codex Evaluation

Use an existing Codex CLI login:

```bash
npm run codex:check
npm run dev:real
```

Or set `INCEPTION_CODEX_AUTH_MODE=api` with `CODEX_API_KEY`/`OPENAI_API_KEY` in an ignored `.env`. In the default `auto` mode, an explicit `CODEX_API_KEY` wins; otherwise a valid Codex CLI login wins over an ambient `OPENAI_API_KEY`. Real mode pins the exact `gpt-5.6-sol` model slug unless `INCEPTION_CODEX_MODEL` is explicitly set. It grants Codex unrestricted access inside Reality-owned worktrees and enables network access.

Reality Engine reuses the judge's CLI authentication while isolating personal Codex plugins and MCPs by default. This makes the evaluation reproducible even when the judge has unrelated integrations configured; `INCEPTION_CODEX_INHERIT_USER_CONFIG=true` is an explicit opt-in for missions that need them.

**Mission Control** is available at `/missions`. Its default is a pinned VAmPI repository-maintenance Mission for one documented ownership regression. Preparing that allowlisted target is explicit and makes no Codex call; creating a Mission creates only Git state. The first Codex execution begins after the explicit local source-review action. The prompt prohibits running a service or contacting targets, accounts, credentials, or network systems. The Adversarial Subject is enabled by default at Dream depth two, remains bounded to configured local paths, fault class, files, lines, tokens, time, and a rollback checkpoint, and can be disabled before creating the Mission.

The Mission Library lists the immutable password-reset Demo Mission beside user-created Missions. Password reset can be opened, exported, and reset but not deleted; user-created runs expose the full lifecycle. Every Mission opens in the same product shell and generalized runs also receive the Dream gate, Reality outcome, Reality Mirror, Memory-ascent view, staged Kick, and final diff. Click any event to inspect its exact time, IDs, safe metadata, validated payload, and the plan snapshot retained at that point.

## What to Inspect

- `packages/codex-runtime/src/real-codex-runtime.ts`: SDK threads, GPT-5.6 options, native Subject collaboration evidence, Zod output schemas.
- `packages/orchestrator/src/reality-orchestrator.ts`: Demo Mission nested flow, real nested test execution, Wake artefact promotion, anchors.
- `packages/orchestrator/src/mission-orchestrator.ts`: general real-mode engine.
- `packages/orchestrator/src/memory-integrity-service.ts`: report/source digests, anchor checks, descendant lineage, quarantine policy.
- `packages/worktree-manager/src/worktree-manager.ts`: inheritance and ownership-scoped cleanup.
- `packages/worktree-manager/src/training-target-manager.ts`: allowlisted pinned VAmPI preparation.
- `packages/domain/src/schemas.ts`: contracts persisted and rendered.
- `apps/web/e2e/reality-engine.spec.ts`: complete visual and interaction path.

## Judging Criteria Map

### Technological Implementation

- One persisted Codex SDK thread and Git worktree per Reality.
- GPT-5.6 with high reasoning and full worktree capability in real mode.
- Native Codex subagents must produce auditable spawn and terminal return events.
- Branching Reality graphs, competing Dream comparison, structured Wake Reports, automatic memory-integrity seals, adversarial-fault containment, stale-memory rejection, SSE, Prisma/SQLite, worktree recovery, and proof-gated synthesis.
- Mock and real modes use the same schemas and orchestration boundaries.

### Design

- The UI centres the branching Reality graph, current premise, Subjects, evidence, belief changes, dream-time, sibling reflection, memory ascent, proofs, and diff.
- Action names state who acts, what changes, and whether Codex usage begins.
- Refresh-stable operations, wall-clock timestamps, live filtering, adaptive high-signal timeline playback, usage visibility, and isolated Admin controls support first-time comprehension.

### Potential Impact

Coding-agent mistakes impose review cost, branch contamination, incomplete tests, security incidents, and user harm. Reality Engine makes the most expensive uncertainty explicit, explores it outside Reality's branch, and requires reproducible evidence plus parent-owned proof before adoption.

Initial users are security-sensitive engineering teams, maintainers reviewing agent patches, and platform teams governing coding-agent workflows. The password-reset scenario demonstrates an account-enumeration and distributed-abuse mistake. The VAmPI preset demonstrates authorized discovery and repair of known API vulnerabilities in a small open-source training repository; Mission Composer still accepts any trusted local repository and proof suite.

The canonical run quantifies what was prevented: rotating sources move from `12/12` reset deliveries to `3/12`, account responses become indistinguishable, one planted mutation is rolled back, zero injected files enter Reality, and four parent-owned requirements pass including a two-instance shared-budget proof.

### Quality of Idea

Reality Engine is not a multi-agent dashboard. Its novel unit is the counterfactual software world: premise, constitution, inherited truth, isolated filesystem, persistent agent Memory, bounded Subjects, a typed Kick transition, and an automatic Totem Check that prevents unverified deep Memory from silently reaching Reality's implementation. The parent retains epistemic and technical control without requiring repetitive human approval.

## Required Submission Checklist

- Public repository URL with Apache-2.0 license.
- Public YouTube demo under three minutes with audio.
- Description naming Developer Tools track.
- README with setup, sample scenario, Codex/GPT-5.6 collaboration, supported platforms, and judge instructions.
- `/feedback` Codex Session ID from the primary build session in the Devpost form. This is a manual submission field and is intentionally not inferred from application Reality thread IDs.
