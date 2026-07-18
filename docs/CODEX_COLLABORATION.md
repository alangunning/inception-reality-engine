# Codex and GPT-5.6 Collaboration

**Version:** 0.1.0
**Last reviewed:** 2026-07-18

## How Codex Accelerated the Build

Codex was used as the primary engineering collaborator across architecture inspection, domain modelling, runtime integration, failure analysis, implementation, testing, and visual QA. The work was built incrementally in one repository with timestamped Git history and the primary Codex session.

High-leverage contributions included:

- mapping the initial shell against the Reality/Dream/Wake contract;
- implementing strict Zod schemas and testing malformed model outputs;
- isolating `@openai/codex-sdk` behind a runtime port;
- tracing live CLI failures back to deleted worktree working directories;
- detecting that Playwright cleanup shared the live worktree namespace;
- enriching SDK events without persisting raw reasoning or raw tool output;
- building refresh-stable operation state and retrospective safe logs;
- validating nested Wake artefacts against executable proof;
- creating responsive Playwright coverage for the complete demo.

## Human Product and Engineering Decisions

The human owner made the decisions that define the product:

- preserve full-power real mode rather than reducing Codex to read-only;
- do not consume Codex or API usage on page load;
- treat password reset as the canonical proof, while adding a separate general Mission Composer;
- make Reality Anchors parent-owned and non-negotiable;
- require native Subject spawn/return evidence instead of trusting model-authored Subject reports;
- retain the timeline replay because it improves comprehension and compresses a three-minute demo;
- treat schema validation as necessary but insufficient, adding automatic memory-integrity seals and descendant lineage before synthesis;
- use a pinned VAmPI training target for the general security demo while keeping clone, execution, and Codex usage explicit;
- bound the chaos-engineer Subject with operator-owned paths, fault classes, budgets, rollback, and automatic quarantine rather than allowing unrelated mutation;
- keep Admin stop/reset controls outside the narrative UI;
- reject generic activity messages in favour of evidence-rich events.

## GPT-5.6 at Runtime

Real Reality threads default to `gpt-5.6` with high reasoning effort. The model is explicitly surfaced in the UI, Admin API, event stream, and runtime tests. `INCEPTION_CODEX_MODEL` exists for controlled compatibility testing; the submission default is GPT-5.6.

Codex is given the Reality constitution, history, evidence, anchors, Subject charters, and JSON output schema. It receives unrestricted file and command capability only inside the Reality worktree. The orchestrator, not the model, owns Dream creation, memory admission, artefact promotion, and stabilisation.

## Evidence for Submission

Use the following evidence with the Devpost entry:

1. The Git commit history created during the submission period.
2. The public repository and tagged release.
3. The `/feedback` Session ID from the Codex thread where most core functionality was built.
4. The demo video showing GPT-5.6 in the runtime badge and native Subject thread events.
5. Tests covering schemas, SDK event projection, worktree isolation, nested flow, and visual behavior.

Do not put Codex OAuth tokens, `auth.json`, API keys, raw session logs, raw reasoning, or application Reality thread IDs into the submission form. The `/feedback` build-session identifier must be obtained manually from the actual Codex build thread.
