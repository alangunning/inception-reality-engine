# Security

Reality Engine 0.1.0 is a trusted local developer tool.

## Execution Model

Real mode grants Codex writable command execution inside Reality-owned Git worktrees, enables network access, uses live web search, and does not ask for per-command approval. The SDK runs with `workspace-write`; Reality Engine additionally rejects explicit home-directory, root-filesystem, Git-ref, reflog, and sibling-worktree inspection before admitting the turn. This is deliberate: a Dream can experience and modify its counterfactual world fully without treating the rest of the host as evidence.

Do not expose real mode directly to an untrusted network. The prototype's action and Admin routes do not implement user authentication or multi-tenant authorization. The deterministic mock container is the appropriate public judging surface.

## Data Boundaries

- Codex-facing structured outputs are validated with Zod before persistence.
- Raw reasoning and raw SDK responses are never persisted or rendered.
- Safe event metadata is allowlisted and secret-shaped values are redacted.
- CLI authentication remains owned by the user's Codex home and is copied with private permissions into the ignored project runtime home; credential contents never enter application persistence, events, or exports.
- Personal Codex configuration, plugins, and MCP servers are isolated by default. `INCEPTION_CODEX_INHERIT_USER_CONFIG=true` deliberately widens that trust boundary.
- A Dream cannot mutate parent-owned Anchors.
- Wake artefact paths must remain inside the Reality worktree.
- Every admitted Wake Report must retain a matching SHA-256 report digest, source-state digest, source commit, parent anchor fingerprint, evidence/artefact checks, and verified descendant-seal chain.
- Synthesis rejects missing, quarantined, stale, or lineage-mismatched memory seals and rechecks that every source worktree is clean at its sealed commit.
- A sealed adversarial intervention is rolled back when it exceeds its operator-owned contract; its Wake Report is quarantined unless investigator Subjects exactly diagnose the adversarial fault.
- Proof commands in Mission Composer are stored as an executable plus argument array, not an interpolated shell command.
- Parent-authorized Python dependencies install only into a Reality-local `.venv`; Node dependencies install only through an integrity-checked lockfile into Reality-local `node_modules`. Neither bootstrap installs a host runtime or global package.

## Repository Trust

Mission Composer should target repositories you trust. Repository tests and Codex-generated commands can execute arbitrary code within the configured workspace-write and network boundary. Git worktrees isolate branch state and the Codex sandbox limits ordinary filesystem writes, but this prototype is not a hardened multi-tenant security boundary.

The curated VAmPI preset is deliberately vulnerable and is intended only for authorized local training. Preparation clones a pinned source revision but does not install dependencies, run a server, or execute the target. Do not point Subjects at public deployments, real accounts, real credentials, or third-party systems.

## Reporting

For the hackathon submission period, report a security issue privately to the repository owner rather than opening a public issue containing credentials, tokens, exploit payloads, or private Codex session data.
