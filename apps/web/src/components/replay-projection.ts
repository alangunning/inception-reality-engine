import type {
  AdversarialInterventionLedger,
  AnchorResult,
  DreamReflection,
  MemoryIntegritySeal,
  MissionOutcome,
  Reality,
  RealityEvent,
  RegressionResult
} from "@inception/domain";

function eventMatchesIntervention(
  event: RealityEvent,
  intervention: AdversarialInterventionLedger
): boolean {
  return event.realityId === intervention.realityId
    && (
      event.payload.contractId === undefined
      || event.payload.contractId === intervention.contractId
    );
}

export function replayInterventions(
  interventions: AdversarialInterventionLedger[],
  visibleEvents: RealityEvent[],
  replaying: boolean
): AdversarialInterventionLedger[] {
  if (!replaying) return interventions;
  const cutoff = new Date(visibleEvents.at(-1)?.occurredAt ?? 0).getTime();
  const projected: AdversarialInterventionLedger[] = [];
  for (const intervention of interventions) {
    const events = visibleEvents.filter((event) =>
      event.type.startsWith("intervention.")
      && eventMatchesIntervention(event, intervention)
    );
    const armed = events.some((event) => event.type === "intervention.armed")
      || new Date(intervention.armedAt).getTime() <= cutoff;
    if (!armed) continue;
    const stage = events.slice().reverse().find((event) => [
      "intervention.armed",
      "intervention.started",
      "intervention.sealed",
      "intervention.rejected",
      "intervention.revealed",
      "intervention.contained"
    ].includes(event.type));
    const budgetApprovals = (intervention.budgetApprovals ?? []).filter((approval) =>
      new Date(approval.approvedAt).getTime() <= cutoff
    );
    const base = {
      id: intervention.id,
      contractId: intervention.contractId,
      realityId: intervention.realityId,
      armedAt: intervention.armedAt,
      budgetApprovals
    };
    if (!stage || stage.type === "intervention.armed") {
      projected.push({ ...base, status: "armed" });
      continue;
    }
    if (stage.type === "intervention.started") {
      projected.push({
        ...base,
        status: "injecting",
        startedAt: intervention.startedAt
      });
      continue;
    }
    if (stage.type === "intervention.rejected") {
      projected.push({
        ...base,
        status: "rejected",
        startedAt: intervention.startedAt,
        rejectionReason: intervention.rejectionReason
          ?? (typeof stage.payload.failure === "string"
            ? stage.payload.failure
            : "The adversarial intervention was rejected and its baseline restored."),
        rejectionCode: intervention.rejectionCode
          ?? (typeof stage.payload.rejectionCode === "string"
            ? stage.payload.rejectionCode
            : undefined),
        lastAttemptTokens: intervention.lastAttemptTokens
          ?? (typeof stage.payload.attemptTokens === "number"
            ? stage.payload.attemptTokens
            : undefined)
      });
      continue;
    }
    const sealed = {
      ...base,
      status: "sealed" as const,
      startedAt: intervention.startedAt,
      sealedAt: intervention.sealedAt,
      baselineCommit: intervention.baselineCommit,
      interventionCommit: intervention.interventionCommit,
      subjectThreadId: intervention.subjectThreadId,
      changedFileCount: intervention.changedFileCount,
      patchLineCount: intervention.patchLineCount
    };
    if (stage.type === "intervention.sealed") {
      projected.push(sealed);
      continue;
    }
    const revealed = {
      ...intervention,
      budgetApprovals,
      status: "revealed" as const,
      containedAt: undefined,
      excludedArtefactPaths: undefined
    };
    projected.push(stage.type === "intervention.revealed"
      ? revealed
      : { ...intervention, budgetApprovals });
  }
  return projected;
}

