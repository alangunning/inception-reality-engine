# Run exports

This directory contains credential-redacted Reality Engine exports that can be
used as judging evidence, replay fixtures, and future import fixtures.

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
SDK payloads, and hidden reasoning. It retains Codex thread IDs and absolute
worktree paths as execution provenance. A future importer must validate the
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
7773b4f9220405e514c269db77a5428c42c5eb507bd0382d71e9cfe85ca92d11  password-reset-real-stabilised-2026-07-20.json
ab0dee47aaa2d239ddf22d609299f2605845780a7afafc5b9ad0c0df78b5c4bf  password-reset-real-mission-history-2026-07-20.json
```
