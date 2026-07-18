import { createHash, randomUUID } from "node:crypto";
import {
  MemoryIntegritySealSchema,
  type MemoryIntegrityCheck,
  type MemoryIntegritySeal,
  type Reality,
  type WakeReport
} from "@inception/domain";

export interface MemoryIntegritySealInput {
  reality: Reality;
  parent: Reality;
  report: WakeReport;
  realities: Reality[];
  inheritedMemories: WakeReport[];
  priorSeals: MemoryIntegritySeal[];
  sourceState: string;
  sourceCommit: string;
  artefactsResolvable: boolean;
  sourceStateValid?: boolean;
  descendantSourcesValid?: boolean;
  interventionOutcome?: "detected" | "partial" | "missed";
  sealedAt?: string;
}

export class MemoryIntegrityService {
  matchesReport(seal: MemoryIntegritySeal, report: WakeReport): boolean {
    return seal.realityId === report.realityId
      && seal.reportDigest === this.digest(JSON.stringify(report));
  }

  matchesSealedSource(
    seal: MemoryIntegritySeal,
    currentCommit: string,
    clean: boolean
  ): boolean {
    return clean && currentCommit === seal.sourceCommit;
  }

  quarantine(
    seal: MemoryIntegritySeal,
    failedCheck: MemoryIntegrityCheck["name"],
    summary: string,
    sealedAt = new Date().toISOString()
  ): MemoryIntegritySeal {
    const hasFailedCheck = seal.checks.some((check) => check.name === failedCheck);
    return MemoryIntegritySealSchema.parse({
      ...seal,
      id: randomUUID(),
      checks: [
        ...seal.checks.map((check) =>
          check.name === failedCheck
            ? { ...check, status: "failed" as const, summary }
            : check
        ),
        ...(hasFailedCheck ? [] : [{ name: failedCheck, status: "failed" as const, summary }])
      ],
      verdict: "quarantined",
      sealedAt
    });
  }

  matchesDescendantSeals(
    seal: MemoryIntegritySeal,
    reality: Reality,
    realities: Reality[],
    seals: MemoryIntegritySeal[]
  ): boolean {
    const expected = seals
      .filter((candidate) =>
        candidate.verdict === "verified"
        && this.isDescendantOf(realities, candidate.realityId, reality.id)
      )
      .map((candidate) => candidate.id)
      .sort();
    const recorded = [...seal.descendantSealIds].sort();
    return expected.length === recorded.length
      && expected.every((id, index) => id === recorded[index]);
  }