export function replayMemoryIntegrity(
  seals: MemoryIntegritySeal[],
  visibleEvents: RealityEvent[],
  replaying: boolean
): MemoryIntegritySeal[] {
  if (!replaying) return seals;
  const cutoff = new Date(visibleEvents.at(-1)?.occurredAt ?? 0).getTime();
  return seals.filter((seal) =>
    new Date(seal.sealedAt).getTime() <= cutoff
    && visibleEvents.some((event) =>
      event.realityId === seal.realityId
      && (event.type === "memory.verified" || event.type === "memory.quarantined")
      && (event.payload.sealId === undefined || event.payload.sealId === seal.id)
    )
  );
}

export function replayAnchorResults(
  results: AnchorResult[],
  visibleEvents: RealityEvent[],
  replaying: boolean
): AnchorResult[] {
  if (!replaying) return results;
  const proofComplete = visibleEvents.some((event) =>
    event.type === "verification.passed"
    || event.type === "verification.failed"
    || event.type === "reality.stabilised"
  );
  return results.filter((result) =>
    proofComplete
    || visibleEvents.some((event) =>
      (event.type === "anchor.passed" || event.type === "anchor.failed")
      && event.payload.anchorId === result.anchorId
    )
  );
}

export function replayRegressionResult(
  result: RegressionResult | undefined,
  visibleEvents: RealityEvent[],
  replaying: boolean
): RegressionResult | undefined {
  if (!replaying) return result;
  return visibleEvents.some((event) =>
    event.type === "verification.passed" || event.type === "verification.failed"
  ) ? result : undefined;
}

export function replayFinalDiff(
  finalDiff: string,
  visibleEvents: RealityEvent[],
  replaying: boolean
): string {
  if (!replaying) return finalDiff;
  const synthesisReached = visibleEvents.some((event) =>
    event.type === "synthesis.completed"
    || event.type.startsWith("anchor.")
    || event.type.startsWith("verification.")
    || event.type === "reality.stabilised"
  );
  return synthesisReached ? finalDiff : "";
}

export function replayReflections(
  reflections: DreamReflection[],
  visibleEvents: RealityEvent[],
  replaying: boolean
): DreamReflection[] {
  if (!replaying) return reflections;
  const cutoff = new Date(visibleEvents.at(-1)?.occurredAt ?? 0).getTime();
  return reflections.filter((reflection) =>
    new Date(reflection.createdAt).getTime() <= cutoff
    && visibleEvents.some((event) =>
      event.type === "reflection.created"
      && (event.payload.reflectionId === undefined || event.payload.reflectionId === reflection.id)
    )
  );
}

export function replayOutcome(
  outcome: MissionOutcome | undefined,
  visibleEvents: RealityEvent[],
  replaying: boolean
): MissionOutcome | undefined {
  if (!replaying) return outcome;
  return visibleEvents.some((event) => event.type === "reality.stabilised")
    ? outcome
    : undefined;
}

export function replayActiveRealityId(
  realities: Reality[],
  visibleEvents: RealityEvent[],
  fallbackRealityId: string
): string {
  const latest = visibleEvents.slice().reverse().find((event) =>
    realities.some((reality) => reality.id === event.realityId)
  );
  if (!latest) return realities.find((reality) => reality.depth === 0)?.id ?? fallbackRealityId;
  if (
    latest.type === "memory.returned"
    || latest.type === "memory.quarantined"
    || latest.type === "wake.returning"
  ) {
    return realities.find((reality) => reality.id === latest.realityId)?.parentId
      ?? latest.realityId;
  }
  return latest.realityId;
}

export function interventionArtefactsThatAscended(
  realities: Reality[],
  interventions: AdversarialInterventionLedger[]
): string[] {
  const paths = new Set<string>();
  for (const intervention of interventions) {
    if (!intervention.containedAt) continue;
    const changedPaths = new Set(intervention.report?.changedFiles ?? []);
    const sourceReality = realities.find((reality) => reality.id === intervention.realityId);
    for (const artefact of sourceReality?.wakeReport?.artefacts ?? []) {
      if (changedPaths.has(artefact.path)) paths.add(artefact.path);
    }
  }
  return [...paths];
}
