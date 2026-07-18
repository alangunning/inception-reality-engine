# Inception: Reality Engine

**Developer Tools | OpenAI Build Week | Submission candidate 0.1.0**

Reality Engine lets a coding agent explore a risky assumption in nested, isolated software worlds before that assumption changes the waking repository.

Each **Reality** owns a premise, constitution, history, evidence, Codex thread, and Git worktree. A child Reality is a **Dream**. Direct Codex subagents are identity-bound **Subjects**. A **Kick** stops exploration and proposes a Zod-validated **Wake Report** containing evidence, changed beliefs, invariants, test artefacts, and remaining uncertainty. A parent-owned **Reality Totem** automatically checks anchor identity, evidence, artefacts, descendant memory lineage, source state, and any sealed intervention before memory may propagate. Parent-owned **Reality Anchors** must then pass before the result can stabilise.

This is not a generic multi-agent dashboard. The product is a proof-gated counterfactual runtime for software decisions.

## Why It Matters

When coding agents make an incorrect assumption, engineers and users pay through review time, main-branch contamination, incomplete tests, security incidents, and production regressions. Ordinary agent workflows ask one thread to reason, implement, and judge its own work in the same world.

Reality Engine separates those responsibilities:

1. make the uncertainty explicit;
2. fork an isolated world where the assumption can be experienced;
3. delegate bounded independent investigations to auditable Subjects;
4. admit only integrity-sealed memory and reproducible artefacts;
5. synthesise what generalises in the waking worktree;
6. require immutable parent-owned proof before stabilisation.

The canonical scenario exposes account enumeration and rotating-IP abuse in an incomplete password-reset implementation. Real-mode **Mission Composer** applies the same mechanism to an arbitrary local Git repository, mission, proof suite, Subject roster, token budget, and Dream depth.

## Run in Two Commands

Requires Node.js 22.5 or newer, npm, and Git.

```bash
npm ci
npm run dev:mock
```

Open `http://localhost:3000`. Mock mode is deterministic, persists to portable SQLite, creates real Git worktrees, and requires no OpenAI account, API key, Prisma generation, or network call.

Opening, refreshing, replaying the timeline, or forming a Mission never starts Codex. Usage begins only after an explicit action whose label states that Codex will act.

Container:

```bash
docker compose up --build
```

Tagged releases publish `ghcr.io/<repository-owner>/inception-reality-engine:v0.1.0` for judge testing without a local Node toolchain.

## Canonical Demo

1. The waking Reality asks Codex to audit password-reset security.
2. Codex surfaces uncertainty around per-IP rate limiting.
3. **Under coordinated attack** is created in a child worktree and thread.
4. Attacker, investigator, and test-engineer Subjects enter.
5. Native Codex collaboration events prove each real Subject thread started and returned.
6. A nested **Rotating IP swarm** Dream creates and executes a failing attack test.
7. Each Kick seals the Wake Report to its source state and verified descendant-memory chain.
8. Returned artefacts and invariants are synthesised into the waking implementation.
9. Hidden anchors and the inherited regression suite run.
10. Final beliefs, memories, proof results, Reality tree, and Git diff remain replayable.

The deterministic path is rehearsable in under three minutes. The [judge guide](./docs/JUDGING.md) contains the exact video flow.

## Real GPT-5.6 and Codex

Reuse an existing Codex CLI login:

```bash
npm run codex:check
npm run dev:real
```

The SDK-spawned CLI reuses `${CODEX_HOME:-~/.codex}/auth.json` and existing session state through an ignored, project-owned Codex home. Personal `config.toml`, plugins, and MCP servers are not inherited, so an unrelated MCP login cannot break a Reality and persisted Reality thread IDs can still resume. Every judge or contributor uses their own local Codex login; no credential content is committed, persisted, or emitted.

API key alternative:

```bash
cp .env.example .env
# Set INCEPTION_CODEX_MODE=real and CODEX_API_KEY or OPENAI_API_KEY.
npm run dev:real
```

Real Reality threads default to **GPT-5.6** with high reasoning, unrestricted writes inside their Reality worktree, network access, and live web search. `INCEPTION_CODEX_MODEL` is an explicit compatibility override.

Set `INCEPTION_CODEX_INHERIT_USER_CONFIG=true` only when a Mission intentionally needs personal Codex plugins or MCP servers. Those integrations must be authenticated and can then affect Codex startup. `INCEPTION_CODEX_RUNTIME_HOME` optionally relocates the isolated home.

The real adapter:

- starts one `@openai/codex-sdk` thread per Reality;
- persists and resumes the thread ID;
- binds `workingDirectory` to that Reality's worktree;
- supplies constitution, history, evidence, anchors, Subjects, and a JSON schema;
- requires native `spawn_agent` plus terminal `wait` evidence for every active Subject;
- rejects model-authored Subject reports that lack a real child-thread trace;
- validates every investigation, synthesis, Wake Report, and safe event before persistence.
- requires a verified memory-integrity seal before synthesis can consume any Wake Report.

