# Inception — Reality Engine

A working hackathon prototype for software-development agents that explore nested counterfactual realities called **dreams**.

Each Reality owns a premise, constitution, world history, evidence, Codex thread, and isolated Git worktree. A Dream is a child Reality. Bounded Codex sub-agents are represented as Subjects inside one Reality. Dreams wake with validated, structured memories rather than raw reasoning.

## Rehearsed demo

The built-in scenario explores an incomplete password-reset feature:

1. The waking Reality inspects the implementation.
2. It identifies uncertainty around per-IP rate limiting.
3. An **Under coordinated attack** Dream is created.
4. Attacker, investigator, and test-engineer Subjects enter.
5. They discover account enumeration and distributed abuse.
6. A nested **Rotating IP swarm** Dream creates a failing attack test.
7. Memories return through two validated Wake Reports.
8. The waking Reality synthesises the lesson, patches the fixture, and runs immutable anchor tests.
9. The UI reveals the Reality tree, inherited knowledge, anchor results, and final Git diff.

## Fast setup

Requires Node.js 22.5 or newer and Git.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The action dock names the exact next move, including whether it enters Codex, creates a Dream, returns memory, changes code, or runs anchors.

Mock mode is the default on a fresh clone. It is deterministic and requires no OpenAI credentials or generated Prisma client. The app persists to a local SQLite database and creates isolated worktrees under `.inception/worktrees`.

Use `npm run dev:mock` to force the rehearsed path when a local `.env` enables real mode.

Opening or refreshing the app does **not** start Codex or consume API usage. In real mode, a Codex CLI execution begins only after an explicit action such as **Ask Codex to audit and improve password-reset security** or **Kick** is clicked. Action text is composed from the active Reality's constitution, proposals, anchors, and scope rather than a phase-specific UI string. While Codex runs, the live operation band shows wall-clock duration, safe command/tool/file milestones, and a refresh-stable busy state.

## Prisma-backed persistence

The repository includes a Prisma schema and `PrismaRealityRepository`. In normal networked development, generate the client and initialise the database once:

```bash
npm run db:generate
npm run db:push
```

The app automatically selects Prisma when the generated models are present. Set `INCEPTION_PERSISTENCE=prisma` to require Prisma and fail rather than fall back. The portable SQLite repository exists so the hackathon demo remains rehearsable when Prisma engine downloads are unavailable.

## Real Codex mode

### Existing Codex CLI login

The simplest real-mode path uses the judge or developer's own Codex login:

```bash
npm run codex:check
npm run dev:real
```

The SDK-spawned Codex CLI reuses the existing login from `${CODEX_HOME:-~/.codex}/auth.json`. Keep that OAuth file in the Codex home; do not copy its tokens into this project. Set `CODEX_HOME` only when the Codex home is non-standard.

### API key

Create a local `.env` from `.env.example`, set:

```bash
INCEPTION_CODEX_MODE="real"
CODEX_API_KEY="your-key"
```

`OPENAI_API_KEY` is also accepted when `CODEX_API_KEY` is unset. Then run `npm run dev:real`. The ignored `.env` never enters Git.

The real adapter uses one `@openai/codex-sdk` thread per Reality, persists its thread ID, resumes that thread on later interactions, sets the Reality worktree as `workingDirectory`, streams concise Zod-validated events, and requests a schema-constrained Wake Report. Real mode enables Codex multi-agent collaboration with up to six direct Subjects. When a Dream contains Subject charters, Codex is explicitly required to spawn those bounded investigations, run them concurrently when possible, wait for every return, and allow delegated jobs up to one hour. Every Codex-facing output is validated before persistence.

### Runtime administration

The gear button opens controls separate from the demo narrative. It lists active `codex exec` processes by PID, elapsed time, and working directory, and can stop them after confirmation. It also exposes the current validated event log and archived logs as JSON for retrospective analysis; raw model reasoning and raw Codex command output are never retained. **Full reset and cleanup** stops Codex, archives safe telemetry, deletes active state, removes registered and orphaned worktrees under `.inception/worktrees`, deletes their `inception/*` branches, prunes Git worktree metadata, and forms one clean waking Reality.

The labeled **Full reset** button in the action dock performs the same run/worktree cleanup without being confused with browser refresh and always requires confirmation.

## Browser QA

Playwright runs against production rendering in delayed mock mode on port `3100`, with a dedicated SQLite file. It never invokes Codex or uses an OpenAI API key.

```bash
npx playwright install chromium
npm run test:e2e
```

The suite covers desktop and mobile visual baselines, idle usage safety, exact action naming, refresh during an active operation, live timestamps and event filtering, reset confirmation, isolated Admin controls, the complete nested-Dream path, anchors, memories, and the final diff.

## Monorepo

- `apps/web` — Next.js App Router UI, API routes, and SSE
- `packages/domain` — entities, value objects, prompts, and Zod contracts
- `packages/orchestrator` — use cases, repositories, synthesis, and event bus
- `packages/codex-runtime` — deterministic mock and real Codex SDK adapters
- `packages/worktree-manager` — Git worktree lifecycle
- `demo/password-reset` — vulnerable fixture and immutable anchor tests

## Useful commands

```bash
npm test
npm run test:e2e
npm run typecheck
npm run build
npm run verify
npm run demo:reset
```

## Demo discipline

- Raw chain-of-thought is never displayed or persisted.
- Parent-owned Reality Anchors are immutable inside Dreams.
- The canonical mocked sequence is designed to complete reliably in under three minutes.
- Use **Memory returned** and **Reality stabilised** rather than transport or workflow terminology.
