# Operations

**Operations version:** 0.1.0
**Last reviewed:** 2026-07-20

## Supported Platforms

| Platform | Status |
| --- | --- |
| macOS 12.7+ x64/arm64 | Tested locally |
| Linux x64/arm64 | Supported by Node and Git; verify in CI |
| Windows native | Not verified |
| Windows via WSL2 | Expected; not verified |
| Browser | Current Chromium; responsive desktop/tablet Playwright coverage |

Runtime prerequisites are Node.js 22.15 or newer, npm, and Git with worktree support. The default VAmPI Mission additionally requires any available Python 3 exposed as `python3` or `python`; Reality Engine does not pin or replace the judge's Python interpreter. The password-reset Demo Mission does not require Python.

## Modes and Authentication

Clone and run live judge mode without Docker:

```bash
git clone https://github.com/alangunning/inception-reality-engine.git
cd inception-reality-engine
npm ci
codex login
npm run judge:demo
```

This reuses the judge's Codex CLI login at `${CODEX_HOME:-~/.codex}/auth.json`. For deterministic recording or credential-free offline inspection:

```bash
npm run record:demo
```

The runtime copies CLI authentication and current model metadata into the ignored `.inception/codex-home`, while keeping all writable session and SQLite state inside that project-owned directory. It does not inherit the user's `config.toml`, plugins, MCP servers, or unrelated session database. This prevents an unrelated integration, incompatible global CLI state, or unwritable home directory from stopping the SDK runtime while preserving each Reality thread across application restarts. Authentication defaults to `auto`: an explicit `CODEX_API_KEY`, otherwise valid CLI auth, otherwise `OPENAI_API_KEY`. Set `INCEPTION_CODEX_AUTH_MODE=cli` or `api` to override that choice. Credential contents are never committed, persisted in application data, emitted as events, included in Wake Reports, or exported in run logs.

Reality Engine does not check or pin the judge's globally installed Codex CLI version. The project SDK uses its own npm-installed compatible Codex executable and reports that resolved SDK version at runtime; the global installation supplies authentication through `~/.codex/auth.json`. This keeps a clone reproducible without coupling it to whichever Codex CLI release is installed on the machine.

For a Mission that deliberately depends on personal Codex integrations, set `INCEPTION_CODEX_INHERIT_USER_CONFIG=true`. Authenticate every enabled MCP first; its startup policy then applies to Reality executions.

## Usage Boundaries

- GET routes, page load, refresh, timeline replay, Admin inspection, and Mission creation do not call Codex.
- The canonical Demo Mission exposes **Start guided auto** in real mode. It is bounded by 20 actions and 180 minutes by default, persists its controller state, and pauses before new Dream premises, failed proof repair, fracture, validation rejection, safety refusal, or quota failure. Resume is explicit approval for the currently displayed gate.
- Training-target status is local-only; VAmPI is cloned only after **Prepare VAmPI locally** and is never installed or started automatically. Preparation adds a controlled fixture commit containing the dependency-free `tests/test_authorization_regression.py` baseline proof, a pinned `requirements-reality.txt`, and a proof runner that selects `.venv` when one has been parent-authorized. Its parent remains the exact pinned upstream revision.
- Buttons identify Codex-backed actions before usage begins.
- The operation band reports runtime, elapsed wall time, safe milestones, commands, tools, files, and token evidence.
- Subjective Dream time advances only when the orchestrator records a completed experience milestone. Operator idle time never advances it; the UI shows base milestone minutes, the Reality's dilation factor, resulting world-time, and live wall-clock operation time separately.
- General Missions default to a 30,000,000 observed SDK token ceiling, sized from the committed 24.4M-token depth-three evidence run. Codex reports authoritative input/output usage at turn completion; an over-ceiling report is rejected, its worktree transaction is rolled back, and new actions remain stopped. A custom Mission formed below the maximum can raise its ceiling from the guided-auto band without resetting Reality state; continuing remains a separate explicit action.
- Adversarial interventions default to the 500,000 observed-token hard ceiling because the reported turn usage includes the SDK's model context as well as the bounded Subject's output. The ceiling remains configurable, and any over-ceiling intervention is rolled back before its Memory can move upward to its parent.
- The observed ceiling is not a provider spend cap because the SDK does not expose incremental per-turn token cancellation. Use ChatGPT workspace or OpenAI API project spend controls for billing enforcement.
- Root inspection keeps full Codex write/test capability inside the isolated worktree, then restores its checkpoint so knowledge returns before implementation.
- An adversarial intervention is always rolled back at Kick. Injected paths are excluded before the Wake Report is sealed, so diagnosed bad code cannot become a returned artefact.
- Rejected inspection turns retain their resumable SDK thread ID, safe validation path/code, and rollback event without persisting raw model output.
- The curated VAmPI action is a bounded local source-maintenance task. If the model safety classifier still declines it, the run fractures without admitting a report or synthesising code; the recording-mode password-reset Demo Mission remains fully runnable without a model call.

## Reality-Local Dependencies

A Mission may declare one parent-authorized dependency environment and the Dream depth where it is required. Every matching Reality receives its own environment inside its own Git worktree. Child Dreams do not inherit ignored dependency directories, synthesis creates a separate environment in the root Reality, and worktree cleanup removes the environment with its owning Reality.

Python Missions:

