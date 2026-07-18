# AGENTS.md — Inception: Reality Engine

## Repository conventions

- TypeScript is strict across the monorepo.
- Domain types live in `packages/domain` and must not import framework, database, SDK, or UI code.
- Server orchestration lives in `packages/orchestrator` and depends only on explicit ports.
- Codex SDK details are isolated in `packages/codex-runtime`.
- Git commands and worktree lifecycle are isolated in `packages/worktree-manager`.
- The Next.js app is an adapter and presentation layer; it must not contain domain rules.
- Use the product language: **Creating dream**, **Subject entered**, **Memory returned**, **Reality stabilised**.
- Never expose hidden model reasoning. Persist only events, evidence, artefacts, decisions, belief changes, and validated summaries.

## Architecture boundaries

1. `packages/domain` has no outward dependencies beyond Zod.
2. `packages/orchestrator` owns use cases and repository/event-bus ports.
3. `packages/codex-runtime` implements the Codex port and may import `@openai/codex-sdk`.
4. `packages/worktree-manager` implements filesystem and Git isolation.
5. `apps/web` wires adapters together and renders the experience.
6. A child Reality may inherit parent evidence and anchors, but it may not mutate parent-owned anchors.
7. One Codex thread and one Git worktree are associated with each Reality.
8. Prisma is the production persistence adapter; the portable SQLite adapter may be used only to keep the deterministic demo functional when client generation is unavailable.

## Codex-facing safety contract

All Codex-facing output must be validated with Zod before persistence. A raw SDK response must never be written directly to SQLite, emitted through SSE, or rendered in the UI. Wake outputs must match `WakeReportSchema`. Invalid output is rejected and represented only as a concise validation event.

## Commands

- Install: `npm install`
- Develop deterministic demo: `npm run dev`
- Generate Prisma client: `npm run db:generate`
- Push Prisma schema: `npm run db:push`
- Test: `npm test`
- Type-check: `npm run typecheck`
- Production build: `npm run build`
- Full verification: `npm run verify`
- Clear demo state and worktrees: `npm run demo:reset`

## Demo discipline

The mocked sequence is the canonical hackathon path. Keep it deterministic, under three minutes, and functional without an API key. Real Codex mode is an enhancement behind `INCEPTION_CODEX_MODE=real`, not a dependency of the rehearsed demo.
