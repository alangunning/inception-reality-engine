import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  MissionDefinitionDraftSchema,
  MissionDefinitionSchema,
  MissionRunSchema,
  RealityEntity,
  type AdversarialDiagnosis,
  type AdversarialInterventionLedger,
  type AdversarialInterventionReport,
  type AnchorResult,
  type InvestigationReport,
  type MissionInterventionContract,
  type MissionDefinitionDraft,
  type MemoryIntegritySeal,
  type MissionRun,
  type Reality,
  type RealityEvent,
  type RealityEventType,
  type WakeReport
} from "@inception/domain";
import {
  CodexOutputValidationError,
  type CodexRuntime,
  type CodexRuntimeEvent
} from "./codex-port";
import type { RealityEventBus, RealityRepository } from "./ports";
import { MemoryIntegrityService } from "./memory-integrity-service";
import type {
  MissionWorkspaceFactoryPort,
  WorktreeManagerPort
} from "./worktree-port";

export type MissionAction =
  | "inspect"
  | "intervene"
  | "create_dream"
  | "kick"
  | "synthesise"
  | "verify"
  | "repair"
  | "stabilise";

export interface MissionOperation {
  id: string;
  action: MissionAction;
  label: string;
  realityId: string;
  startedAt: string;
}

export interface MissionNextAction {
  id: MissionAction;
  kind: "advance" | "intervene" | "dream" | "kick" | "verify";
  label: string;
  executor: "codex" | "orchestrator";
}

export interface MissionSnapshot {
  run: MissionRun;
  activeReality: Reality;
  operation: MissionOperation | null;
  nextAction: MissionNextAction | null;
}

const DEFAULT_WAKE_CONTRACT = [
  "State initial beliefs and what changed.",
  "Return reproducible evidence and artefacts.",
  "Separate invariants from world-specific observations.",
  "Preserve remaining uncertainty."
];

function now(): string {
  return new Date().toISOString();
}

function safeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "The Reality operation failed.";
  return message
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(
      /(\b(?:OPENAI_API_KEY|CODEX_API_KEY|ACCESS_TOKEN|AUTH_TOKEN|PASSWORD|SECRET)=)(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
      "$1[REDACTED]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function safeRelativePath(candidate: string): boolean {
  return Boolean(candidate)
    && !path.isAbsolute(candidate)
    && !candidate.split(/[\\/]/).includes("..");
}

function safePathPattern(pattern: string): boolean {
  return safeRelativePath(pattern.replaceAll("*", "bounded"));
}

function pathPatternRegex(pattern: string): RegExp {
  const doubleStar = "\u0000";
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", doubleStar)
    .replaceAll("*", "[^/]*")
    .replaceAll(doubleStar, ".*");
  return new RegExp(`^${source}$`);
}

function matchesAnyPathPattern(candidate: string, patterns: string[]): boolean {
  const normalised = candidate.replaceAll("\\", "/");
  return patterns.some((pattern) => pathPatternRegex(pattern.replaceAll("\\", "/")).test(normalised));
}

function patchLineCount(patch: string): number {
  return patch
    .split("\n")
    .filter((line) =>
      (line.startsWith("+") && !line.startsWith("+++"))
      || (line.startsWith("-") && !line.startsWith("---"))
    )
    .length;
}

function isDescendantOf(realities: Reality[], candidateId: string, ancestorId: string): boolean {
  let candidate = realities.find((entry) => entry.id === candidateId);
  while (candidate?.parentId) {
    if (candidate.parentId === ancestorId) return true;
    candidate = realities.find((entry) => entry.id === candidate?.parentId);
  }
  return false;
}

export class MissionOrchestrator {
  private readonly operationQueues = new Map<string, Promise<void>>();
  private readonly activeOperations = new Map<string, MissionOperation>();
  private readonly memoryIntegrity = new MemoryIntegrityService();

  constructor(
    private readonly repository: RealityRepository,
    private readonly eventBus: RealityEventBus,
    private readonly codexRuntime: CodexRuntime,
    private readonly workspaces: MissionWorkspaceFactoryPort
  ) {}

  async create(input: MissionDefinitionDraft): Promise<MissionSnapshot> {
    if (this.codexRuntime.mode !== "real") {
      throw new Error("Mission Composer is available only in real Codex mode.");
    }
    const draft = MissionDefinitionDraftSchema.parse(input);
    if (draft.intervention?.targetDepth && draft.intervention.targetDepth > draft.maxDreamDepth) {
      throw new Error("The intervention target depth must fit within the Mission Dream depth.");
    }
    for (const pattern of [
      ...(draft.intervention?.allowedPaths ?? []),
      ...(draft.intervention?.protectedPaths ?? [])
    ]) {
      if (!safePathPattern(pattern)) {
        throw new Error(`Intervention path pattern must remain relative to the Reality: ${pattern}`);
      }
    }
    const id = randomUUID();
    const workspace = await this.workspaces.open(draft.repositoryPath, id);
    const createdAt = now();
    const definition = MissionDefinitionSchema.parse({
      ...draft,
      id,
      repositoryPath: workspace.repoRoot,
      wakeContract: draft.wakeContract.length ? draft.wakeContract : DEFAULT_WAKE_CONTRACT,
      proofs: draft.proofs.map((proof) => ({ ...proof, id: randomUUID() })),
      subjects: draft.subjects.map((subject) => ({ ...subject, id: randomUUID() })),
      intervention: draft.intervention ? {
        ...draft.intervention,
        id: randomUUID(),
        subject: {
          ...draft.intervention.subject,
          id: randomUUID()
        }
      } : undefined,
      createdAt
    });
    const root = RealityEntity.create({
      depth: 0,
      kind: "waking",
      name: definition.name,
      premise: definition.premise,
      constitution: {
        mission: definition.mission,
        scope: definition.scope,
        premise: definition.premise,
        constraints: [
          ...definition.constraints,
          `Stay within the mission token budget of ${definition.tokenBudget.toLocaleString("en-US")} tokens.`,
          "Do not expose raw model reasoning."
        ],
        wakeContract: definition.wakeContract,
        parentTruths: definition.parentTruths,
        timeDilation: 1,
        runtimeLaws: [
          "Only validated Codex outputs may enter this Reality.",
          "A failed immutable proof prevents Reality stabilisation."
        ]
      },
      initialBeliefs: [{
        statement: definition.premise,
        confidence: 0.5,
        origin: "initial"
      }],
      inheritedAnchors: definition.proofs.map((proof) => ({
        id: proof.id,
        realityId: "pending",
        ownerRealityId: "pending",
        name: proof.name,
        description: `Immutable proof: ${proof.executable} ${proof.args.join(" ")}`.trim(),
        testCommand: [proof.executable, ...proof.args].join(" "),
        immutable: true,
        hidden: false,
        status: "pending"
      }))
    });
    const descriptor = await workspace.worktrees.create(
      root.snapshot().id,
      "HEAD",
      workspace.repoRoot
    );
    root.bindRuntime(`unbound:${root.snapshot().id}`, descriptor.path, descriptor.branchName);
    const reality = root.setStatus("exploring", "Awaiting an explicit Codex action").snapshot();
    await this.materialiseContext(workspace.worktrees, reality);

    const run = MissionRunSchema.parse({
      id,
      definition,
      status: "exploring",
      realities: [reality],
      events: [],
      activeRealityId: reality.id,
      memories: [],
      interventions: [],
      memoryIntegrity: [],
      proofResults: [],
      finalDiff: "",
      createdAt,
      updatedAt: createdAt
    });
    await this.emit(run, reality, "reality.created", `${definition.name} formed with ${definition.proofs.length} immutable proof${definition.proofs.length === 1 ? "" : "s"}.`, {
      missionId: id,
      depthBudget: definition.maxDreamDepth,
      tokenBudget: definition.tokenBudget
    });
    return this.present(run);
  }

  async snapshot(id: string): Promise<MissionSnapshot> {
    const run = await this.requireRun(id);
    return this.present(run);
  }

  async list(): Promise<MissionRun[]> {
    return this.repository.listMissionRuns(20);
  }

  async act(id: string, action: MissionAction): Promise<MissionSnapshot> {
    const prior = this.operationQueues.get(id) ?? Promise.resolve();
    const runOperation = prior.then(async () => {
      const run = await this.requireRun(id);
      const active = this.requireActive(run);
      const expected = this.describeAction(run, active);
      if (!expected || expected.id !== action) {
        throw new Error(`Action ${action} is not valid; expected ${expected?.id ?? "none"}.`);
      }
      this.assertBudget(run);
      const operation: MissionOperation = {
        id: randomUUID(),
        action,
        label: expected.label,
        realityId: active.id,
        startedAt: now()
      };
      this.activeOperations.set(id, operation);
      try {
        const workspace = await this.workspaces.open(run.definition.repositoryPath, run.id);
        switch (action) {
          case "inspect":
            await this.inspect(run, active, workspace.worktrees);
            break;
          case "intervene":
            await this.intervene(run, active, workspace.worktrees);
            break;
          case "create_dream":
            await this.createDream(run, active, workspace.worktrees);
            break;
          case "kick":
            await this.kick(run, active, workspace.worktrees);
            break;
          case "synthesise":
            await this.synthesise(run, active, workspace.worktrees);
            break;
          case "verify":
            await this.verify(run, active, workspace.worktrees);
            break;
          case "repair":
            await this.repair(run, active, workspace.worktrees);
            break;
          case "stabilise":
            await this.stabilise(run, active, workspace.worktrees);
            break;
        }
      } catch (error) {
        run.status = "fractured";
        await this.emit(run, this.requireReality(run, operation.realityId), "reality.fractured", safeFailure(error), {
          missionId: run.id,
          action
        });
        throw error;
      } finally {
        this.activeOperations.delete(id);
      }
    });
    this.operationQueues.set(id, runOperation.catch(() => undefined));
    await runOperation;
    return this.snapshot(id);
  }

  async delete(id: string): Promise<number> {
    if (this.activeOperations.has(id)) {
      throw new Error("Stop the active Codex operation before deleting this mission.");
    }
    const run = await this.repository.getMissionRun(id);
    if (!run) return 0;
    const workspace = await this.workspaces.open(run.definition.repositoryPath, run.id);
    const removed = await workspace.worktrees.cleanupAll();
    await this.repository.deleteMissionRun(id);
    return removed;
  }

  private async inspect(
    run: MissionRun,
    reality: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    const result = await this.codexRuntime.inspect(
      {
        ...reality,
        codexThreadId: reality.codexThreadId?.startsWith("unbound:")
          ? undefined
          : reality.codexThreadId
      },
      async (event) => this.emitCodexEvent(run, reality, event)
    );
    this.validateSubjectReports(reality, result.report);
    const intervention = run.interventions.find((entry) =>
      entry.realityId === reality.id && entry.status === "sealed"
    );
    if (intervention) {
      if (!result.report.adversarialDiagnosis) {
        throw new CodexOutputValidationError("InvestigationReportSchema", [{
          path: "adversarialDiagnosis",
          code: "missing_sealed_intervention_diagnosis"
        }]);
      }
      intervention.diagnosis = result.report.adversarialDiagnosis;
    }
    const entity = RealityEntity.hydrate(reality)
      .bindRuntime(result.threadId, reality.worktreePath!, reality.branchName!);
    this.applyInvestigation(entity, result.report);
    entity
      .advanceTime(12, "Evaluating counterfactual evidence", result.report.summary)
      .setImplementationState("Codex inspection complete")
      .setStatus("exploring", "Uncertainty mapped");
    const updated = entity.snapshot();
    this.replaceReality(run, updated);
    await this.materialiseContext(worktrees, updated);
    await this.emit(run, updated, "inspection.completed", `Codex inspected ${run.definition.scope} and returned validated evidence.`, {
      missionId: run.id,
      evidenceCount: result.report.evidence.length,
      subjectReportCount: result.report.subjectReports.length,
      adversarialDiagnosisReturned: Boolean(result.report.adversarialDiagnosis)
    });
  }

  private async intervene(
    run: MissionRun,
    reality: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    const contract = this.requireInterventionContract(run, reality);
    const ledger = this.requireInterventionLedger(run, reality);
    ledger.status = "injecting";
    ledger.startedAt = now();
    await this.emit(run, reality, "intervention.started", `Adversarial Subject entered ${reality.name} under a sealed intervention contract.`, {
      missionId: run.id,
      contractId: contract.id,
      subjectId: contract.subject.id,
      subjectName: contract.subject.name,
      subjectRole: contract.subject.role,
      faultClasses: contract.faultClasses,
      maxChangedFiles: contract.maxChangedFiles,
      maxPatchLines: contract.maxPatchLines,
      tokenBudget: contract.tokenBudget,
      maxMinutes: contract.maxMinutes
    });

    let baselineCommit: string | undefined;
    try {
      baselineCommit = await worktrees.checkpoint(
        reality.worktreePath!,
        `Reality baseline before sealed intervention ${ledger.id}`
      );
      ledger.baselineCommit = baselineCommit;
      const result = await this.codexRuntime.intervene(
        reality,
        contract,
        async (event) => this.emitSealedInterventionEvent(run, reality, contract, event)
      );
      const actualChangedFiles = await worktrees.listChangedFiles(reality.worktreePath!);
      const validated = await this.validateIntervention(
        worktrees,
        reality,
        contract,
        result.report,
        actualChangedFiles,
        result.events
      );
      const interventionCommit = await worktrees.sealChanges(
        reality.worktreePath!,
        validated.changedFiles,
        `Sealed intervention ${ledger.id}`,
        baselineCommit
      );

      ledger.status = "sealed";
      ledger.sealedAt = now();
      ledger.interventionCommit = interventionCommit;
      ledger.subjectThreadId = result.subjectThreadId;
      ledger.changedFileCount = validated.changedFiles.length;
      ledger.patchLineCount = validated.patchLines;
      ledger.report = result.report;

      const investigatorSubjects = run.definition.subjects.map((charter) => ({
        ...charter,
        id: randomUUID(),
        realityId: reality.id,
        status: "entered" as const,
        findings: []
      }));
      const updated: Reality = {
        ...reality,
        subjects: investigatorSubjects,
        worldState: {
          ...reality.worldState,
          simulatedMinutes: reality.worldState.simulatedMinutes
            + 3 * (reality.constitution.timeDilation ?? 1),
          currentFocus: "Diagnosing a sealed intervention",
          summary: "A bounded mutation is present; its cause remains sealed from investigator Subjects.",
          status: "Intervention sealed; diagnosis ready"
        },
        updatedAt: now()
      };
      this.replaceReality(run, updated);
      await this.materialiseContext(worktrees, updated);
      await this.emit(run, updated, "intervention.sealed", `Intervention sealed: ${validated.changedFiles.length} in-scope file${validated.changedFiles.length === 1 ? "" : "s"} changed and rollback retained.`, {
        missionId: run.id,
        contractId: contract.id,
        changedFileCount: validated.changedFiles.length,
        patchLineCount: validated.patchLines,
        rollbackReady: true
      });
      for (const subject of investigatorSubjects) {
        await this.emit(run, updated, "subject.entered", `Subject entered after the intervention was sealed: ${subject.name}, ${subject.role}.`, {
          missionId: run.id,
          subjectId: subject.id,
          role: subject.role,
          disclosure: "intervention-details-sealed"
        });
      }
    } catch (error) {
      if (baselineCommit) {
        await worktrees.restoreCheckpoint(reality.worktreePath!, baselineCommit).catch(() => undefined);
      }
      ledger.status = "rejected";
      ledger.rejectionReason = safeFailure(error);
      ledger.report = undefined;
      ledger.interventionCommit = undefined;
      ledger.subjectThreadId = undefined;
      ledger.changedFileCount = undefined;
      ledger.patchLineCount = undefined;
      await this.emit(run, reality, "intervention.rejected", `Sealed intervention rejected and the Dream restored to its baseline: ${safeFailure(error)}`, {
        missionId: run.id,
        contractId: contract.id,
        rollbackApplied: Boolean(baselineCommit)
      });
      throw error;
    }
  }

  private async createDream(
    run: MissionRun,
    parent: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    if (parent.depth >= run.definition.maxDreamDepth) {
      throw new Error("The configured Dream depth budget has been reached.");
    }
    const proposal = parent.proposals.find((entry) => entry.status === "open");
    if (!proposal) throw new Error("Codex has not returned an open uncertainty worth dreaming.");
    const parentEntity = RealityEntity.hydrate(parent).updateProposal(proposal.id, "dreaming");
    this.replaceReality(run, parentEntity.snapshot());
    const childDepth = parent.depth + 1;
    const interventionContract = run.definition.intervention?.enabled
      && run.definition.intervention.targetDepth === childDepth
      ? run.definition.intervention
      : undefined;
    const child = RealityEntity.create({
      parentId: parent.id,
      depth: childDepth,
      kind: "dream",
      name: proposal.title,
      premise: proposal.premise,
      constitution: {
        ...parent.constitution,
        premise: proposal.premise,
        parentTruths: [
          ...parent.constitution.parentTruths,
          ...parent.evidence
            .filter((entry) => entry.kind === "invariant")
            .map((entry) => entry.summary)
        ],
        timeDilation: Math.max(2, parent.depth + 2),
        runtimeLaws: interventionContract
          ? [
              ...(parent.constitution.runtimeLaws ?? []),
              "A sealed adversarial intervention may exist; diagnose it only from observable code, behavior, and test evidence."
            ]
          : parent.constitution.runtimeLaws
      },
      inheritedAnchors: parent.anchors,
      initialBeliefs: parent.beliefs.slice(-1).map((belief) => ({
        statement: belief.statement,
        confidence: belief.confidence,
        origin: "inherited" as const
      }))
    });
    if (!interventionContract) {
      for (const charter of run.definition.subjects) {
        child.addSubject({
          ...charter,
          id: randomUUID(),
          status: "entered",
          findings: []
        });
      }
    }
    const descriptor = await worktrees.create(
      child.snapshot().id,
      parent.branchName ?? "HEAD",
      parent.worktreePath
    );
    child
      .bindRuntime(`unbound:${child.snapshot().id}`, descriptor.path, descriptor.branchName)
      .setStatus("exploring", "Dream formed; awaiting Codex investigation");
    const dream = child.snapshot();
    run.realities.push(dream);
    run.activeRealityId = dream.id;
    await this.materialiseContext(worktrees, dream);
    await this.emit(run, dream, "dream.created", `Creating dream: ${dream.name}.`, {
      missionId: run.id,
      parentRealityId: parent.id,
      depth: dream.depth,
      uncertainty: proposal.uncertainty
    });
    if (interventionContract) {
      const ledger: AdversarialInterventionLedger = {
        id: randomUUID(),
        contractId: interventionContract.id,
        realityId: dream.id,
        status: "armed",
        armedAt: now()
      };
      run.interventions.push(ledger);
      await this.emit(run, dream, "intervention.armed", `Sealed intervention armed for ${dream.name}; no mutation has run.`, {
        missionId: run.id,
        contractId: interventionContract.id,
        faultClasses: interventionContract.faultClasses,
        allowedPathCount: interventionContract.allowedPaths.length,
        protectedPathCount: interventionContract.protectedPaths.length,
        maxChangedFiles: interventionContract.maxChangedFiles,
        maxPatchLines: interventionContract.maxPatchLines
      });
    }
    for (const subject of dream.subjects) {
      await this.emit(run, dream, "subject.entered", `Subject entered: ${subject.name}, ${subject.role}.`, {
        missionId: run.id,
        subjectId: subject.id,
        role: subject.role
      });
    }
  }

  private async kick(
    run: MissionRun,
    reality: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    if (!reality.parentId) throw new Error("The waking Reality cannot be kicked.");
    await this.emit(run, reality, "kick.triggered", `Kick triggered: ${reality.name} must return what generalises.`, {
      missionId: run.id
    });
    const result = await this.codexRuntime.wake(
      reality,
      async (event) => this.emitCodexEvent(run, reality, event)
    );
    const entity = RealityEntity.hydrate(reality)
      .bindRuntime(result.threadId, reality.worktreePath!, reality.branchName!)
      .setWakeReport(result.report);
    const kicked = entity.snapshot();
    this.replaceReality(run, kicked);
    const parent = this.requireReality(run, reality.parentId);
    const parentEntity = RealityEntity.hydrate(parent);
    const proposal = parent.proposals.find((entry) => entry.status === "dreaming");
    const interventionOutcome = await this.revealIntervention(run, kicked);
    const integritySeal = await this.sealMemoryIntegrity(
      run,
      kicked,
      parent,
      result.report,
      worktrees,
      interventionOutcome
    );
    run.memoryIntegrity = [
      ...run.memoryIntegrity.filter((entry) => entry.realityId !== reality.id),
      integritySeal
    ];
    if (integritySeal.verdict === "quarantined") {
      if (proposal) parentEntity.updateProposal(proposal.id, "open");
      const protectedParent = parentEntity
        .advanceTime(
          2,
          "Quarantining unverified memory",
          "The parent Reality rejected a memory that failed its immutable integrity policy."
        )
        .snapshot();
      this.replaceReality(run, protectedParent);
      run.activeRealityId = parent.id;
      run.status = "exploring";
      await this.emit(run, kicked, "memory.quarantined", `Memory quarantined from ${reality.name}: parent-owned integrity policy rejected one or more checks.`, {
        missionId: run.id,
        parentRealityId: parent.id,
        failedChecks: integritySeal.checks
          .filter((check) => check.status === "failed")
          .map((check) => check.name),
        policyVersion: integritySeal.policyVersion,
        sealId: integritySeal.id
      });
      return;
    }
    await this.emit(run, kicked, "memory.verified", `Memory integrity verified for ${reality.name}; the parent Reality may inherit it.`, {
      missionId: run.id,
      parentRealityId: parent.id,
      sealId: integritySeal.id,
      descendantSealCount: integritySeal.descendantSealIds.length,
      policyVersion: integritySeal.policyVersion
    });
    run.memories = [
      ...run.memories.filter((memory) => memory.realityId !== result.report.realityId),
      result.report
    ];
    if (proposal) parentEntity.updateProposal(proposal.id, "resolved");
    const awakenedParent = parentEntity
      .advanceTime(4, "Receiving validated memory", result.report.recommendation)
      .snapshot();
    this.replaceReality(run, awakenedParent);
    run.activeRealityId = parent.id;
    await this.emit(run, kicked, "memory.returned", `Memory returned from ${reality.name}.`, {
      missionId: run.id,
      parentRealityId: parent.id,
      artefactCount: result.report.artefacts.length,
      invariantCount: result.report.invariants.length
    });
  }

  private async synthesise(
    run: MissionRun,
    root: Reality,
    worktrees: WorktreeManagerPort,
    repairContext?: string
  ): Promise<void> {
    if (root.kind !== "waking" || !run.memories.length) {
      throw new Error("Returned Dream memories are required before synthesis.");
    }
    const unverifiedMemories: WakeReport[] = [];
    for (const memory of run.memories) {
      const source = this.requireReality(run, memory.realityId);
      const seal = run.memoryIntegrity.find((candidate) =>
        candidate.realityId === memory.realityId
      );
      let failedCheck: "report-digest" | "descendant-lineage" | "source-state" | undefined;
      if (seal?.verdict === "verified") {
        if (!this.memoryIntegrity.matchesReport(seal, memory)) {
          failedCheck = "report-digest";
        } else if (!this.memoryIntegrity.matchesDescendantSeals(
          seal,
          source,
          run.realities,
          run.memoryIntegrity
        )) {
          failedCheck = "descendant-lineage";
        } else if (!await this.matchesSealedSource(worktrees, source, seal)) {
          failedCheck = "source-state";
        }
      }
      if (!seal || seal.verdict !== "verified" || failedCheck) {
        unverifiedMemories.push(memory);
      }
      if (seal && failedCheck) {
        const quarantined = this.memoryIntegrity.quarantine(
          seal,
          failedCheck,
          `The ${failedCheck} check changed after this memory crossed its Kick boundary.`,
          now()
        );
        run.memoryIntegrity = [
          ...run.memoryIntegrity.filter((entry) => entry.realityId !== source.id),
          quarantined
        ];
        await this.emit(run, source, "memory.quarantined", `Memory quarantined from ${source.name}: ${failedCheck} no longer matches its sealed value.`, {
          missionId: run.id,
          sealId: quarantined.id,
          failedChecks: [failedCheck],
          policyVersion: quarantined.policyVersion
        });
      }
    }
    if (unverifiedMemories.length) {
      throw new Error("Synthesis rejected Dream memory whose report, lineage, or sealed Git source changed.");
    }
    await this.promoteArtefacts(run, root, worktrees);
    const result = await this.codexRuntime.synthesise(
      {
        ...root,
        codexThreadId: root.codexThreadId?.startsWith("unbound:")
          ? undefined
          : root.codexThreadId
      },
      run.memories,
      async (event) => this.emitCodexEvent(run, root, event),
      repairContext
    );
    const updated = RealityEntity.hydrate(root)
      .bindRuntime(result.threadId, root.worktreePath!, root.branchName!)
      .setImplementationState("Memories synthesised")
      .advanceTime(15, repairContext ? "Repairing immutable proofs" : "Synthesising returned memories", result.report.summary)
      .setStatus("exploring", "Implementation awaits immutable proof")
      .snapshot();
    this.replaceReality(run, updated);
    run.proofResults = [];
    run.status = "exploring";
    run.finalDiff = await worktrees.diff(root.worktreePath!);
    await this.emit(run, updated, "synthesis.completed", repairContext ? "Reality repair returned from Codex." : "Returned memories synthesised into the waking Reality.", {
      missionId: run.id,
      appliedMemoryCount: result.report.appliedMemories.length,
      changedFileCount: result.report.changedFiles.length
    });
  }

  private async repair(
    run: MissionRun,
    root: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    const failures = run.proofResults
      .filter((result) => result.status === "failed")
      .map((result) => `${result.name}: ${result.output.slice(-500)}`)
      .join("\n");
    await this.synthesise(
      run,
      root,
      worktrees,
      `Immutable proofs failed. Repair the implementation without weakening the proofs.\n${failures}`
    );
  }

  private async verify(
    run: MissionRun,
    root: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    run.status = "verifying";
    await this.emit(run, root, "verification.started", "Immutable mission proofs entered the waking Reality.", {
      missionId: run.id,
      proofCount: run.definition.proofs.length
    });
    const results: AnchorResult[] = [];
    for (const proof of run.definition.proofs) {
      const started = Date.now();
      await this.emit(run, root, "anchor.started", `Anchor entered: ${proof.name}.`, {
        missionId: run.id,
        anchorId: proof.id
      });
      const result = await worktrees.run(root.worktreePath!, proof.executable, proof.args);
      const status = result.exitCode === 0 ? "passed" as const : "failed" as const;
      const output = [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
        .trim()
        .slice(-4_000);
      results.push({
        anchorId: proof.id,
        name: proof.name,
        status,
        output,
        command: [proof.executable, ...proof.args].join(" "),
        durationMs: Date.now() - started
      });
      await this.emit(run, root, status === "passed" ? "anchor.passed" : "anchor.failed", `Anchor ${status}: ${proof.name}.`, {
        missionId: run.id,
        anchorId: proof.id,
        exitCode: result.exitCode
      });
    }
    const anchors = root.anchors.map((anchor) => {
      const result = results.find((entry) => entry.anchorId === anchor.id);
      return {
        ...anchor,
        status: result?.status ?? "failed",
        output: result?.output
      };
    });
    const updated = RealityEntity.hydrate(root)
      .replaceAnchors(anchors)
      .setStatus("exploring", results.every((result) => result.status === "passed")
        ? "All immutable proofs passed"
        : "Immutable proof failed")
      .snapshot();
    this.replaceReality(run, updated);
    run.proofResults = results;
    run.status = results.every((result) => result.status === "passed") ? "exploring" : "fractured";
    run.finalDiff = await worktrees.diff(root.worktreePath!);
    await this.emit(run, updated, results.every((result) => result.status === "passed")
      ? "verification.passed"
      : "verification.failed", results.every((result) => result.status === "passed")
      ? "Every immutable mission proof passed."
      : "Reality stabilisation blocked by a failed immutable proof.", {
      missionId: run.id,
      passed: results.filter((result) => result.status === "passed").length,
      failed: results.filter((result) => result.status === "failed").length
    });
  }

  private async stabilise(
    run: MissionRun,
    root: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    if (!run.proofResults.length || run.proofResults.some((result) => result.status !== "passed")) {
      throw new Error("Reality stabilisation requires every immutable proof to pass.");
    }
    const stabilised = RealityEntity.hydrate(root)
      .setStatus("stabilised", "Reality stabilised")
      .advanceTime(2, "Reality stabilised", "Counterfactual memories survived parent-owned proof.")
      .snapshot();
    this.replaceReality(run, stabilised);
    run.status = "stabilised";
    run.finalDiff = await worktrees.diff(root.worktreePath!);
    await this.emit(run, stabilised, "reality.stabilised", "Reality stabilised: returned knowledge and implementation survived every immutable proof.", {
      missionId: run.id,
      memoryCount: run.memories.length,
      proofCount: run.proofResults.length
    });
  }

  private applyInvestigation(entity: RealityEntity, report: InvestigationReport): void {
    const evidenceIds = new Map<string, string>();
    for (const reported of report.evidence) {
      const evidence = entity.addEvidence({
        id: randomUUID(),
        kind: reported.kind,
        title: reported.title,
        summary: reported.summary,
        source: reported.source,
        artefactPath: reported.artefactPath ?? undefined,
        provenance: reported.synthetic ? "synthetic" : "model-reported"
      });
      evidenceIds.set(reported.title, evidence.id);
    }
    for (const subject of report.subjectReports) {
      entity.returnSubject(subject.subjectId, subject.findings);
    }
    for (const change of report.changedBeliefs) {
      const current = entity.snapshot().beliefs.at(-1);
      entity.addBelief({
        id: randomUUID(),
        statement: change.to,
        confidence: change.confidence,
        origin: "observed",
        supersedesBeliefId: current?.id,
        evidenceIds: change.evidenceTitles
          .map((title) => evidenceIds.get(title))
          .filter((id): id is string => Boolean(id))
      });
    }
    if (report.dreamProposal) {
      entity.addProposal({
        id: randomUUID(),
        ...report.dreamProposal,
        status: "open"
      });
    }
  }

  private validateSubjectReports(reality: Reality, report: InvestigationReport): void {
    const active = reality.subjects.filter((subject) =>
      subject.status === "entered" || subject.status === "investigating"
    );
    const valid = active.length === report.subjectReports.length
      && active.every((subject) => report.subjectReports.some((entry) =>
        entry.subjectId === subject.id
        && entry.name === subject.name
        && entry.role === subject.role
      ));
    if (!valid) {
      throw new CodexOutputValidationError("InvestigationReportSchema", [{
        path: "subjectReports",
        code: "subject_identity_mismatch"
      }]);
    }
    if (report.adversarialDiagnosis) {
      const evidenceTitles = new Set(report.evidence.map((entry) => entry.title));
      if (report.adversarialDiagnosis.evidenceTitles.some((title) => !evidenceTitles.has(title))) {
        throw new CodexOutputValidationError("InvestigationReportSchema", [{
          path: "adversarialDiagnosis.evidenceTitles",
          code: "diagnosis_evidence_not_returned"
        }]);
      }
    }
  }

  private async validateIntervention(
    worktrees: WorktreeManagerPort,
    reality: Reality,
    contract: MissionInterventionContract,
    report: AdversarialInterventionReport,
    actualChangedFiles: string[],
    events: CodexRuntimeEvent[]
  ): Promise<{ changedFiles: string[]; patchLines: number }> {
    const changedFiles = [...new Set(actualChangedFiles)].sort();
    if (!changedFiles.length) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "changedFiles",
        code: "intervention_changed_no_files"
      }]);
    }
    if (changedFiles.length > contract.maxChangedFiles) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "changedFiles",
        code: "changed_file_budget_exceeded"
      }]);
    }
    const requiredProtection = [".git/**", ".inception/**"];
    for (const changedFile of changedFiles) {
      if (!safeRelativePath(changedFile)) {
        throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
          path: "changedFiles",
          code: "path_outside_reality"
        }]);
      }
      if (!matchesAnyPathPattern(changedFile, contract.allowedPaths)) {
        throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
          path: changedFile,
          code: "path_outside_intervention_allowlist"
        }]);
      }
      if (matchesAnyPathPattern(changedFile, [...requiredProtection, ...contract.protectedPaths])) {
        throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
          path: changedFile,
          code: "protected_path_changed"
        }]);
      }
    }
    const reportedFiles = [...new Set(report.changedFiles)].sort();
    if (
      reportedFiles.length !== changedFiles.length
      || reportedFiles.some((entry, index) => entry !== changedFiles[index])
    ) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "changedFiles",
        code: "reported_diff_mismatch"
      }]);
    }
    let patchLines = 0;
    for (const changedFile of changedFiles) {
      patchLines += patchLineCount(await worktrees.diff(reality.worktreePath!, changedFile));
    }
    if (patchLines > contract.maxPatchLines) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "changedFiles",
        code: "patch_line_budget_exceeded"
      }]);
    }
    const observedTokens = events.reduce((total, event) =>
      total
      + (event.metadata?.inputTokens ?? 0)
      + (event.metadata?.outputTokens ?? 0)
      + (event.metadata?.reasoningTokens ?? 0), 0);
    if (observedTokens > contract.tokenBudget) {
      throw new CodexOutputValidationError("AdversarialInterventionReportSchema", [{
        path: "tokenBudget",
        code: "intervention_token_budget_exceeded"
      }]);
    }
    return { changedFiles, patchLines };
  }

  private async revealIntervention(
    run: MissionRun,
    reality: Reality
  ): Promise<"detected" | "partial" | "missed" | undefined> {
    const ledger = run.interventions.find((entry) =>
      entry.realityId === reality.id && entry.status === "sealed"
    );
    if (!ledger) return undefined;
    if (!ledger.report || !ledger.diagnosis) return "missed";
    const actualFiles = new Set(ledger.report.changedFiles);
    const identifiedFiles = [...new Set(
      ledger.diagnosis.suspectedChangedFiles.filter((entry) => actualFiles.has(entry))
    )].sort();
    const missedFiles = ledger.report.changedFiles
      .filter((entry) => !identifiedFiles.includes(entry))
      .sort();
    const faultClassMatched = ledger.diagnosis.faultClass === ledger.report.faultClass;
    const outcome = faultClassMatched && !missedFiles.length
      ? "detected" as const
      : faultClassMatched || identifiedFiles.length
        ? "partial" as const
        : "missed" as const;
    ledger.status = "revealed";
    ledger.revealedAt = now();
    ledger.assessment = {
      outcome,
      faultClassMatched,
      identifiedFiles,
      missedFiles,
      evidenceTitles: ledger.diagnosis.evidenceTitles,
      assessedAt: now()
    };
    await this.emit(run, reality, "intervention.revealed", `Intervention revealed: investigator Subjects ${outcome === "detected" ? "identified" : outcome === "partial" ? "partially identified" : "missed"} the controlled fault.`, {
      missionId: run.id,
      contractId: ledger.contractId,
      outcome,
      faultClass: ledger.report.faultClass,
      faultClassMatched,
      identifiedFileCount: identifiedFiles.length,
      changedFileCount: ledger.report.changedFiles.length,
      evidenceTitles: ledger.diagnosis.evidenceTitles
    });
    return outcome;
  }

  private async sealMemoryIntegrity(
    run: MissionRun,
    reality: Reality,
    parent: Reality,
    report: WakeReport,
    worktrees: WorktreeManagerPort,
    interventionOutcome: "detected" | "partial" | "missed" | undefined
  ): Promise<MemoryIntegritySeal> {
    let artefactsResolvable = true;
    for (const artefact of report.artefacts) {
      if (!safeRelativePath(artefact.path)) {
        artefactsResolvable = false;
        break;
      }
      if (artefact.content !== undefined || artefact.kind === "note") continue;
      try {
        await worktrees.readFile(reality.worktreePath!, artefact.path);
      } catch {
        artefactsResolvable = false;
        break;
      }
    }

    const descendantSeals = run.memoryIntegrity.filter((seal) =>
      seal.verdict === "verified"
      && isDescendantOf(run.realities, seal.realityId, reality.id)
    );
    const descendantSourcesValid = (await Promise.all(descendantSeals.map(async (seal) => {
      const source = run.realities.find((candidate) => candidate.id === seal.realityId);
      return Boolean(source) && await this.matchesSealedSource(worktrees, source!, seal);
    }))).every(Boolean);
    const sourceState = await worktrees.diff(reality.worktreePath!);
    const sourceCommit = await worktrees.checkpoint(
      reality.worktreePath!,
      `Memory integrity seal for ${reality.id}`
    );
    return this.memoryIntegrity.seal({
      reality,
      parent,
      report,
      realities: run.realities,
      inheritedMemories: run.memories,
      priorSeals: run.memoryIntegrity,
      sourceState,
      sourceCommit,
      artefactsResolvable,
      descendantSourcesValid,
      interventionOutcome,
      sealedAt: now()
    });
  }

  private async matchesSealedSource(
    worktrees: WorktreeManagerPort,
    reality: Reality,
    seal: MemoryIntegritySeal
  ): Promise<boolean> {
    if (!reality.worktreePath) return false;
    try {
      const [currentCommit, clean] = await Promise.all([
        worktrees.currentCommit(reality.worktreePath),
        worktrees.isClean(reality.worktreePath)
      ]);
      return this.memoryIntegrity.matchesSealedSource(seal, currentCommit, clean);
    } catch {
      return false;
    }
  }

  private requireInterventionContract(
    run: MissionRun,
    reality: Reality
  ): MissionInterventionContract {
    const contract = run.definition.intervention;
    if (!contract || contract.targetDepth !== reality.depth) {
      throw new Error("No adversarial intervention is configured for this Reality.");
    }
    return contract;
  }

  private requireInterventionLedger(
    run: MissionRun,
    reality: Reality
  ): AdversarialInterventionLedger {
    const ledger = run.interventions.find((entry) => entry.realityId === reality.id);
    if (!ledger || !["armed", "rejected"].includes(ledger.status)) {
      throw new Error("The sealed intervention is not ready to run.");
    }
    return ledger;
  }

  private async promoteArtefacts(
    run: MissionRun,
    root: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    for (const report of run.memories) {
      const source = this.requireReality(run, report.realityId);
      for (const artefact of report.artefacts) {
        if (!safeRelativePath(artefact.path)) {
          throw new CodexOutputValidationError("WakeReportSchema", [{
            path: "artefacts.path",
            code: "path_outside_reality"
          }]);
        }
        let content: string | undefined;
        try {
          content = await worktrees.readFile(source.worktreePath!, artefact.path);
        } catch {
          content = artefact.content;
        }
        if (content === undefined && artefact.kind === "note") {
          content = `${artefact.name}\n\n${artefact.summary}\n`;
        }
        if (content === undefined) {
          throw new CodexOutputValidationError("WakeReportSchema", [{
            path: "artefacts.content",
            code: "missing_returned_artefact"
          }]);
        }
        await worktrees.writeFile(root.worktreePath!, artefact.path, content);
        await this.emit(run, root, "artefact.returned", `Artefact returned: ${artefact.name}.`, {
          missionId: run.id,
          sourceRealityId: source.id,
          path: artefact.path,
          kind: artefact.kind
        });
      }
    }
  }

  private describeAction(run: MissionRun, active: Reality): MissionNextAction | null {
    if (run.status === "stabilised") return null;
    if (active.kind === "dream") {
      const intervention = run.interventions.find((entry) =>
        entry.realityId === active.id
      );
      if (intervention && (intervention.status === "armed" || intervention.status === "rejected")) {
        return {
          id: "intervene",
          kind: "intervene",
          executor: "codex",
          label: intervention.status === "rejected"
            ? `Retry the bounded adversarial intervention in ${active.name}`
            : `Run the bounded adversarial intervention in ${active.name}`
        };
      }
      if (active.codexThreadId?.startsWith("unbound:")) {
        return {
          id: "inspect",
          kind: "advance",
          executor: "codex",
          label: `Ask Codex and ${active.subjects.length} Subject${active.subjects.length === 1 ? "" : "s"} to investigate ${active.name}`
        };
      }
      const openProposal = active.proposals.some((proposal) => proposal.status === "open");
      if (openProposal && active.depth < run.definition.maxDreamDepth) {
        return {
          id: "create_dream",
          kind: "dream",
          executor: "orchestrator",
          label: `Create nested Dream from ${active.name}'s highest-value uncertainty`
        };
      }
      return {
        id: "kick",
        kind: "kick",
        executor: "codex",
        label: `Kick ${active.name}: return validated memory`
      };
    }

    if (active.codexThreadId?.startsWith("unbound:")) {
      return {
        id: "inspect",
        kind: "advance",
        executor: "codex",
        label: `Ask Codex to audit ${run.definition.scope} and surface the highest-value uncertainty`
      };
    }
    if (!run.memories.length) {
      if (active.proposals.some((proposal) => proposal.status === "open")) {
        return {
          id: "create_dream",
          kind: "dream",
          executor: "orchestrator",
          label: "Create Dream from the highest-value uncertainty"
        };
      }
      return {
        id: "inspect",
        kind: "advance",
        executor: "codex",
        label: `Ask Codex to deepen the ${run.definition.scope} audit`
      };
    }
    if (run.proofResults.some((result) => result.status === "failed")) {
      return {
        id: "repair",
        kind: "advance",
        executor: "codex",
        label: "Ask Codex to repair failed immutable proofs"
      };
    }
    if (active.worldState.implementationState !== "Memories synthesised") {
      return {
        id: "synthesise",
        kind: "advance",
        executor: "codex",
        label: "Synthesise validated memories into the waking Reality"
      };
    }
    if (!run.proofResults.length) {
      return {
        id: "verify",
        kind: "verify",
        executor: "orchestrator",
        label: `Run ${run.definition.proofs.length} immutable mission proof${run.definition.proofs.length === 1 ? "" : "s"}`
      };
    }
    return {
      id: "stabilise",
      kind: "advance",
      executor: "orchestrator",
      label: "Stabilise the proven waking Reality"
    };
  }

  private assertBudget(run: MissionRun): void {
    const used = run.events.reduce((total, event) => {
      const metadata = event.payload.metadata;
      if (!metadata || typeof metadata !== "object") return total;
      const values = metadata as Record<string, unknown>;
      return total
        + (typeof values.inputTokens === "number" ? values.inputTokens : 0)
        + (typeof values.outputTokens === "number" ? values.outputTokens : 0)
        + (typeof values.reasoningTokens === "number" ? values.reasoningTokens : 0);
    }, 0);
    if (used >= run.definition.tokenBudget) {
      throw new Error(`Mission token budget reached (${used.toLocaleString("en-US")} tokens observed).`);
    }
  }

  private async materialiseContext(
    worktrees: WorktreeManagerPort,
    reality: Reality
  ): Promise<void> {
    await worktrees.writeFile(
      reality.worktreePath!,
      ".inception/reality.json",
      `${JSON.stringify({
        id: reality.id,
        parentId: reality.parentId,
        depth: reality.depth,
        premise: reality.premise,
        constitution: reality.constitution,
        subjects: reality.subjects,
        inheritedEvidence: reality.evidence,
        wakeContract: reality.constitution.wakeContract
      }, null, 2)}\n`
    );
    await worktrees.writeFile(
      reality.worktreePath!,
      ".inception/anchors.json",
      `${JSON.stringify(reality.anchors, null, 2)}\n`
    );
  }

  private async emitCodexEvent(
    run: MissionRun,
    reality: Reality,
    event: CodexRuntimeEvent
  ): Promise<void> {
    const type: RealityEventType = event.type === "subject"
      ? event.metadata?.subjectState === "started"
        ? "subject.started"
        : event.metadata?.subjectState === "failed"
          ? "subject.failed"
          : "subject.completed"
      : "codex.progress";
    await this.emit(run, reality, type, event.summary, {
      missionId: run.id,
      kind: event.type,
      metadata: event.metadata,
      operationId: this.activeOperations.get(run.id)?.id,
      action: this.activeOperations.get(run.id)?.action
    });
  }

  private async emitSealedInterventionEvent(
    run: MissionRun,
    reality: Reality,
    contract: MissionInterventionContract,
    event: CodexRuntimeEvent
  ): Promise<void> {
    if (event.type === "subject") {
      await this.emitCodexEvent(run, reality, event);
      return;
    }
    if (event.metadata?.stage === "model") {
      await this.emit(run, reality, "codex.progress", `${event.metadata.model ?? "Codex"} entered the sealed intervention coordinator thread.`, {
        missionId: run.id,
        contractId: contract.id,
        kind: "model",
        metadata: {
          stage: "model",
          status: event.metadata.status,
          model: event.metadata.model,
          sdkVersion: event.metadata.sdkVersion,
          disclosure: "intervention-details-sealed"
        },
        operationId: this.activeOperations.get(run.id)?.id,
        action: "intervene"
      });
    }
  }

  private async emit(
    run: MissionRun,
    reality: Reality,
    type: RealityEventType,
    summary: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: RealityEvent = {
      id: randomUUID(),
      realityId: reality.id,
      type,
      summary,
      dreamTime: reality.worldState.simulatedMinutes,
      payload,
      occurredAt: now()
    };
    run.events.push(event);
    run.updatedAt = event.occurredAt;
    await this.repository.saveMissionRun(MissionRunSchema.parse(run));
    this.eventBus.publish(event);
  }

  private replaceReality(run: MissionRun, reality: Reality): void {
    const index = run.realities.findIndex((entry) => entry.id === reality.id);
    if (index < 0) run.realities.push(reality);
    else run.realities[index] = reality;
    run.updatedAt = now();
  }

  private present(run: MissionRun): MissionSnapshot {
    const activeReality = this.requireActive(run);
    const operation = this.activeOperations.get(run.id) ?? null;
    const presentedRun = MissionRunSchema.parse({
      ...run,
      interventions: run.interventions.map((entry) => {
        if (entry.status === "revealed" || entry.status === "rejected") return entry;
        const {
          baselineCommit: _baselineCommit,
          interventionCommit: _interventionCommit,
          subjectThreadId: _subjectThreadId,
          report: _report,
          ...publicEntry
        } = entry;
        return publicEntry;
      })
    });
    return {
      run: presentedRun,
      activeReality: presentedRun.realities.find((entry) => entry.id === activeReality.id)
        ?? activeReality,
      operation: operation ? { ...operation } : null,
      nextAction: operation ? null : this.describeAction(run, activeReality)
    };
  }

  private requireActive(run: MissionRun): Reality {
    return this.requireReality(run, run.activeRealityId);
  }

  private requireReality(run: MissionRun, id: string): Reality {
    const reality = run.realities.find((entry) => entry.id === id);
    if (!reality) throw new Error(`Reality ${id} is missing from mission ${run.id}.`);
    return reality;
  }

  private async requireRun(id: string): Promise<MissionRun> {
    const run = await this.repository.getMissionRun(id);
    if (!run) throw new Error("Mission not found.");
    return MissionRunSchema.parse(run);
  }
}