- try `python3`, then `python`, and accept any available Python 3 version unless the Mission explicitly requires an exact version; they do not depend on `pyenv` or a machine-specific interpreter path;
- require a tracked manifest containing only exact `package==version` pins;
- require `.venv` to be ignored by Git and reject manifest or environment symlink boundaries;
- create `.venv` with the selected host interpreter, then run `.venv/bin/python -m pip --isolated`;
- download binary packages only from the approved PyPI index, without resolving undeclared transitive dependencies;
- never run a global `pip`, install Python, modify interpreter shims, or write packages outside the Reality worktree.

A third-party package can still be incompatible with a particular Python release. In that case the pinned install fails visibly before Codex runs, the host remains unchanged, and the parent can supply a compatible tracked lock manifest.

Node Missions:

- use the available `node` and `npm`, optionally checking an exact Node version without installing it;
- require a tracked `package-lock.json` with lockfile version 2 or newer;
- verify every downloaded package has an exact version, approved npm registry URL, and integrity digest; local workspace links must remain inside the Reality;
- require `node_modules` to be ignored, then run project-local `npm ci` with lifecycle scripts, audit, and funding calls disabled;
- keep npm's cache and bootstrap marker under that Reality's `node_modules`;
- never use a global npm install, change the host Node runtime, or reuse dependencies from a parent or sibling Dream.

The event stream records bootstrap start, result, selected runtime version, manifest SHA-256, package count, approved index, command, duration, and whether an existing environment was reused. A required bootstrap failure fractures that action before Codex, synthesis, or an immutable proof can continue. The same action remains retryable after the operator corrects the environment.

## Stop and Cleanup

Admin **Stop all Codex CLI**:

1. aborts every operation registered by the SDK adapter;
2. scans for remaining `codex exec` processes;
3. terminates those processes;
4. leaves persisted Reality state and worktrees available for diagnosis.

Admin **Full reset and cleanup** archives the current safe log, stops Codex, deletes the password-reset Demo Mission state, removes Demo Mission-owned worktrees/branches, prunes Git metadata, and creates a clean Reality.

The Admin **Mission Library** is available from Mission Control and every active Mission. The built-in password-reset Demo Mission can be opened, exported, and reset, but never deleted. User-created Missions can also be deleted individually or in bulk. Reset forms a replacement before removing previous user-created Mission history. User-created Mission reset and deletion remove only Mission-owned worktrees and branches; they never alter the password-reset Demo Mission. Bulk deletion scans only marked Mission directories under the configured Mission root. It ignores unmarked siblings and never recursively deletes the storage root itself.

Playwright uses its own database, canonical worktree root, Mission root, training-target root, and branch prefixes. Cleanup ownership is covered by unit and browser regression tests, while the isolated test roots keep live Mission worktrees outside every browser cleanup path.

Pinned training targets remain in `.inception/training-targets` as an ignored reusable cache. Removing that directory is safe when no Mission operation is active; it is not part of password-reset Mission cleanup because it contains no running process or admitted Reality state.

## Retrospective Logs

The Admin drawer exports the active Demo Mission run, user-created Mission, or archived run as JSON. An archived password-reset run can also be opened in the full Reality Engine as a read-only timeline. While that snapshot is open, live SSE updates and mutation controls are suspended; **Return to live Reality** reloads current persisted state. Exports and reopened runs include:

- Reality state and hierarchy;
- safe timestamped events;
- command name, exit code, and classified diagnostic;
- bounded credential-redacted plan steps and their status at each retained plan milestone;
- file paths, tool names, token counts, model binding, and selected authentication source;
- Subject name, role, child thread ID, collaboration tool, and terminal state;
- validation failures and recovery events;
- beliefs, evidence, Wake Reports, Totem Check seals, source/report digests, descendant lineage, Anchors, and final proof results.

They exclude raw reasoning, unrestricted SDK event payloads, raw Subject messages, credentials, and raw model responses.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `INCEPTION_CODEX_MODE` | `mock` or `real` |
| `INCEPTION_CODEX_MODEL` | Real-mode model override; default `gpt-5.6-sol` |
| `INCEPTION_CODEX_AUTH_MODE` | `auto`, `cli`, or `api`; default `auto` prefers explicit `CODEX_API_KEY`, then CLI auth, then `OPENAI_API_KEY` |
| `INCEPTION_CODEX_RUNTIME_HOME` | Optional isolated runtime-home path; default `.inception/codex-home` |
| `INCEPTION_CODEX_INHERIT_USER_CONFIG` | Opt in to personal Codex config, plugins, and MCPs; default `false` |
| `CODEX_HOME` | Source home for non-standard Codex CLI authentication |
| `CODEX_API_KEY` | Preferred explicit API credential |
| `OPENAI_API_KEY` | Fallback API credential |
| `DATABASE_URL` | SQLite URL |
| `INCEPTION_PERSISTENCE` | `prisma` or `sqlite` |
| `INCEPTION_REPO_ROOT` | Repository root override |
| `INCEPTION_WORKTREE_ROOT` | Canonical worktree root |
| `INCEPTION_MISSION_ROOT` | User-created Mission storage root; Playwright always overrides it |
| `INCEPTION_TRAINING_TARGET_ROOT` | Prepared training-target cache root; Playwright always overrides it |
| `INCEPTION_BRANCH_PREFIX` | Canonical branch prefix |

## Optional Container Packaging

Docker is not required for judges, contributors, mock mode, or real Codex mode. The container is an optional packaging path for an isolated production build of the deterministic mock experience.

Run:

```bash
npm run verify
npm run test:e2e
docker build -t inception-reality-engine:0.1.0 .
docker run --rm -p 3000:3000 inception-reality-engine:0.1.0
```

If a container release is useful, pushing tag `v0.1.0` publishes the GHCR image through `.github/workflows/release-image.yml`. The image is not part of the required judge setup.
