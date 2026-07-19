# Inception: Reality Engine

**Developer Tools | OpenAI Build Week | Submission candidate 0.1.0**

Reality Engine lets Codex test a risky software assumption in nested, isolated worlds before it can change the waking repository. Every **Reality** owns a premise, constitution, evidence history, Codex thread, and Git worktree. A child Reality is a **Dream**; a bounded Codex subagent is a **Subject**; a **Kick** returns a schema-validated memory.

This is not a multi-agent dashboard. It is a proof-gated counterfactual runtime for software decisions.

## Why It Matters

Coding-agent mistakes are paid for by engineers reviewing polluted branches and by users experiencing missed requirements, security defects, and regressions. A normal agent often proposes, implements, and judges a change in one conversation and one filesystem.

Reality Engine makes the uncertainty explicit, explores competing outcomes away from the waking branch, and admits only evidence-backed memories and artefacts. Parent-owned **Reality Totems** quarantine planted or unsupported memory automatically. Immutable **Reality Anchors** must pass before good changes can stabilise.

The result is simple to understand without knowing Codex orchestration or Git worktrees: Dreams can affect Reality only after they wake with verified memory.

## Nested Reality Graph

```mermaid
flowchart LR
  W["Waking Reality<br/>thread + worktree"] --> A["Dream A<br/>coordinated attack"]
  W --> B["Dream B<br/>competing premise"]
  A --> A1["Nested Dream A.1<br/>rotating sources"]
  A --> A2["Nested Dream A.2<br/>enumeration"]
  B --> B1["Nested Dream B.1<br/>recovery load"]
  X["Controlled adversarial Subject"] -. "sealed, bounded mutation" .-> A1
  A1 -. "Kick: verified or quarantined memory" .-> A
  A2 -. "Kick: verified memory" .-> A
  B1 -. "Kick: verified memory" .-> B
  A -. "Kick" .-> M["Reality Mirror<br/>shared invariants + disagreements"]
  B -. "Kick" .-> M
  M -->|"synthesise shared truth"| W
  W --> P["Immutable proofs"]
  P --> S["Reality stabilised"]
```

The UI renders this complete parent-child graph, including sibling Dreams, nested Dreams, the exact path of returning memory, and quarantined branches. A controlled Subject's mutation is rolled back and excluded before memory can ascend; only independently evidenced knowledge and safe test artefacts can reach the parent.

## Run It Live

Requires Node.js 22.5+, npm, Git, and either the judge's Codex CLI login or an API key. Docker is not required.

```bash
git clone https://github.com/alangunning/inception-reality-engine.git
cd inception-reality-engine
npm ci
codex login              # skip if already authenticated or using an API key
npm run judge:demo
```

Open [http://localhost:3000](http://localhost:3000). `judge:demo` starts full-power real Codex mode with GPT-5.6 and the judge's own authentication. An ignored `.env` may instead contain `CODEX_API_KEY` or `OPENAI_API_KEY`.

Page load, refresh, timeline replay, Admin, and Mission creation never start Codex. Usage begins only after an explicit Codex-backed action.

For the repeatable three-minute recording or credential-free UI evaluation:

```bash
npm run record:demo
```

Recording mode is deterministic but uses the same domain, worktree, memory-integrity, event, and UI contracts. Live mode is the recommended technical evaluation.

## What To Try

The immutable password-reset **Demo Mission** is the fastest complete story:

1. inspect an incomplete password-reset boundary;
2. create **Under coordinated attack**;
3. observe attacker, investigator, and test-engineer Subjects;
4. enter **Rotating IP swarm**, then Kick through both Dream levels;
5. synthesise verified memory, run immutable proofs, and inspect the final diff.

**Mission Control** applies the same engine to a trusted local Git repository. Its default is a pinned VAmPI educational fixture, competing sibling Dreams, editable Subject charters, structured proofs, bounded guided auto mode, and an optional controlled resilience Subject. Forming a Mission creates isolated Git state but makes no Codex call.

Judges can inspect:

- one persisted Codex SDK thread and Git worktree per Reality;
- native Subject evidence from SDK collaboration items or Codex's thread registry and structural task completion;
- branching topology, sibling comparison, staged Kicks, and memory ascent;
- automatic intervention rollback, artefact exclusion, and memory quarantine;
- cursor-paged live events, exact plan snapshots, usage evidence, and replay;
- proof-gated synthesis, final beliefs, inherited knowledge, and Git diff.

No raw chain-of-thought, raw model response, credentials, or unrestricted SDK payload is persisted or rendered.

## Verify

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run verify
```

Playwright uses production rendering, dedicated SQLite/worktree state, and deterministic Codex fixtures. Visual release targets are current Chromium on desktop and tablet.

## Documentation

- [Product brief](./docs/PRODUCT.md): audience, problem, mental model, value, and product experience.
- [Demo runbook](./DEMO_RUNBOOK.md): current desktop/tablet recording sequence, narration, and recovery.
- [Judge guide](./docs/JUDGING.md): live setup, three-minute script, evaluation map, and submission checklist.
- [Architecture](./docs/ARCHITECTURE.md): package boundaries, trust model, persistence, and diagrams.
- [Runtime flows](./docs/RUNTIME_FLOWS.md): Subjects, worktree inheritance, Kicks, siblings, synthesis, and recovery.
- [Operations](./docs/OPERATIONS.md): auth, usage, process control, cleanup, environment, and platforms.
- [Codex collaboration](./docs/CODEX_COLLABORATION.md): GPT-5.6 contribution, human decisions, and submission evidence.
- [Security](./SECURITY.md): trusted-local threat model for unrestricted real mode.
- [Documentation index](./docs/README.md): all versioned project documents and ADRs.

## Codex Collaboration

Codex and GPT-5.6 were the primary engineering collaborators for architecture inspection, SDK integration, implementation, failure analysis, tests, and desktop/tablet visual QA. The human owner made the product-defining decisions: full-power real mode, no usage on page load, parent-owned anchors, native Subject proof, automatic memory integrity, controlled intervention containment, sibling counterfactuals, and a separate Admin boundary.

The Devpost `/feedback` Session ID must be taken manually from the primary Codex build session; application Reality thread IDs are not substitutes. See the [full collaboration record](./docs/CODEX_COLLABORATION.md).

## Support And License

Tested locally on macOS 12.7+ x64/arm64 with current Chromium. Linux x64/arm64 is supported by Node.js and Git and should be verified in CI. Windows native is unverified; WSL2 is expected but unverified.

Licensed under [Apache License 2.0](./LICENSE).
