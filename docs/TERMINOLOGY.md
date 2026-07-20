# Product Terminology

**Status:** Authoritative
**Last reviewed:** 2026-07-20

This glossary is the source of truth for user-facing copy, events,
documentation, diagrams, narration, and screenshots. Internal type and field
names remain stable where changing them would break persisted data or public
contracts.

## Canonical Terms

| Concept | Product term | Usage |
| --- | --- | --- |
| Protected root repository | **Reality** | The codebase and requirements being protected and improved |
| Structural root marker | **ROOT** | A graph badge; never part of the Reality's name |
| Counterfactual child world | **Dream** | An isolated Codex thread and Git worktree |
| Dream inside another Dream | **Nested Dream** | A deeper counterfactual investigation |
| Selected graph node | **Current Reality** or **Current Dream** | Match the selected node's kind |
| Bounded Codex subagent | **Subject** | A specialist operating inside one Reality |
| Question worth isolating | **Uncertainty** | The unresolved assumption motivating a Dream |
| Proposed child investigation | **Dream Proposal** | A premise awaiting approval |
| Stopping a Dream | **Kick** | Ends exploration and requests structured Memory |
| Validated result crossing upward | **Memory** | Evidence-backed knowledge and safe artefacts proposed to a parent |
| Structured implementation contract | **Wake Report** | The Zod-validated record underlying Memory; use primarily in technical inspection |
| Immutable parent requirement | **Reality Anchor** | A proof a Dream cannot alter |
| Memory-integrity validation | **Totem Check** | Verifies source, evidence, lineage, Anchors, artefacts, and interventions |
| Rejected result | **Quarantined Memory** | Memory prevented from influencing its parent |
| Sibling comparison | **Reality Mirror** | Shows shared truth, disagreement, and evidence coverage |
| Applying validated results | **Synthesis** | Integrates admitted Memories and artefacts into Reality |
| Successful final state | **Reality stabilised** | Synthesis and every parent-owned proof passed |
| Failed state | **Reality fractured** | An operation or proof could not complete safely |
| Deliberate bounded disruption | **Adversarial Subject** | Tests whether investigators detect a sealed intervention |
| Configured investigation | **Mission** | The goal, repository, constraints, proof, and Dream policy |
| Mission configuration | **Mission Control** | Creates and configures Missions |
| Canonical password-reset example | **Demo Mission** | The polished, reproducible hackathon scenario |

## Canonical Actions

- **Create Mission**
- **Create Dream**
- **Enter Dream**
- **Approve Dream**
- **Kick: return memory**
- **Retry Subject**
- **Run Totem Check**
- **Quarantine Memory**
- **Synthesise memories**
- **Test Reality Anchors**
- **Return to Reality**
- **Replay Mission**
- **Reset Mission**
- **Delete Mission**
- **Full reset and cleanup**

## Canonical Events

- **Creating Dream.**
- **Subject entered.**
- **Uncertainty discovered.**
- **Evidence recorded.**
- **Intervention detected.**
- **Totem Check passed.**
- **Memory quarantined.**
- **Memory returned.**
- **Validated changes entered Reality.**
- **Reality Anchors passed.**
- **Reality stabilised.**

## Internal Contracts

The root is **Reality**, optionally accompanied by a **ROOT** badge. Memory
integrity is a **Totem Check**. **Wake Report** is the technical contract
underlying user-facing **Memory**.

Internal values such as `kind: "waking"`, `WakeReportSchema`, and
`MemoryIntegritySeal` are implementation contracts rather than UX labels.
Fresh run data must use the canonical terms above; the presentation layer does
not preserve aliases for deleted historical runs.
