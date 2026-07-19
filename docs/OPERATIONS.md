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

The runtime links that auth file and existing CLI session state into `.inception/codex-home`, but does not inherit the user's `config.toml`, plugins, or MCP servers. This prevents an unrelated or expired MCP login from stopping `codex exec` before a Reality begins while allowing persisted Reality thread IDs to resume. Alternatively set `CODEX_API_KEY` or `OPENAI_API_KEY` in `.env`. Credential contents are never committed, persisted in application data, emitted as events, included in Wake Reports, or exported in run logs.

For a Mission that deliberately depends on personal Codex integrations, set `INCEPTION_CODEX_INHERIT_USER_CONFIG=true`. Authenticate every enabled MCP first; its startup policy then applies to Reality executions.

## Usage Boundaries

- GET routes, page load, refresh, timeline replay, Admin inspection, and Mission creation do not call Codex.
- Training-target status is local-only; VAmPI is cloned only after **Prepare VAmPI locally** and is never installed or started automatically.
- Buttons identify Codex-backed actions before usage begins.
- The operation band reports runtime, elapsed wall time, safe milestones, commands, tools, files, and token evidence.
- The Mission setting defaults to an 8,000,000 observed SDK token ceiling. Codex reports authoritative input/output usage at turn completion; an over-ceiling report is rejected, its worktree transaction is rolled back, and new actions remain stopped.
- The observed ceiling is not a provider spend cap because the SDK does not expose incremental per-turn token cancellation. Use ChatGPT workspace or OpenAI API project spend controls for billing enforcement.
- Waking inspection keeps full Codex write/test capability inside the isolated worktree, then restores its checkpoint so knowledge returns before implementation.
- Rejected inspection turns retain their resumable SDK thread ID, safe validation path/code, and rollback event without persisting raw model output.
- The curated VAmPI action is a bounded local source-maintenance task. If the model safety classifier still declines it, the run fractures without admitting a report or synthesising code; the deterministic canonical judge path remains fully runnable without a model call.

## Stop and Cleanup

Admin **Stop all Codex CLI**:

1. aborts every operation registered by the SDK adapter;
2. scans for remaining `codex exec` processes;
3. terminates those processes;
4. leaves persisted Reality state and worktrees available for diagnosis.

Admin **Full reset and cleanup** archives the current safe log, stops Codex, deletes canonical active state, removes canonical-owned worktrees/branches, prunes Git metadata, and forms a clean waking Reality.

The Admin **Saved Missions** section is available from both Mission Composer and an active Mission. It can reopen or export a run, reset one run from the same validated definition, delete one run, or delete all saved Missions. Reset forms the replacement before removing the previous history. Mission reset and deletion remove only Mission-owned worktrees and branches; they never alter the canonical scenario.

Playwright cleanup uses its own root and prefix. No cleanup path should delete a worktree it does not own.

Pinned training targets remain in `.inception/training-targets` as an ignored reusable cache. Removing that directory is safe when no Mission operation is active; it is not part of canonical reset because it contains no running process or admitted Reality state.

## Retrospective Logs

The Admin drawer exports the active canonical run, active Mission, or archived run as JSON. An archived password-reset run can also be opened in the full Reality Engine as a read-only timeline. While that snapshot is open, live SSE updates and mutation controls are suspended; **Return to live Reality** reloads current persisted state. Exports and reopened runs include:

- Reality state and hierarchy;
- safe timestamped events;
- command name, exit code, and classified diagnostic;
- bounded credential-redacted plan steps and their status at each retained plan milestone;
- file paths, tool names, token counts, and model binding;
- Subject name, role, child thread ID, collaboration tool, and terminal state;
- validation failures and recovery events;
- beliefs, evidence, Wake Reports, Reality Totem seals, source/report digests, descendant lineage, anchors, and final proof results.

They exclude raw reasoning, unrestricted SDK event payloads, raw Subject messages, credentials, and raw model responses.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `INCEPTION_CODEX_MODE` | `mock` or `real` |
| `INCEPTION_CODEX_MODEL` | Real-mode model override; default `gpt-5.6` |
| `INCEPTION_CODEX_RUNTIME_HOME` | Optional isolated runtime-home path; default `.inception/codex-home` |
| `INCEPTION_CODEX_INHERIT_USER_CONFIG` | Opt in to personal Codex config, plugins, and MCPs; default `false` |
| `CODEX_HOME` | Source home for non-standard Codex CLI authentication |
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
