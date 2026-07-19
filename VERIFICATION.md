# Verification

Verified on 18 July 2026 with Node.js 24.8.0. The repository requires Node.js 22.5.0 or newer.

## Clean-room clone simulation

A source-only copy was created without `.git`, `.env`, `node_modules`, build output, SQLite state, or Reality worktrees. From that directory:

```bash
npm ci --ignore-scripts
npm run verify
npm audit --omit=dev
```

Results:

- 5 Vitest files passed
- 22 tests passed
- strict TypeScript check passed
- Next.js production build passed
- all dynamic API routes built
- 0 dependency vulnerabilities
- no OpenAI credential was required

## Deterministic Demo Mission

The complete ten-action API sequence was executed against production code with real Git worktrees and Vitest commands.

- Final phase: 10
- Reality tree: Waking Reality -> Under coordinated attack -> Rotating IP swarm
- Separate mock Codex thread ID for every Reality
- Root-owned anchor ID preserved at both Dream depths
- Nested rotating-IP test executed and failed as expected before synthesis
- Two Zod-validated Wake Reports returned
- 47 concise Reality events persisted
- 31 state-changing events exposed as replayable timeline milestones
- Enumeration-safe response anchor passed
- Token expiry anchor passed
- Rotating-IP resistance anchor passed
- Final Git diff: 3,656 characters

## Real Codex authentication

`npm run codex:check` confirmed that real-mode authentication was available without copying or printing credentials. The command supports either the judge's existing ChatGPT login in `~/.codex/auth.json` or an API key. A complete real-mode browser run reported:

- Codex mode: real
- three persisted Codex threads across the Reality tree
- validated live Codex command, file, progress, and token events
- two schema-constrained Wake Reports
- a nullable optional artefact field normalised and Zod-validated before persistence
- all three immutable anchors passed
- final phase 10 with a 3,656-character Git diff

API-key mode accepts `CODEX_API_KEY` or `OPENAI_API_KEY` in the ignored local `.env`.

## Visual QA

Playwright Chromium was installed and the app was exercised against a production Next.js server in isolated mock mode.

- 6 browser tests passed; 4 duplicate long-flow mobile cases were intentionally skipped
- desktop idle-state screenshot baseline passed
- mobile idle-state screenshot baseline passed at 393px width
- no document or action-dock horizontal overflow
- first action names the Codex CLI effect before any usage begins
- Admin process view confirmed no Codex execution before an action
- active operation remained visible after browser refresh
- live events exposed wall-clock timestamps, safe metadata, search, filtering, and sort controls
- timeline replay remained renderable when its retained event window omitted the original creation event
- replay reduced the full stream to meaningful milestones and disabled live actions until returning to Live
- the reset confirmation could be dismissed without losing progress
- the complete ten-action path reached three Realities, two memories, three passing anchors, and a final Git diff
- the completed action dock returned to document flow without obscuring the inspector
- final stabilised desktop screenshot baseline passed
- Playwright and full verification used isolated Next output directories without disturbing a running real-mode app

Run the same checks with:

```bash
npx playwright install chromium
npm run test:e2e
```