  seal(input: MemoryIntegritySealInput): MemoryIntegritySeal {
    const childAnchorFingerprint = this.anchorFingerprint(input.reality);
    const parentAnchorFingerprint = this.anchorFingerprint(input.parent);
    const evidenceIds = new Set(input.reality.evidence.map((entry) => entry.id));
    const referencedEvidenceIds = input.report.changedBeliefs.flatMap((change) => change.evidenceIds);
    const evidenceLineageValid = referencedEvidenceIds.every((id) => evidenceIds.has(id));
    const descendantRealityIds = input.realities
      .filter((candidate) => this.isDescendantOf(input.realities, candidate.id, input.reality.id))
      .map((candidate) => candidate.id)
      .sort();
    const descendantMemories = input.inheritedMemories.filter((memory) =>
      descendantRealityIds.includes(memory.realityId)
    );
    const descendantSeals = descendantMemories
      .map((memory) => {
        const descendantReality = input.realities.find((candidate) =>
          candidate.id === memory.realityId
        );
        return input.priorSeals.find((seal) =>
          seal.realityId === memory.realityId
          && seal.verdict === "verified"
          && this.matchesReport(seal, memory)
          && Boolean(descendantReality)
          && this.matchesDescendantSeals(
            seal,
            descendantReality!,
            input.realities,
            input.priorSeals
          )
        );
      })
      .filter((seal): seal is MemoryIntegritySeal => Boolean(seal));
    const descendantLineageValid = descendantSeals.length === descendantMemories.length
      && input.descendantSourcesValid !== false;
    const sourceStateValid = input.sourceStateValid !== false;
    const interventionValid = input.interventionOutcome === undefined
      || input.interventionOutcome === "detected";
    const checks: MemoryIntegrityCheck[] = [
      {
        name: "schema",
        status: "passed",
        summary: "Wake Report passed its Zod output contract before persistence."
      },
      {
        name: "identity",
        status: input.report.realityId === input.reality.id ? "passed" : "failed",
        summary: input.report.realityId === input.reality.id
          ? "Wake Report identity matches its source Reality."
          : "Wake Report identity does not match its source Reality."
      },
      {
        name: "report-digest",
        status: "passed",
        summary: "The complete validated Wake Report is bound to its SHA-256 digest."
      },
      {
        name: "source-state",
        status: sourceStateValid ? "passed" : "failed",
        summary: sourceStateValid
          ? "The source Reality is bound to its sealed Git commit."
          : "The source Reality changed after its memory was sealed."
      },
      {
        name: "anchor-fingerprint",
        status: childAnchorFingerprint === parentAnchorFingerprint ? "passed" : "failed",
        summary: childAnchorFingerprint === parentAnchorFingerprint
          ? "Parent-owned Reality Anchors retained their exact identity and commands."
          : "A child Reality no longer matches its parent-owned Reality Anchors."
      },
      {
        name: "evidence-lineage",
        status: evidenceLineageValid ? "passed" : "failed",
        summary: evidenceLineageValid
          ? "Every changed belief cites evidence retained in the source Reality."
          : "At least one changed belief cites evidence absent from the source Reality."
      },
      {
        name: "artefact-resolution",
        status: input.artefactsResolvable ? "passed" : "failed",
        summary: input.artefactsResolvable
          ? "Every returned artefact is safe, retained, or self-contained."
          : "At least one returned artefact cannot be safely resolved."
      },
      {
        name: "descendant-lineage",
        status: descendantLineageValid ? "passed" : "failed",
        summary: descendantLineageValid
          ? `${descendantSeals.length} descendant memor${descendantSeals.length === 1 ? "y has" : "ies have"} verified integrity seals and unchanged source state.`
          : "A descendant memory is unsealed, stale, or no longer matches its sealed source state."
      },
      {
        name: "intervention-diagnosis",
        status: interventionValid ? "passed" : "failed",
        summary: input.interventionOutcome === undefined
          ? "No sealed intervention was armed in this Reality."
          : interventionValid
            ? "Investigator Subjects exactly diagnosed the sealed intervention."
            : "Investigator Subjects did not exactly diagnose the sealed intervention."
      }
    ];
    return MemoryIntegritySealSchema.parse({
      id: randomUUID(),
      realityId: input.reality.id,
      parentRealityId: input.parent.id,
      reportDigest: this.digest(JSON.stringify(input.report)),
      sourceStateDigest: this.digest(input.sourceState),
      sourceCommit: input.sourceCommit,
      anchorFingerprint: childAnchorFingerprint,
      parentAnchorFingerprint,
      descendantSealIds: descendantSeals.map((seal) => seal.id).sort(),
      descendantRealityIds,
      checks,
      verdict: checks.every((check) => check.status === "passed")
        ? "verified"
        : "quarantined",
      policyVersion: "memory-integrity/v2",
      sealedAt: input.sealedAt ?? new Date().toISOString()
    });
  }

  private anchorFingerprint(reality: Reality): string {
    return this.digest(JSON.stringify(
      reality.anchors
        .map((anchor) => ({
          id: anchor.id,
          ownerRealityId: anchor.ownerRealityId,
          name: anchor.name,
          description: anchor.description,
          testCommand: anchor.testCommand,
          immutable: anchor.immutable,
          hidden: anchor.hidden
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    ));
  }

  private isDescendantOf(
    realities: Reality[],
    candidateId: string,
    ancestorId: string
  ): boolean {
    let candidate = realities.find((entry) => entry.id === candidateId);
    while (candidate?.parentId) {
      if (candidate.parentId === ancestorId) return true;
      candidate = realities.find((entry) => entry.id === candidate?.parentId);
    }
    return false;
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
