# Run exports

This directory contains credential-redacted Reality Engine exports that can be
used as judging evidence, replay fixtures, and future import fixtures.

## VAmPI real Mission

`vampi-real-mission-history-2026-07-20.json` is the complete, stabilised
general Mission snapshot for the authorized local VAmPI educational fixture.
`vampi-real-run-log-2026-07-20.json` is its standalone chronological event log.
Both replace the local repository and home paths with `$REPO_ROOT` and `$HOME`;
they contain no credentials, raw model responses, or hidden reasoning.

This run exercised 15 isolated Realities through Dream depth 3, 44 native
Subjects, 115 evidence records, 14 validated Wake Reports and integrity seals,
seven sibling-Dream reflections, and one detected and contained adversarial
intervention. The final root Reality admitted all 14 memories, passed its
immutable authorization proof, and stabilised after 45 guided actions. Codex
used `gpt-5.6-sol` through CLI authentication and recorded 24,393,379 observed
input-plus-output tokens.

The four-file result removes the unscoped book lookup, rejects missing
authenticated identities before access or mutation, introduces an
owner-qualified model boundary, changes book-title uniqueness to be per owner,
and adds 12 service-free authorization regression tests. Engine-owned
`.inception` constitution and anchor files are intentionally excluded from the
judge-facing Git diff.

This is an honest operational trace, not a fabricated clean replay. Of 185
terminal command events, 154 completed and 31 returned non-zero. Eleven were
deliberate failing-test evidence, ten exposed missing framework dependencies,
three referenced an absent proof or path, and three were test-harness errors;
the remainder were bounded exploratory command failures. The dependency
findings led directly to the Reality-local Python/Node bootstrap now used by
new Missions. One CLI quota fracture was explicitly recovered. Two synthesis
attempts were rejected by validation before any memory entered Reality; the
applied-memory contract, full-command policy validation, and sealed-worktree
recovery fixes are present in the committed engine. The final run has no
unresolved Dream proposals.

SHA-256:

```text
59f456722f43c759bad45d8843caf34b5363c4dc4b434140dbce808bd56f6bc1  vampi-real-mission-history-2026-07-20.json
4a3637c71062881a9ea4d8a8cb215d2414ace8446ce39e26844079c133a557cc  vampi-real-run-log-2026-07-20.json
```

## Password-reset real run

`password-reset-real-stabilised-2026-07-20.json` is a completed real-Codex run
of the Demo Mission in the canonical `RealityRunArchiveSchema` format.
`password-reset-real-mission-history-2026-07-20.json` is the corresponding
judge-facing mission snapshot returned by the password-reset Mission API. It
adds the active Reality, completed-operation state, and safe runtime binding
(`real`, `gpt-5.6-sol`, Codex SDK `0.144.6`, CLI authentication) used by the
rendered workspace.

Both contain four isolated Realities, two sibling Nested Dreams, seven native
Subject returns, three validated Wake Reports with nine-check integrity seals,
215 safe operational events, four passing immutable Anchors, a
four-file/nine-test regression result, and the final Reality Git diff. The
bounded Adversarial Subject changed one source file; the independent
investigator detected the exact fault, the mutation was contained, and no
planted artefact returned from that Dream.

The export deliberately excludes credentials, raw model responses, unrestricted
SDK payloads, and hidden reasoning. It retains Codex thread IDs as execution
provenance while replacing repository and home paths with `$REPO_ROOT` and
`$HOME`. A future importer must validate the
run archive with `RealityRunArchiveSchema` before persistence, validate the
mission snapshot's domain collections independently, remap paths to its local
repository, and treat unavailable thread IDs as historical evidence rather
than resumable threads. Import is not currently exposed in the product UI.

## Review verdict

This is a strong submission run: phase 10 completed without a Reality fracture
or validation rejection, every Dream proposal resolved, every Totem seal
verified all nine checks, and all four parent-owned requirements passed. The
implementation replaces account-specific responses with one generic response,
retains the IP throttle and token-expiry cap, and adds an atomic shared
identifier budget proven across independent processes and abrupt transaction
owner termination.

The result intentionally does not claim production completeness. SQLite proves
local cross-process coordination on one shared database; a multi-host
deployment still needs an asynchronous shared store and a separately governed
campaign-wide budget. The demo adapter also uses normalized identifiers as
SQLite keys without retention cleanup, and the response-equivalence tests do
not measure timing. Production needs pseudonymised, bounded-retention keys and
timing-side-channel verification.
The returned campaign test makes that remaining uncertainty visible without
weakening the verified identifier-level fix.

The 215-event log records 35 terminal command attempts. Thirty completed; four
non-zero exits are correctly classified as intentionally failing test evidence,
and one exploratory path guess failed before the same Dream recovered and
returned verified Memory. There are no validation rejections, safety
refusals, unclassified runtime fractures, or unresolved Dream proposals.

SHA-256:

```text
861c5ed2f15d9d41a56178ed96073826fa08c324de5759c3b1dd9bd6aedf8193  password-reset-real-stabilised-2026-07-20.json
fc23c76146384c3ae0bafc610b6c5c5280eb5089a6f69218cf89e5213e01b684  password-reset-real-mission-history-2026-07-20.json
```
