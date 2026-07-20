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

function replayStatusLabel(status: Reality["status"]): string {
  const labels: Record<Reality["status"], string> = {
    forming: "Creating",
    exploring: "Exploring",
    waking: "Returning memory",
    kicked: "Memory returned",
    stabilised: "Reality stabilised"
  };
  return labels[status];
}

function eventSubjectId(event: RealityEvent): string | undefined {
  if (typeof event.payload.subjectId === "string") return event.payload.subjectId;
  const metadata = event.payload.metadata;
  return metadata !== null
    && typeof metadata === "object"
    && "subjectId" in metadata
    && typeof metadata.subjectId === "string"
    ? metadata.subjectId
    : undefined;
}

export function replayRealities(
  realities: Reality[],
  events: RealityEvent[],
  timelineIndex: number | null
): Reality[] {
  if (timelineIndex === null || !events.length) return realities;
  const visibleEvents = events.slice(0, timelineIndex + 1);
  const cutoff = new Date(visibleEvents.at(-1)?.occurredAt ?? 0).getTime();
  const trackedCreationIds = new Set(
    events
      .filter((event) => event.type === "reality.created" || event.type === "dream.created")
      .map((event) => event.realityId)
  );
  const visibleCreationIds = new Set(
    visibleEvents
      .filter((event) => event.type === "reality.created" || event.type === "dream.created")
      .map((event) => event.realityId)
  );
  const subjectIds = new Set(
    visibleEvents
      .filter((event) => event.type === "subject.entered" || event.type === "subject.started")
      .map(eventSubjectId)
      .filter((id): id is string => typeof id === "string")
  );
  const surfacedProposals = new Set(
    visibleEvents
      .filter((event) => event.type === "uncertainty.discovered")
      .map((event) => event.payload.proposal)
      .filter((title): title is string => typeof title === "string")
  );

  return realities
    .filter((reality) => visibleCreationIds.has(reality.id)
      || (!trackedCreationIds.has(reality.id)
        && new Date(reality.createdAt).getTime() <= cutoff))
    .map((reality) => {
      const realityEvents = visibleEvents.filter((event) => event.realityId === reality.id);
      const lastEvent = realityEvents.at(-1);
      const hasMemory = realityEvents.some((event) =>
        event.type === "memory.returned"
        || event.type === "memory.verified"
        || event.type === "memory.quarantined"
      );
      const returnedSubjectIds = new Set(
        realityEvents
          .filter((event) => event.type === "subject.returned" || event.type === "subject.completed")
          .map(eventSubjectId)
          .filter((id): id is string => typeof id === "string")
      );
      const threadBound = realityEvents.some((event) => {
        if (event.type === "codex.thread.bound") return true;
        const metadata = event.payload.metadata;
        return event.type === "codex.progress"
          && metadata !== null
          && typeof metadata === "object"
          && "threadId" in metadata;
      });
      const anchors = reality.anchors.map((anchor) => {
        const result = realityEvents.slice().reverse().find((event) =>
          (event.type === "anchor.passed" || event.type === "anchor.failed")
          && event.payload.anchorId === anchor.id
        );
        return {
          ...anchor,
          status: result?.type === "anchor.passed"
            ? "passed" as const
            : result?.type === "anchor.failed"
              ? "failed" as const
              : "pending" as const,
          output: result ? anchor.output : undefined
        };
      });
      const proposals = reality.proposals
        .filter((proposal) => surfacedProposals.has(proposal.title))
        .map((proposal) => {
          const child = realities.find((candidate) =>
            candidate.parentId === reality.id
            && (candidate.name === proposal.title || candidate.premise === proposal.premise)
          );
          const childCreated = child && visibleEvents.some((event) =>
            event.type === "dream.created" && event.realityId === child.id
          );
          const childReturned = child && visibleEvents.some((event) =>
            event.realityId === child.id
            && (event.type === "memory.returned" || event.type === "memory.quarantined")
          );
          const deferred = visibleEvents.some((event) =>
            event.type === "uncertainty.deferred"
            && (event.payload.proposalId === proposal.id || event.payload.title === proposal.title)
          );
          return {
            ...proposal,
            status: deferred
              ? "deferred" as const
              : childReturned
                ? "resolved" as const
                : childCreated
                  ? "dreaming" as const
                  : "open" as const
          };
        });
      const implementationState = realityEvents.some((event) => event.type === "synthesis.completed")
        ? reality.worldState.implementationState
        : realityEvents.some((event) => event.type === "intervention.contained")
          ? "Adversarial intervention contained"
          : realityEvents.some((event) => event.type === "memory.returned")
            ? "Validated memory returned"
            : realityEvents.some((event) => event.type === "intervention.sealed")
              ? "Adversarial intervention sealed"
              : realityEvents.some((event) => event.type === "inspection.completed")
                ? "Codex inspection complete"
                : realityEvents.some((event) => event.type === "codex.progress")
                  ? "Codex inspection in progress"
                  : reality.kind === "waking"
                    ? "Reality baseline preserved"
                    : "Parent baseline isolated";
      const status: Reality["status"] = realityEvents.some((event) => event.type === "reality.stabilised")
        ? "stabilised"
        : hasMemory
          ? "kicked"
          : realityEvents.some((event) => event.type === "kick.triggered")
            ? "waking"
            : reality.kind === "dream" || realityEvents.some((event) => event.type === "inspection.completed")
              ? "exploring"
              : "forming";
      return {
        ...reality,
        status,
        worldState: {
          ...reality.worldState,
          simulatedMinutes: lastEvent?.dreamTime ?? 0,
          currentFocus: lastEvent?.summary ?? "Establishing the world",
          summary: lastEvent?.summary ?? reality.premise,
          status: replayStatusLabel(status),
          implementationState
        },
        evidence: reality.evidence.filter((entry) => new Date(entry.createdAt).getTime() <= cutoff),
        beliefs: reality.beliefs.filter((entry) => new Date(entry.createdAt).getTime() <= cutoff),
        proposals,
        subjects: reality.subjects
          .filter((subject) => subjectIds.has(subject.id))
          .map((subject) => ({
            ...subject,
            status: returnedSubjectIds.has(subject.id) ? "returned" as const : "entered" as const
          })),
        anchors,
        wakeReport: realityEvents.some((event) => event.type === "memory.returned")
          ? reality.wakeReport
          : undefined,
        codexThreadId: threadBound ? reality.codexThreadId : undefined
      };
    });
}

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