Real mode is intentionally not read-only. See [Security](./SECURITY.md) before exposing it beyond a trusted local machine.

## Mission Composer

In real mode, open **Mission Composer** from the top bar or visit `/missions/new`.

Define:

- the curated, pinned VAmPI training target or another trusted local Git repository;
- an absolute path to a trusted local Git repository;
- the mission, bounded scope, and initial belief to challenge;
- constitution constraints and parent truths;
- structured immutable proof commands;
- token and Dream-depth budgets;
- bounded Subject charters.

The default preset is [VAmPI](https://github.com/erev0s/VAmPI), a small deliberately vulnerable Flask API listed in the [OWASP CTF catalogue](https://ctf.owasp.org/). **Prepare VAmPI locally** is an explicit, no-Codex action that clones one pinned revision into `.inception/training-targets`; page load never clones, installs, starts, or sends traffic to the target. The curated Mission is framed as maintenance of one documented ownership regression using only the local source, local tests, and synthetic data. It never requests a service, external target, account, credential, or network interaction.

An optional sealed intervention can assign one native Codex Subject as a bounded chaos engineer. The operator owns its fault classes, allowed and protected paths, changed-file and patch limits, token/time budget, target depth, rollback commit, and reveal policy. The mutation is sealed before investigator Subjects enter. A partial or missed diagnosis quarantines the Wake Report automatically; an exact diagnosis allows it to join the descendant integrity chain.

Forming the waking Reality creates isolated Git state but makes no Codex call. Subsequent explicit actions can generate multiple nested Dreams, return integrity-sealed memories upward, synthesise the waking implementation, run proofs, repair failures, and stabilise.

Saved Missions reopen from the composer with the same branded header, phase tracker, Admin controls, action dock, topology, Reality inspector, uncertainty, Subject, evidence, memory, proof, event, timeline, and diff surfaces as the canonical scenario.

## Product Experience

- central Reality tree with visible Dream depth;
- current premise, constitution, world state, and simulated dream-time;
- live, timestamped, sortable and filterable safe event stream with clickable full event records and bounded plan snapshots;
- explicit native Subject thread state;
- evidence provenance and model-reported belief confidence;
- refresh-stable operation monitor and usage counters;
- timeline replay for demo compression and post-analysis;
- Memories comparison, immutable proof status, and final Git diff;
- Reality Totem checks, source/report digests, descendant seals, and automatic memory quarantine;
- separate Admin view for SDK operations, OS processes, safe logs, stop, archive, reset, and cleanup;
- read-only reopening of archived password-reset timelines without replacing or mutating the live Reality.

No raw chain-of-thought or raw model response is displayed or persisted.

## Architecture

```text
apps/web                    Next.js UI, APIs, SSE, composition
packages/domain             Framework-free entities and Zod contracts
packages/orchestrator       Use cases, ports, proof gates, repositories
packages/codex-runtime      Mock and real Codex SDK adapters
packages/worktree-manager   Git worktree inheritance and lifecycle
demo/password-reset         Canonical vulnerable fixture and anchors
```

Start with the versioned [architecture](./docs/ARCHITECTURE.md), [runtime flows](./docs/RUNTIME_FLOWS.md), and [documentation index](./docs/README.md).

## Persistence and Isolation

Generate the Prisma client when developing the production adapter:

```bash
npm run db:generate
npm run db:push
```

The app selects Prisma when generated models are available and otherwise uses the portable SQLite adapter. Both persist validated state and retrospective logs.

Canonical, Playwright, and Mission worktrees have separate roots and branch prefixes. Full reset cleans only canonical-owned Git state. Missing persisted worktrees are reconstructed from parent state and returned artefacts without consuming Codex.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run verify
```

Playwright uses production rendering, a dedicated SQLite database, mock mode, and a dedicated worktree namespace. It covers desktop/mobile visual baselines, no-usage idle state, refresh during operations, event controls, timeline replay, nested Dreams, time dilation, Memories, proof, reset, final diff, saved Mission reopening, and archived password-reset timeline navigation.

## Codex Collaboration

Codex and GPT-5.6 were used throughout architecture audit, implementation, SDK integration, root-cause analysis, testing, and visual QA. The human owner made the core product decisions around full-power real mode, explicit usage, parent-owned anchors, native Subject proof, canonical-versus-general flows, and safe event semantics.

The full collaboration account and submission evidence are in [Codex and GPT-5.6 Collaboration](./docs/CODEX_COLLABORATION.md). The Devpost `/feedback` Session ID must be taken manually from the primary Codex build session; application Reality thread IDs are not substitutes.

## Supported Platforms

- macOS 12.7+ x64/arm64: tested locally
- Linux x64/arm64: supported by the release container; CI verification required
- Windows native: unverified
- WSL2: expected but unverified
- Browser: current Chromium, desktop and mobile

See [Operations](./docs/OPERATIONS.md) for auth, usage, process control, logs, cleanup, environment variables, and release instructions.

## License

Apache License 2.0. See [LICENSE](./LICENSE).
