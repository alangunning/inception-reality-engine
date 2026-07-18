# Judge Guide

**Guide version:** 0.1.0
**Target track:** Developer Tools
**Last reviewed:** 2026-07-18

## Fastest Reliable Evaluation

Requirements: Node.js 22.5+, npm, and Git.

```bash
git clone <submission-repository>
cd inception-reality-engine
npm ci
npm run dev:mock
```

Open `http://localhost:3000`. No account, key, Codex usage, Prisma generation, or external service is required. Opening and refreshing the app never launches Codex.

For a container release:

```bash
docker run --rm -p 3000:3000 \
  ghcr.io/<repository-owner>/inception-reality-engine:v0.1.0
```

The release workflow publishes tagged multi-architecture images. Until the public repository and owner are assigned, build the identical image locally with `docker compose up --build`.

## Three-Minute Demo Script

| Time | Action | Judge signal |
| --- | --- | --- |
| 0:00 | Show the waking Reality, one uncertain belief, three hidden anchors | Real problem and parent-owned requirements |
| 0:20 | Ask Codex to audit password-reset security | Explicit usage boundary; event stream begins |
| 0:40 | Create **Under coordinated attack** | Uncertainty becomes an isolated world |
| 0:55 | Enter and run attacker, investigator, test-engineer Subjects | Bounded parallel investigation |
| 1:15 | Create **Rotating IP swarm** | Nested counterfactual depth |
| 1:30 | Kick nested Dream | Failing test returns with a source-bound Reality Totem seal |
| 1:45 | Kick parent Dream | Its seal proves the verified depth-two lineage before invariants generalise |
| 2:00 | Synthesise returned memories | Knowledge changes the waking implementation |
| 2:20 | Run anchors and regression suite | Parent truth gates the agent |
| 2:35 | Stabilise, reveal memories and diff, move timeline | Complete product outcome and replayability |
| 2:50 | Show Mission Composer's VAmPI preset | Canonical scenario is evidence, not hardcoding |

## Real Codex Evaluation

Use an existing Codex CLI login:

```bash
npm run codex:check
npm run dev:real
```

Or set `CODEX_API_KEY`/`OPENAI_API_KEY` in an ignored `.env`. Real mode pins `gpt-5.6` unless `INCEPTION_CODEX_MODEL` is explicitly set. It grants Codex unrestricted access inside Reality-owned worktrees and enables network access.

Reality Engine reuses the judge's CLI authentication while isolating personal Codex plugins and MCPs by default. This makes the evaluation reproducible even when the judge has unrelated integrations configured; `INCEPTION_CODEX_INHERIT_USER_CONFIG=true` is an explicit opt-in for missions that need them.

The **Mission Composer** link appears in real mode. Its default is a pinned VAmPI repository-maintenance Mission for one documented ownership regression. Preparing that allowlisted target is explicit and makes no Codex call; creating a Mission creates only Git state. The first Codex execution begins after the explicit local source-review action. The prompt prohibits running a service or contacting targets, accounts, credentials, or network systems. The optional sealed intervention is off by default for VAmPI because its published defects already provide authorized counterfactual evidence.

Every saved Mission opens in the same product shell as the canonical scenario: branded live-status header, five-stage phase tracker, Admin runtime controls, fixed action dock, Reality topology, ledgers, timeline, Memories, proofs, event stream, and final diff. Click any event to inspect its exact time, IDs, safe metadata, validated payload, and the plan snapshot retained at that point.

## What to Inspect

- `packages/codex-runtime/src/real-codex-runtime.ts`: SDK threads, GPT-5.6 options, native Subject collaboration evidence, Zod output schemas.
- `packages/orchestrator/src/reality-orchestrator.ts`: canonical nested flow, real nested test execution, Wake artefact promotion, anchors.
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
- Three nested Reality levels, structured Wake Reports, automatic memory-integrity seals, stale-memory rejection, SSE, Prisma/SQLite, worktree recovery, and proof-gated synthesis.
- Mock and real modes use the same schemas and orchestration boundaries.

### Design

- The UI centres the Reality tree, current premise, Subjects, evidence, belief changes, dream-time, memories, proofs, and diff.
- Action names state who acts, what changes, and whether Codex usage begins.
- Refresh-stable operations, wall-clock timestamps, live filtering, timeline replay, usage visibility, and isolated Admin controls support first-time comprehension.

### Potential Impact

Coding-agent mistakes impose review cost, branch contamination, incomplete tests, security incidents, and user harm. Reality Engine makes the most expensive uncertainty explicit, explores it outside the waking branch, and requires reproducible evidence plus parent-owned proof before adoption.

Initial users are security-sensitive engineering teams, maintainers reviewing agent patches, and platform teams governing coding-agent workflows. The password-reset scenario demonstrates an account-enumeration and distributed-abuse mistake. The VAmPI preset demonstrates authorized discovery and repair of known API vulnerabilities in a small open-source training repository; Mission Composer still accepts any trusted local repository and proof suite.

### Quality of Idea

Reality Engine is not a multi-agent dashboard. Its novel unit is the counterfactual software world: premise, constitution, inherited truth, isolated filesystem, persistent agent memory, bounded Subjects, a typed wake transition, and an automatic Reality Totem that prevents an unverified deep memory from silently reaching the waking implementation. The parent retains epistemic and technical control without requiring repetitive human approval.

## Required Submission Checklist

- Public repository URL with Apache-2.0 license.
- Public YouTube demo under three minutes with audio.
- Description naming Developer Tools track.
- README with setup, sample scenario, Codex/GPT-5.6 collaboration, supported platforms, and judge instructions.
- `/feedback` Codex Session ID from the primary build session in the Devpost form. This is a manual submission field and is intentionally not inferred from application Reality thread IDs.
- Tagged `v0.1.0` release and matching container image.
