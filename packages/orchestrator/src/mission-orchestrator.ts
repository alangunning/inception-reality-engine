import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  MissionDefinitionDraftSchema,
  MissionDefinitionSchema,
  MissionRunSchema,
  RealityEntity,
  type AnchorResult,
  type InvestigationReport,
  type MissionDefinitionDraft,
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
import type {
  MissionWorkspaceFactoryPort,
  WorktreeManagerPort
} from "./worktree-port";

export type MissionAction =
  | "inspect"
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
  kind: "advance" | "dream" | "kick" | "verify";
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

export class MissionOrchestrator {
  private readonly operationQueues = new Map<string, Promise<void>>();
  private readonly activeOperations = new Map<string, MissionOperation>();

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
          case "create_dream":
            await this.createDream(run, active, workspace.worktrees);
            break;
          case "kick":
            await this.kick(run, active);
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
      subjectReportCount: result.report.subjectReports.length
    });
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
    const child = RealityEntity.create({
      parentId: parent.id,
      depth: parent.depth + 1,
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
        timeDilation: Math.max(2, parent.depth + 2)
      },
      inheritedAnchors: parent.anchors,
      initialBeliefs: parent.beliefs.slice(-1).map((belief) => ({
        statement: belief.statement,
        confidence: belief.confidence,
        origin: "inherited" as const
      }))
    });
    for (const charter of run.definition.subjects) {
      child.addSubject({
        ...charter,
        status: "entered",
        findings: []
      });
    }
    const descriptor = await worktrees.create(child.snapshot().id, "HEAD", parent.worktreePath);
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
    for (const subject of dream.subjects) {
      await this.emit(run, dream, "subject.entered", `Subject entered: ${subject.name}, ${subject.role}.`, {
        missionId: run.id,
        subjectId: subject.id,
        role: subject.role
      });
    }
  }

  private async kick(run: MissionRun, reality: Reality): Promise<void> {
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
    run.memories = [
      ...run.memories.filter((memory) => memory.realityId !== result.report.realityId),
      result.report
    ];
    const parent = this.requireReality(run, reality.parentId);
    const parentEntity = RealityEntity.hydrate(parent);
    const proposal = parent.proposals.find((entry) => entry.status === "dreaming");
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
        label: "Synthesize validated memories into the waking Reality"
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
    return {
      run: MissionRunSchema.parse(run),
      activeReality,
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
