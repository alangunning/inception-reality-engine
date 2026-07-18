# Security

Reality Engine 0.1.0 is a trusted local developer tool.

## Execution Model

Real mode grants Codex unrestricted write and command access inside Reality-owned Git worktrees, enables network access, uses live web search, and does not ask for per-command approval. This is deliberate: the engine must let a Dream experience and modify its counterfactual world fully.

Do not expose real mode directly to an untrusted network. The prototype's action and Admin routes do not implement user authentication or multi-tenant authorization. The deterministic mock container is the appropriate public judging surface.

## Data Boundaries

- Codex-facing structured outputs are validated with Zod before persistence.
- Raw reasoning and raw SDK responses are never persisted or rendered.
- Safe event metadata is allowlisted and secret-shaped values are redacted.
- OAuth files and API keys remain outside the repository.
- A child Reality cannot mutate parent-owned anchors.
- Wake artefact paths must remain inside the Reality worktree.
- Proof commands in Mission Composer are stored as an executable plus argument array, not an interpolated shell command.

## Repository Trust

Mission Composer should target repositories you trust. Repository tests and Codex-generated commands can execute arbitrary code with the current user's permissions. Git worktrees isolate branch state; they are not an operating-system sandbox.

## Reporting

For the hackathon submission period, report a security issue privately to the repository owner rather than opening a public issue containing credentials, tokens, exploit payloads, or private Codex session data.
