# Operations

**Operations version:** 0.1.0
**Last reviewed:** 2026-07-18

## Supported Platforms

| Platform | Status |
| --- | --- |
| macOS 12.7+ x64/arm64 | Tested locally |
| Linux x64/arm64 | Supported by Node/Git and release container; verify in CI |
| Windows native | Not verified |
| Windows via WSL2 | Expected; not verified |
| Browser | Current Chromium; responsive desktop/mobile Playwright coverage |

Runtime prerequisites are Node.js 22.5 or newer, npm, and Git with worktree support.

## Modes and Authentication

Mock mode is the default:

```bash
npm run dev:mock
```

Real mode reuses the judge's Codex CLI login at `${CODEX_HOME:-~/.codex}/auth.json`:

```bash
npm run codex:check
npm run dev:real
```

Alternatively set `CODEX_API_KEY` or `OPENAI_API_KEY` in `.env`. Credentials are never copied into the repository, database, events, Wake Reports, or exported run logs.

## Usage Boundaries

- GET routes, page load, refresh, timeline replay, Admin inspection, and Mission creation do not call Codex.
- Buttons identify Codex-backed actions before usage begins.
- The operation band reports runtime, elapsed wall time, safe milestones, commands, tools, files, and token evidence.
- Mission token budgets stop new actions after observed SDK usage reaches the configured limit.

## Stop and Cleanup

Admin **Stop all Codex CLI**:

1. aborts every operation registered by the SDK adapter;
2. scans for remaining `codex exec` processes;
3. terminates those processes;
4. leaves persisted Reality state and worktrees available for diagnosis.

Admin **Full reset and cleanup** archives the current safe log, stops Codex, deletes canonical active state, removes canonical-owned worktrees/branches, prunes Git metadata, and forms a clean waking Reality.

Mission deletion removes only that Mission's worktrees and branches. Playwright cleanup uses its own root and prefix. No cleanup path should delete a worktree it does not own.

## Retrospective Logs

The Admin drawer exports the current or archived run as JSON. Exports include:

- Reality state and hierarchy;
- safe timestamped events;
- command name, exit code, and classified diagnostic;
- file paths, tool names, token counts, and model binding;
- Subject name, role, child thread ID, collaboration tool, and terminal state;
- validation failures and recovery events;
- beliefs, evidence, Wake Reports, anchors, and final proof results.

They exclude raw reasoning, unrestricted SDK event payloads, raw Subject messages, credentials, and raw model responses.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `INCEPTION_CODEX_MODE` | `mock` or `real` |
| `INCEPTION_CODEX_MODEL` | Real-mode model override; default `gpt-5.6` |
| `CODEX_HOME` | Non-standard Codex CLI home |
| `CODEX_API_KEY` | Preferred explicit API credential |
| `OPENAI_API_KEY` | Fallback API credential |
| `DATABASE_URL` | SQLite URL |
| `INCEPTION_PERSISTENCE` | `prisma` or `sqlite` |
| `INCEPTION_REPO_ROOT` | Repository root override |
| `INCEPTION_WORKTREE_ROOT` | Canonical worktree root |
| `INCEPTION_BRANCH_PREFIX` | Canonical branch prefix |

## Release

Run:

```bash
npm run verify
npm run test:e2e
docker build -t inception-reality-engine:0.1.0 .
docker run --rm -p 3000:3000 inception-reality-engine:0.1.0
```

Push tag `v0.1.0` to publish the GHCR image through `.github/workflows/release-image.yml`.
