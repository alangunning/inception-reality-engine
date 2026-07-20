# Run exports

This directory contains credential-redacted Reality Engine exports that can be
used as judging evidence, replay fixtures, and future import fixtures.

## Password-reset real run

`password-reset-real-stabilised-2026-07-20.json` is a completed real-Codex run
of the Demo Mission. It contains four isolated Realities, three validated Wake
Reports, safe operational events, memory-integrity results, immutable anchor
results, and the final Reality Git diff.

The export deliberately excludes credentials, raw model responses, unrestricted
SDK payloads, and hidden reasoning. It retains Codex thread IDs and absolute
worktree paths as execution provenance. A future importer must validate the
entire payload before persistence, remap paths to its local repository, and
treat unavailable thread IDs as historical evidence rather than resumable
threads.

SHA-256:

```text
34b2404b8dd89e0d7ff5f85fa3f9e8d65ee6ee0f404c1a0aa0a09304d5d275d2
```
