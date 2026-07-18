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
cp .env.example .env
npm run dev
```

Open `http://localhost:3000` and advance the scripted demo with the primary action, **Dream**, and **Kick** controls.

Mock mode is the default. It is deterministic and requires no OpenAI credentials or generated Prisma client. The app persists to a local SQLite database and creates isolated worktrees under `.inception/worktrees`.

## Prisma-backed persistence

The repository includes a Prisma schema and `PrismaRealityRepository`. In normal networked development, generate the client and initialise the database once:

```bash
npm run db:generate
npm run db:push
```

The app automatically selects Prisma when the generated models are present. Set `INCEPTION_PERSISTENCE=prisma` to require Prisma and fail rather than fall back. The portable SQLite repository exists so the hackathon demo remains rehearsable when Prisma engine downloads are unavailable.

## Real Codex mode

Set:

```bash
INCEPTION_CODEX_MODE=real
CODEX_API_KEY=...
```

The real adapter uses one `@openai/codex-sdk` thread per Reality, persists its thread ID, resumes that thread on later interactions, sets the Reality worktree as `workingDirectory`, streams concise safe events, and requests a schema-constrained Wake Report. Every Codex-facing output is validated with Zod before persistence.

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
