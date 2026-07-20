import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  MissionDefinitionDraftSchema,
  MissionDefinitionSchema,
  MissionRunSchema,
  RealityEntity,
  WakeReportSchema,
  type AdversarialDiagnosis,
  type AdversarialInterventionLedger,
  type AdversarialInterventionReport,
  type AnchorResult,
  type InvestigationReport,
  type MissionDependencyBootstrap,
  type MissionInterventionContract,
  type MissionDefinitionDraft,
  type MissionAutopilotState,
  type MemoryIntegritySeal,
  type MissionRun,
  type Reality,
  type RealityEvent,
  type RealityEventType,
  type WakeReport
} from "@inception/domain";
import {
  CodexOutputValidationError,
  type CodexObservedSubject,
  type CodexRuntime,
  type CodexRuntimeEvent
} from "./codex-port";
import type { RealityEventBus, RealityRepository } from "./ports";
import { MemoryIntegrityService } from "./memory-integrity-service";
import { CounterfactualReflectionService } from "./counterfactual-reflection-service";
import {
  DependencyBootstrapService,
  type DependencyBootstrapResult
} from "./dependency-bootstrap-service";
import {
  autopilotActiveMilliseconds,
  pauseAutopilotClock,
  resumeAutopilotClock
} from "./autopilot-clock";
import type {
  MissionWorkspace,
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

export interface MissionAutopilotOptions {
  maxActions?: number;
  maxMinutes?: number;
  pauseOnDream?: boolean;
  pauseOnIntervention?: boolean;
}

export interface InterventionBudgetApproval {
  tokenBudget: number;
  retry?: boolean;
}

export interface MissionLimitApproval {
  tokenBudget: number;
  maxActions: number;
  maxMinutes: number;
}

export type MissionAutopilotCommand =
  | { command: "start"; options?: MissionAutopilotOptions }
  | { command: "resume" }
  | { command: "pause" }
  | { command: "stop" };

const DEFAULT_WAKE_CONTRACT = [
  "State initial beliefs and what changed.",
  "Return reproducible evidence and artefacts.",
  "Separate invariants from world-specific observations.",
  "Preserve remaining uncertainty."
];

function now(): string {
  return new Date().toISOString();
}

function dependencyPath(contract: MissionDependencyBootstrap): string {
  return contract.kind === "python-venv"
    ? contract.virtualEnvironmentPath
    : contract.dependencyPath;
}

function resolveOutstandingProposals(reality: Reality): Reality {
  const entity = RealityEntity.hydrate(reality);
  for (const proposal of reality.proposals) {
    if (proposal.status === "open" || proposal.status === "dreaming") {
      entity.updateProposal(proposal.id, "resolved");
    }
  }
  return entity.snapshot();
}

function dependencyRuntimeCommand(contract: MissionDependencyBootstrap): string {
  return contract.kind === "python-venv"
    ? `${contract.virtualEnvironmentPath}/bin/python`
    : contract.nodeExecutable;
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

function safeValidationFailure(error: unknown): {
  contract: string;
  issues: Array<{ path: string; code: string }>;
} | undefined {
  if (!(error instanceof CodexOutputValidationError)) return undefined;
  return {
    contract: error.contract,
    issues: error.issues.slice(0, 10).map((issue) => ({
      path: issue.path.slice(0, 160),
      code: issue.code.slice(0, 100)
    }))
  };
}

function runtimeTokenEvidence(events: CodexRuntimeEvent[]): number {
  return events.reduce((total, event) =>
    total
    + (event.metadata?.inputTokens ?? 0)
    + (event.metadata?.outputTokens ?? 0), 0);
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

function defensiveLanguage(value: string): string {
  return value
    .replace(/\battacks?\b/gi, "negative-test scenarios")
    .replace(/\battackers?\b/gi, "independent test sources")
    .replace(/\bexploits?\b/gi, "documented defects")
    .replace(/\bbreaches?\b/gi, "boundary failures")
    .replace(/\bhacking\b/gi, "authorized local source review")
    .replace(/\badversarial\b/gi, "counterfactual");
}

export class MissionOrchestrator {
  private readonly operationQueues = new Map<string, Promise<void>>();
  private readonly activeOperations = new Map<string, MissionOperation>();
  private readonly autopilotControls = new Map<string, MissionAutopilotState>();
  private readonly autopilotLoops = new Map<string, Promise<void>>();
  private readonly memoryIntegrity = new MemoryIntegrityService();
  private readonly reflections = new CounterfactualReflectionService();
  private readonly dependencyBootstrap = new DependencyBootstrapService();

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
    if (
      draft.dependencyBootstrap?.targetDepth
      && draft.dependencyBootstrap.targetDepth > draft.maxDreamDepth
    ) {
      throw new Error("The dependency bootstrap target depth must fit within the Mission Dream depth.");
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
          "Do not expose raw model reasoning."
        ],
        wakeContract: definition.wakeContract,
        parentTruths: definition.parentTruths,
        timeDilation: 1,
        runtimeLaws: [
          "Only validated Codex outputs may enter this Reality.",
          "A failed immutable proof prevents Reality stabilisation.",
          ...definition.runtimeLaws
        ],
        safetyProfile: definition.safetyProfile,
        memoryPolicy: definition.memoryPolicy,
        dreamStrategy: definition.dreamStrategy,
        maxSiblingDreams: definition.maxSiblingDreams
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
      eventCount: 0,
      observedTokens: 0,
      activeRealityId: reality.id,
      memories: [],
      interventions: [],
      memoryIntegrity: [],
      reflections: [],
      autopilot: {
        mode: "off",
        kind: "guided-real",
        maxActions: 60,
        maxMinutes: 180,
        pauseOnDream: true,
        pauseOnIntervention: true,
        actionsCompleted: 0,
        activeMilliseconds: 0
      },
      proofResults: [],
      finalDiff: "",
      createdAt,
      updatedAt: createdAt
    });
    await this.emit(run, reality, "reality.created", `${definition.name} created with ${definition.proofs.length} immutable proof${definition.proofs.length === 1 ? "" : "s"}.`, {
      missionId: id,
      depthBudget: definition.maxDreamDepth,
      tokenBudget: definition.tokenBudget
    });
    return this.present(run);
  }

  async snapshot(id: string): Promise<MissionSnapshot> {
    const run = await this.requireRun(id);
    if (
      run.status === "stabilised"
      && run.realities.some((reality) =>
        reality.proposals.some((proposal) =>
          proposal.status === "open" || proposal.status === "dreaming"
        )
      )
    ) {
      run.realities = run.realities.map(resolveOutstandingProposals);
      run.updatedAt = now();
      const root = run.realities.find((reality) => reality.depth === 0);
      if (root?.worktreePath) {
        try {
          const workspace = await this.workspaces.open(run.definition.repositoryPath, run.id);
          if (await workspace.worktrees.isPresent(root.worktreePath)) {
            run.finalDiff = await workspace.worktrees.diff(
              root.worktreePath,
              ":(exclude).inception/**"
            );
          }
        } catch {
          // Preserve the last validated diff when an archived repository is unavailable.
        }
      }
      await this.repository.saveMissionRun(MissionRunSchema.parse(run));
    }
    if (
      run.autopilot.mode === "paused"
      && run.autopilot.pauseReason === "The configured auto-mode wall-clock limit was reached."
      && run.autopilot.activeMilliseconds < run.autopilot.maxMinutes * 60_000
    ) {
      run.autopilot = {
        ...run.autopilot,
        pauseReason: "Inactive and paused time was excluded from the active-runtime limit. Retry the pending Reality action when ready.",
        approvedAction: undefined,
        updatedAt: now()
      };
      await this.repository.saveMissionRun(MissionRunSchema.parse(run));
    }
    if (
      run.autopilot.mode === "running"
      && !this.autopilotControls.has(id)
      && !this.autopilotLoops.has(id)
    ) {
      const active = this.requireActive(run);
      const timestamp = now();
      run.autopilot = {
        ...run.autopilot,
        ...pauseAutopilotClock(run.autopilot, run.autopilot.updatedAt ?? timestamp),
        mode: "paused",
        pauseReason: "The server restarted; resume explicitly so page load never starts Codex.",
        updatedAt: timestamp
      };
      await this.emit(
        run,
        active,
        "autopilot.paused",
        "Guided auto mode paused after a server restart; explicit resume is required.",
        {
          missionId: id,
          actionsCompleted: run.autopilot.actionsCompleted,
          reason: run.autopilot.pauseReason
        }
      );
    }
    return this.present(run);
  }

  async list(): Promise<MissionRun[]> {
    return this.repository.listMissionRuns(20);
  }

  async events(id: string, limit = 500, before?: string): Promise<RealityEvent[]> {
    const run = await this.requireRun(id);
    const events = await this.repository.listMissionEvents(
      id,
      Math.max(1, Math.min(limit, 100_000)),
      before
    );
    const [beforeTime, beforeId] = before?.split("|") ?? [];
    return events.length
      ? events
      : run.events
          .filter((event) => !beforeTime
            || event.occurredAt < beforeTime
            || (event.occurredAt === beforeTime && event.id < (beforeId ?? "")))
          .slice(-limit);
  }

  async controlAutopilot(
    id: string,
    command: MissionAutopilotCommand
  ): Promise<MissionSnapshot> {
    const run = await this.requireRun(id);
    const active = this.requireActive(run);
    const timestamp = now();
    if (command.command === "start") {
      if (run.status === "stabilised") {
        throw new Error("This Reality is already stabilised.");
      }
      const options = command.options ?? {};
      run.autopilot = {
        mode: "running",
        kind: "guided-real",
        maxActions: Math.max(1, Math.min(options.maxActions ?? 60, 100)),
        maxMinutes: Math.max(1, Math.min(options.maxMinutes ?? 180, 180)),
        pauseOnDream: options.pauseOnDream ?? true,
        pauseOnIntervention: options.pauseOnIntervention ?? true,
        actionsCompleted: 0,
        activeMilliseconds: 0,
        activeSince: timestamp,
        startedAt: timestamp,
        updatedAt: timestamp
      };
      this.autopilotControls.set(id, { ...run.autopilot });
      await this.emit(run, active, "autopilot.started", "Guided auto mode started; parent-owned gates remain armed.", {
        missionId: id,
        kind: run.autopilot.kind,
        maxActions: run.autopilot.maxActions,
        maxMinutes: run.autopilot.maxMinutes,
        pauseOnDream: run.autopilot.pauseOnDream,
        pauseOnIntervention: run.autopilot.pauseOnIntervention
      });
      this.startAutopilotLoop(id);
    } else if (command.command === "resume") {
      if (run.autopilot.mode !== "paused") {
        throw new Error("Guided auto mode is not paused.");
      }
      const approvedAction = this.describeAction(run, active)?.id;
      if (run.status === "fractured" && !approvedAction) {
        throw new Error("This fractured Reality has no retryable action.");
      }
      const recoveringFracture = run.status === "fractured";
      if (recoveringFracture) run.status = "exploring";
      run.autopilot = {
        ...run.autopilot,
        ...resumeAutopilotClock(run.autopilot, timestamp),
        mode: "running",
        approvedAction,
        pauseReason: undefined,
        updatedAt: timestamp
      };
      this.autopilotControls.set(id, { ...run.autopilot });
      if (recoveringFracture) {
        await this.emit(
          run,
          active,
          "reality.recovered",
          `Operator approved retry from ${active.name}; the next bounded action may proceed.`,
          {
            missionId: id,
            approvedAction,
            recovery: "explicit-retry"
          }
        );
      } else {
        await this.repository.saveMissionRun(MissionRunSchema.parse(run));
      }
      this.startAutopilotLoop(id);
    } else {
      const mode = command.command === "pause" ? "paused" as const : "stopped" as const;
      run.autopilot = {
        ...run.autopilot,
        ...pauseAutopilotClock(run.autopilot, timestamp),
        mode,
        pauseReason: command.command === "pause"
          ? "Paused by the operator after the current action."
          : "Stopped by the operator after the current action.",
        updatedAt: timestamp
      };
      this.autopilotControls.set(id, { ...run.autopilot });
      await this.emit(
        run,
        active,
        command.command === "pause" ? "autopilot.paused" : "autopilot.stopped",
        command.command === "pause"
          ? "Guided auto mode paused by the operator."
          : "Guided auto mode stopped by the operator.",
        { missionId: id, actionsCompleted: run.autopilot.actionsCompleted }
      );
    }
    return this.snapshot(id);
  }

  async approveLimits(
    id: string,
    approval: MissionLimitApproval
  ): Promise<MissionSnapshot> {
    if (this.activeOperations.has(id)) {
      throw new Error("Wait for the active Reality operation before changing Mission limits.");
    }
    const run = await this.requireRun(id);
    const active = this.requireActive(run);
    if (
      !Number.isInteger(approval.tokenBudget)
      || approval.tokenBudget < run.definition.tokenBudget
      || approval.tokenBudget > 30_000_000
    ) {
      throw new Error(
        `Approve a Mission token ceiling from ${run.definition.tokenBudget.toLocaleString("en-US")} to 30,000,000.`
      );
    }
    if (
      !Number.isInteger(approval.maxActions)
      || approval.maxActions < run.autopilot.maxActions
      || approval.maxActions > 100
    ) {
      throw new Error(
        `Approve an action ceiling from ${run.autopilot.maxActions} to 100.`
      );
    }
    if (
      !Number.isInteger(approval.maxMinutes)
      || approval.maxMinutes < run.autopilot.maxMinutes
      || approval.maxMinutes > 180
    ) {
      throw new Error(
        `Approve an active-runtime ceiling from ${run.autopilot.maxMinutes} to 180 minutes.`
      );
    }
    if (approval.tokenBudget < this.observedTokens(run)) {
      throw new Error(
        `The approved token ceiling cannot be below the Mission's ${this.observedTokens(run).toLocaleString("en-US")} observed tokens.`
      );
    }

    const previous = {
      tokenBudget: run.definition.tokenBudget,
      maxActions: run.autopilot.maxActions,
      maxMinutes: run.autopilot.maxMinutes
    };
    run.definition = MissionDefinitionSchema.parse({
      ...run.definition,
      tokenBudget: approval.tokenBudget
    });
    run.autopilot = {
      ...run.autopilot,
      maxActions: approval.maxActions,
      maxMinutes: approval.maxMinutes,
      updatedAt: now()
    };
    this.autopilotControls.set(id, { ...run.autopilot });
    await this.emit(
      run,
      active,
      "mission.limits.approved",
      "Operator increased the bounded Mission limits without resetting Reality state.",
      {
        missionId: id,
        previous,
        approved: approval,
        observedTokens: this.observedTokens(run)
      }
    );
    return this.snapshot(id);
  }

  async approveInterventionBudget(
    id: string,
    approval: InterventionBudgetApproval
  ): Promise<MissionSnapshot> {
    if (this.activeOperations.has(id)) {
      throw new Error("Wait for the active Reality operation before changing its intervention budget.");
    }
    const run = await this.requireRun(id);
    const active = this.requireActive(run);
    const contract = this.requireInterventionContract(run, active);
    const ledger = run.interventions.find((entry) => entry.realityId === active.id);
    if (!ledger || ledger.status !== "rejected") {
      throw new Error("No rejected adversarial intervention is waiting for a budget approval.");
    }
    if (
      ledger.rejectionCode !== "intervention_token_budget_exceeded"
      && !ledger.rejectionReason?.includes("intervention_token_budget_exceeded")
    ) {
      throw new Error("This intervention was rejected for a contract violation that more tokens cannot resolve.");
    }

    const requested = approval.tokenBudget;
    const sameHardCeilingRetry = requested === contract.tokenBudget
      && requested === 500_000
      && approval.retry !== false;
    if (
      !Number.isInteger(requested)
      || requested < contract.tokenBudget
      || (requested === contract.tokenBudget && !sameHardCeilingRetry)
    ) {
      throw new Error(
        `Approve an intervention ceiling above the current ${contract.tokenBudget.toLocaleString("en-US")} tokens, or explicitly retry at the 500,000-token hard ceiling.`
      );
    }
    if (requested > 500_000) {
      throw new Error("The adversarial intervention ceiling cannot exceed 500,000 tokens.");
    }
    const remainingMissionTokens = Math.max(
      0,
      run.definition.tokenBudget - this.observedTokens(run)
    );
    if (requested > remainingMissionTokens) {
      throw new Error(
        `The requested retry ceiling exceeds the Mission's remaining ${remainingMissionTokens.toLocaleString("en-US")} observed-token budget.`
      );
    }

    const previousTokenBudget = contract.tokenBudget;
    const approvedAt = now();
    run.definition = MissionDefinitionSchema.parse({
      ...run.definition,
      intervention: {
        ...contract,
        tokenBudget: requested
      }
    });
    ledger.budgetApprovals.push({
      previousTokenBudget,
      approvedTokenBudget: requested,
      failedAttemptTokens: ledger.lastAttemptTokens,
      approvedAt
    });

    const retry = approval.retry ?? true;
    if (retry && run.autopilot.mode === "paused") {
      run.autopilot = {
        ...run.autopilot,
        ...resumeAutopilotClock(run.autopilot, approvedAt),
        mode: "running",
        approvedAction: "intervene",
        pauseReason: undefined,
        updatedAt: approvedAt
      };
      this.autopilotControls.set(id, { ...run.autopilot });
    }
    await this.emit(
      run,
      active,
      "intervention.budget.approved",
      sameHardCeilingRetry
        ? "Operator approved a fresh-context intervention retry at the existing 500,000-token hard ceiling."
        : `Operator approved a bounded intervention retry ceiling of ${requested.toLocaleString("en-US")} tokens.`,
      {
        missionId: id,
        contractId: contract.id,
        previousTokenBudget,
        approvedTokenBudget: requested,
        failedAttemptTokens: ledger.lastAttemptTokens,
        remainingMissionTokens,
        coordinatorContext: "fresh-after-rejected-attempt",
        sameHardCeilingRetry,
        retry
      }
    );

    if (!retry) return this.snapshot(id);
    if (run.autopilot.mode === "running") {
      this.startAutopilotLoop(id);
      return this.snapshot(id);
    }
    return this.act(id, "intervene");
  }

  async act(id: string, action: MissionAction): Promise<MissionSnapshot> {
    const prior = this.operationQueues.get(id) ?? Promise.resolve();
    const runOperation = prior.then(async () => {
      const run = await this.requireRun(id);
      let active = this.requireActive(run);
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
        active = await this.ensureActionWorktree(
          run,
          active,
          workspace,
          action
        );
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
        if (run.status === "fractured") {
          run.status = "exploring";
          await this.emit(
            run,
            this.requireActive(run),
            "reality.recovered",
            `${expected.label} succeeded on retry; the Reality may continue.`,
            {
              missionId: run.id,
              action,
              recovery: "successful-action"
            }
          );
        }
      } catch (error) {
        const validation = safeValidationFailure(error);
        run.status = validation ? "exploring" : "fractured";
        await this.emit(
          run,
          this.requireReality(run, operation.realityId),
          validation ? "validation.rejected" : "reality.fractured",
          safeFailure(error),
          {
            missionId: run.id,
            action,
            validation
          }
        );
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

  async reset(id: string): Promise<MissionSnapshot> {
    if (this.activeOperations.has(id)) {
      throw new Error("Stop the active Codex operation before resetting this mission.");
    }
    const run = await this.requireRun(id);
    const intervention = run.definition.intervention;
    const draft = MissionDefinitionDraftSchema.parse({
      name: run.definition.name,
      repositoryPath: run.definition.repositoryPath,
      mission: run.definition.mission,
      scope: run.definition.scope,
      premise: run.definition.premise,
      constraints: run.definition.constraints,
      parentTruths: run.definition.parentTruths,
      wakeContract: run.definition.wakeContract,
      runtimeLaws: run.definition.runtimeLaws,
      safetyProfile: run.definition.safetyProfile,
      memoryPolicy: run.definition.memoryPolicy,
      dreamStrategy: run.definition.dreamStrategy,
      maxSiblingDreams: run.definition.maxSiblingDreams,
      proofs: run.definition.proofs.map(({ id: _id, ...proof }) => proof),
      subjects: run.definition.subjects.map(({ id: _id, ...subject }) => subject),
      intervention: intervention ? {
        enabled: intervention.enabled,
        subject: {
          name: intervention.subject.name,
          role: intervention.subject.role,
          mission: intervention.subject.mission
        },
        hypothesis: intervention.hypothesis,
        faultClasses: intervention.faultClasses,
        allowedPaths: intervention.allowedPaths,
        protectedPaths: intervention.protectedPaths,
        maxChangedFiles: intervention.maxChangedFiles,
        maxPatchLines: intervention.maxPatchLines,
        tokenBudget: intervention.tokenBudget,
        maxMinutes: intervention.maxMinutes,
        targetDepth: intervention.targetDepth,
        revealPolicy: intervention.revealPolicy,
        requireRollbackCommit: intervention.requireRollbackCommit
      } : undefined,
      dependencyBootstrap: run.definition.dependencyBootstrap,
      tokenBudget: run.definition.tokenBudget,
      maxDreamDepth: run.definition.maxDreamDepth
    });
    const replacement = await this.create(draft);
    await this.delete(id);
    return replacement;
  }

  async deleteAll(): Promise<{ deletedMissions: number; removedWorktrees: number }> {
    if (this.activeOperations.size) {
      throw new Error("Stop all active Codex operations before deleting saved missions.");
    }
    let deletedMissions = 0;
    let removedWorktrees = 0;
    while (true) {
      const runs = await this.repository.listMissionRuns(100);
      if (!runs.length) break;
      for (const run of runs) {
        removedWorktrees += await this.delete(run.id);
        deletedMissions += 1;
      }
    }
    removedWorktrees += (await this.workspaces.cleanupAll?.()) ?? 0;
    return {
      deletedMissions,
      removedWorktrees
    };
  }

  private async inspect(
    run: MissionRun,
    reality: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    // Refresh persisted pre-contract Missions before Codex reads their worktree.
    await this.materialiseContext(worktrees, reality);
    const dependencyEnvironment = await this.ensureDependencyEnvironment(
      run,
      reality,
      worktrees,
      "inspection"
    );
    if (dependencyEnvironment?.status === "failed") {
      throw new Error(
        `Reality-local dependency bootstrap failed: ${dependencyEnvironment.diagnostic}`
      );
    }
    const baselineCommit = await worktrees.checkpoint(
      reality.worktreePath!,
      `Reality baseline before Codex inspection ${reality.id}`
    );
    const usedBefore = this.observedTokens(run);
    const remainingTokenEvidence = Math.max(0, run.definition.tokenBudget - usedBefore);

    try {
      const result = await this.codexRuntime.inspect(
        {
          ...reality,
          codexThreadId: reality.codexThreadId?.startsWith("unbound:")
            ? undefined
            : reality.codexThreadId,
          constitution: {
            ...reality.constitution,
            constraints: [
              ...reality.constitution.constraints,
              ...(dependencyEnvironment ? [
                `Use ${dependencyRuntimeCommand(run.definition.dependencyBootstrap!)} for dependency-backed proofs; its exact pinned manifest was parent-authorized and verified for this Reality.`
              ] : []),
              `Return promptly enough to keep this turn within the remaining observed SDK token ceiling of ${remainingTokenEvidence.toLocaleString("en-US")} input plus output tokens.`
            ]
          }
        },
        async (event) => {
          const current = event.metadata?.threadId
            ? await this.bindRealityThread(run, reality.id, event.metadata.threadId)
            : this.requireReality(run, reality.id);
          if (event.metadata?.threadId) return;
          await this.emitCodexEvent(run, current, event);
        }
      );
      const bound = await this.bindRealityThread(run, reality.id, result.threadId);
      this.assertTurnWithinTokenCeiling(run, usedBefore, result.events);
      this.validateSubjectReports(bound, result.report, result.observedSubjects ?? []);

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

      if (bound.kind === "waking") {
        await worktrees.restoreCheckpoint(bound.worktreePath!, baselineCommit);
      }
      const entity = RealityEntity.hydrate(bound);
      for (const subject of result.observedSubjects ?? []) {
        if (entity.snapshot().subjects.some((entry) => entry.id === subject.id)) continue;
        entity.addSubject({
          id: subject.id,
          name: subject.name,
          role: subject.role,
          mission: subject.mission,
          status: "entered",
          findings: []
        });
      }
      this.applyInvestigation(entity, result.report);
      entity
        .advanceTime(12, "Evaluating counterfactual evidence", result.report.summary)
        .setImplementationState(bound.kind === "waking"
          ? "Codex inspection complete; implementation baseline preserved"
          : "Codex inspection complete")
        .setStatus("exploring", "Uncertainty mapped");
      const updated = entity.snapshot();
      this.replaceReality(run, updated);
      await this.materialiseContext(worktrees, updated);
      if (bound.kind === "waking") {
        await worktrees.checkpoint(
          updated.worktreePath!,
          `Admit validated Reality context ${updated.id}`
        );
      }
      await this.emit(run, updated, "inspection.completed", `Codex inspected ${run.definition.scope} and returned validated evidence.`, {
        missionId: run.id,
        evidenceCount: result.report.evidence.length,
        subjectReportCount: result.report.subjectReports.length,
        adversarialDiagnosisReturned: Boolean(result.report.adversarialDiagnosis),
        baselineRestored: bound.kind === "waking",
        retainedChangedFiles: bound.kind === "waking" ? [] : result.report.changedFiles
      });
    } catch (error) {
      await worktrees.restoreCheckpoint(reality.worktreePath!, baselineCommit);
      const current = this.requireReality(run, reality.id);
      const recovered = RealityEntity.hydrate(current)
        .setStatus("exploring", "Rejected Codex turn rolled back")
        .snapshot();
      this.replaceReality(run, recovered);
      await this.materialiseContext(worktrees, recovered);
      await this.emit(run, recovered, "reality.recovered", `Rejected inspection changes were removed from ${reality.name}; its isolated baseline and Codex thread were retained.`, {
        missionId: run.id,
        baselineCommit,
        threadId: recovered.codexThreadId,
        validation: safeValidationFailure(error)
      });
      throw error;
    }
  }

  private async intervene(
    run: MissionRun,
    reality: Reality,
    worktrees: WorktreeManagerPort
  ): Promise<void> {
    const contract = this.requireInterventionContract(run, reality);
    const ledger = this.requireInterventionLedger(run, reality);
    const retryingRejectedIntervention = ledger.status === "rejected";
    ledger.status = "injecting";
    ledger.startedAt = now();
    ledger.rejectionReason = undefined;
    ledger.rejectionCode = undefined;
    ledger.lastAttemptTokens = undefined;
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
      maxMinutes: contract.maxMinutes,
      coordinatorContext: retryingRejectedIntervention
        ? "fresh-after-rejected-attempt"
        : "reality-thread"
    });

    let baselineCommit: string | undefined;
    const observedBeforeAttempt = run.observedTokens;
    try {
      baselineCommit = await worktrees.checkpoint(
        reality.worktreePath!,
        `Reality baseline before sealed intervention ${ledger.id}`
      );
      ledger.baselineCommit = baselineCommit;
      const result = await this.codexRuntime.intervene(
        retryingRejectedIntervention
          ? { ...reality, codexThreadId: undefined }
          : reality,
        contract,
        async (event) => this.emitSealedInterventionEvent(run, reality, contract, event)
      );
      ledger.lastAttemptTokens = runtimeTokenEvidence(result.events);
      const tokensAlreadyRecorded = Math.max(0, run.observedTokens - observedBeforeAttempt);
      run.observedTokens += Math.max(0, ledger.lastAttemptTokens - tokensAlreadyRecorded);
      const boundReality = await this.bindRealityThread(
        run,
        reality.id,
        result.coordinatorThreadId
      );
      const actualChangedFiles = await worktrees.listChangedFiles(reality.worktreePath!);
      const validated = await this.validateIntervention(
        worktrees,
        boundReality,
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
        ...boundReality,
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
      const validation = safeValidationFailure(error);
      ledger.status = "rejected";
      ledger.rejectionCode = validation?.issues[0]?.code;
      ledger.rejectionReason = ledger.rejectionCode === "intervention_token_budget_exceeded"
        ? `The Adversarial Subject used ${(ledger.lastAttemptTokens ?? 0).toLocaleString("en-US")} tokens, above the approved ${contract.tokenBudget.toLocaleString("en-US")} ceiling. The Dream was restored; approve a higher bounded ceiling before retrying.`
        : safeFailure(error);
      ledger.report = undefined;
      ledger.interventionCommit = undefined;
      ledger.subjectThreadId = undefined;
      ledger.changedFileCount = undefined;
      ledger.patchLineCount = undefined;
      await this.emit(run, reality, "intervention.rejected", `Sealed intervention rejected and the Dream restored to its baseline: ${ledger.rejectionReason}`, {
        missionId: run.id,
        contractId: contract.id,
        rollbackApplied: Boolean(baselineCommit),
        rejectionCode: ledger.rejectionCode,
        attemptTokens: ledger.lastAttemptTokens,
        approvedTokenBudget: contract.tokenBudget
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
      && run.interventions.length === 0
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
        armedAt: now(),
        budgetApprovals: []
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
    if (!reality.parentId) throw new Error("Reality cannot be kicked.");
    await this.emit(run, reality, "kick.triggered", `Kick triggered: ${reality.name} must return what generalises.`, {
      missionId: run.id
    });
    await this.emit(run, reality, "wake.collecting", `Collecting evidence, artefacts, and changed beliefs from ${reality.name}.`, {
      missionId: run.id,
      wakeStage: "collecting",
      wakeStageIndex: 1
    });
    const result = await this.codexRuntime.wake(
      reality,
      async (event) => this.emitCodexEvent(run, reality, event)
    );
    const bound = RealityEntity.hydrate(reality)
      .bindRuntime(result.threadId, reality.worktreePath!, reality.branchName!)
      .snapshot();
    this.replaceReality(run, bound);
    const parent = this.requireReality(run, reality.parentId);
    const parentEntity = RealityEntity.hydrate(parent);
    const proposal = parent.proposals.find((entry) => entry.status === "dreaming");
    const interventionOutcome = await this.revealIntervention(run, bound);
    const report = await this.containIntervention(
      run,
      bound,
      result.report,
      worktrees
    );
    const kicked = RealityEntity.hydrate(resolveOutstandingProposals(bound))
      .setWakeReport(report)
      .snapshot();
    this.replaceReality(run, kicked);
    await this.emit(run, kicked, "wake.sealing", `Totem Check is sealing ${reality.name}'s structured memory to its Git source and descendant lineage.`, {
      missionId: run.id,
      wakeStage: "sealing",
      wakeStageIndex: 2
    });
    const integritySeal = await this.sealMemoryIntegrity(
      run,
      kicked,
      parent,
      report,
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
    await this.emit(run, kicked, "wake.returning", `Validated memory is returning from ${reality.name} to ${parent.name}.`, {
      missionId: run.id,
      parentRealityId: parent.id,
      wakeStage: "returning",
      wakeStageIndex: 3
    });
    run.memories = [
      ...run.memories.filter((memory) => memory.realityId !== report.realityId),
      report
    ];
    if (proposal) parentEntity.updateProposal(proposal.id, "resolved");
    const awakenedParent = parentEntity
      .advanceTime(4, "Receiving validated memory", report.recommendation)
      .snapshot();
    this.replaceReality(run, awakenedParent);
    run.activeRealityId = parent.id;
    await this.reflectSiblingMemories(run, awakenedParent);
    await this.emit(run, kicked, "memory.returned", `Memory returned from ${reality.name}.`, {
      missionId: run.id,
      parentRealityId: parent.id,
      artefactCount: report.artefacts.length,
      invariantCount: report.invariants.length
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
      let source = this.requireReality(run, memory.realityId);
      const seal = run.memoryIntegrity.find((candidate) =>
        candidate.realityId === memory.realityId
      );
      if (
        seal?.verdict === "verified"
        && !await worktrees.isPresent(source.worktreePath)
      ) {
        source = await this.restoreSealedWorktree(run, source, seal.sourceCommit, worktrees);
      }
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
    const reflectedMemories = run.definition.dreamStrategy === "competing-siblings"
      ? run.memories.map((memory) => {
          const reflections = run.reflections.filter((reflection) =>
            reflection.realityIds.includes(memory.realityId)
          );
          if (!reflections.length) return memory;
          const shared = new Set(
            reflections
              .flatMap((reflection) => reflection.sharedInvariants)
              .map((invariant) => invariant.trim().toLowerCase())
          );
          const invariants = memory.invariants.filter((invariant) =>
            shared.has(invariant.trim().toLowerCase())
          );
          return {
            ...memory,
            invariants,
            recommendation: invariants.length
              ? `Only these conclusions survived the sibling Dream Reality Mirror: ${invariants.join("; ")}. Preserve every recorded disagreement as uncertainty.`
              : "No conclusion survived every sibling Dream. Preserve the disagreement and use only reproducible evidence plus parent-owned proofs."
          };
        })
      : run.memories;
    const synthesisMemories = run.definition.memoryPolicy === "verified-invariants-only"
      ? reflectedMemories.map((memory) => ({
          ...memory,
          experiences: [],
          changedBeliefs: [],
          artefacts: [],
          recommendation: `Generalise only these verified invariants: ${memory.invariants.join("; ")}`
        }))
      : reflectedMemories;
    if (run.definition.memoryPolicy === "verified-reports-and-artefacts") {
      await this.promoteArtefacts(run, root, worktrees);
    }
    const synthesisEnvironment = await this.ensureDependencyEnvironment(
      run,
      root,
      worktrees,
      "synthesis"
    );
    if (synthesisEnvironment?.status === "failed") {
      throw new Error(
        `Reality-local dependency bootstrap failed before synthesis: ${synthesisEnvironment.diagnostic}`
      );
    }
    const result = await this.codexRuntime.synthesise(
      {
        ...root,
        codexThreadId: root.codexThreadId?.startsWith("unbound:")
          ? undefined
          : root.codexThreadId
      },
      synthesisMemories,
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
    run.finalDiff = await worktrees.diff(
      root.worktreePath!,
      ":(exclude).inception/**"
    );
    await this.emit(run, updated, "synthesis.completed", repairContext ? "Reality repair returned from Codex." : "Returned memories synthesised into Reality.", {
      missionId: run.id,
      appliedMemoryCount: result.report.appliedMemories.length,
      changedFileCount: result.report.changedFiles.length,
      siblingReflectionCount: run.reflections.length,
      conclusionPolicy: run.definition.dreamStrategy === "competing-siblings"
        ? "shared-invariants-only"
        : "single-chain"
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
    const verificationEnvironment = await this.ensureDependencyEnvironment(
      run,
      root,
      worktrees,
      "verification"
    );
    if (verificationEnvironment?.status === "failed") {
      throw new Error(
        `Reality-local dependency bootstrap failed before immutable proofs: ${verificationEnvironment.diagnostic}`
      );
    }
    run.status = "verifying";
    await this.emit(run, root, "verification.started", "Immutable Mission proofs entered Reality.", {
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
    run.finalDiff = await worktrees.diff(
      root.worktreePath!,
      ":(exclude).inception/**"
    );
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
    run.realities = run.realities.map(resolveOutstandingProposals);
    const stabilised = RealityEntity.hydrate(this.requireReality(run, root.id))
      .setStatus("stabilised", "Reality stabilised")
      .advanceTime(2, "Reality stabilised", "Counterfactual memories survived parent-owned proof.")
      .snapshot();
    this.replaceReality(run, stabilised);
    run.status = "stabilised";
    run.finalDiff = await worktrees.diff(
      root.worktreePath!,
      ":(exclude).inception/**"
    );
    run.outcome = this.reflections.outcome(run, stabilised, now());
    await this.emit(run, stabilised, "reality.stabilised", "Reality stabilised: returned knowledge and implementation survived every immutable proof.", {
      missionId: run.id,
      memoryCount: run.memories.length,
      proofCount: run.proofResults.length,
      outcomeMetrics: run.outcome.metrics
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
    const proposals = [
      report.dreamProposal,
      report.alternativeDreamProposal
    ].filter((proposal): proposal is NonNullable<typeof proposal> => Boolean(proposal));
    const admittedProposals = entity.snapshot().constitution.safetyProfile === "authorized-local-defensive-review"
      ? proposals.map((proposal) => ({
          ...proposal,
          title: defensiveLanguage(proposal.title),
          premise: defensiveLanguage(proposal.premise),
          uncertainty: defensiveLanguage(proposal.uncertainty),
          rationale: defensiveLanguage(proposal.rationale),
          expectedInsight: defensiveLanguage(proposal.expectedInsight)
        }))
      : proposals;
    for (const proposal of admittedProposals) {
      entity.addProposal({
        id: randomUUID(),
        ...proposal,
        status: "open"
      });
    }
  }

  private validateSubjectReports(
    reality: Reality,
    report: InvestigationReport,
    observedSubjects: CodexObservedSubject[]
  ): void {
    const active = reality.subjects.filter((subject) =>
      subject.status === "entered" || subject.status === "investigating"
    );
    const expected = [
      ...active,
      ...observedSubjects.filter((subject) =>
        !active.some((entry) => entry.id === subject.id)
      )
    ];
    const valid = expected.length === report.subjectReports.length
      && expected.every((subject) => report.subjectReports.some((entry) =>
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
      + (event.metadata?.outputTokens ?? 0), 0);
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
    await this.emit(run, reality, "intervention.revealed", `Intervention revealed: investigator Subjects ${outcome === "detected" ? "identified" : outcome === "partial" ? "partially identified" : "missed"} the adversarial fault.`, {
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

  private async containIntervention(
    run: MissionRun,
    reality: Reality,
    report: WakeReport,
    worktrees: WorktreeManagerPort
  ): Promise<WakeReport> {
    const ledger = run.interventions.find((entry) =>
      entry.realityId === reality.id && entry.status === "revealed"
    );
    if (!ledger?.report || !ledger.baselineCommit) return report;

    const injectedPaths = new Set(ledger.report.changedFiles);
    const excludedArtefactPaths = report.artefacts
      .filter((artefact) => injectedPaths.has(artefact.path))
      .map((artefact) => artefact.path);
    const retainedArtefacts = await Promise.all(
      report.artefacts
        .filter((artefact) => !injectedPaths.has(artefact.path))
        .map(async (artefact) => {
          if (
            artefact.content !== undefined
            || artefact.kind === "note"
            || !safeRelativePath(artefact.path)
          ) {
            return artefact;
          }
          try {
            return {
              ...artefact,
              content: await worktrees.readFile(reality.worktreePath!, artefact.path)
            };
          } catch {
            return artefact;
          }
        })
    );
    const sanitized = WakeReportSchema.parse({
      ...report,
      artefacts: retainedArtefacts
    });

    await worktrees.restoreCheckpoint(reality.worktreePath!, ledger.baselineCommit);
    for (const artefact of sanitized.artefacts) {
      if (
        artefact.kind === "note"
        || artefact.content === undefined
        || !safeRelativePath(artefact.path)
      ) {
        continue;
      }
      await worktrees.writeFile(reality.worktreePath!, artefact.path, artefact.content);
    }

    ledger.containedAt = now();
    ledger.excludedArtefactPaths = excludedArtefactPaths;
    await this.emit(
      run,
      reality,
      "intervention.contained",
      `Adversarial fault contained: ${ledger.report.changedFiles.length} injected path${ledger.report.changedFiles.length === 1 ? "" : "s"} restored before Memory could ascend.`,
      {
        missionId: run.id,
        contractId: ledger.contractId,
        rollbackCommit: ledger.baselineCommit,
        injectedPathCount: ledger.report.changedFiles.length,
        excludedArtefactPaths,
        retainedInvestigatorArtefactCount: retainedArtefacts.length
      }
    );
    return sanitized;
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

  private canCreateDream(run: MissionRun, parent: Reality): boolean {
    if (parent.depth >= run.definition.maxDreamDepth) return false;
    if (!parent.proposals.some((proposal) => proposal.status === "open")) return false;
    const childCount = run.realities.filter((reality) => reality.parentId === parent.id).length;
    const siblingLimit = run.definition.dreamStrategy === "competing-siblings"
      ? run.definition.maxSiblingDreams
      : 1;
    return childCount < siblingLimit;
  }

  private async reflectSiblingMemories(
    run: MissionRun,
    parent: Reality
  ): Promise<void> {
    if (run.definition.dreamStrategy !== "competing-siblings") return;
    const siblings = run.realities
      .filter((reality) => reality.parentId === parent.id && Boolean(reality.wakeReport))
      .map((reality) => ({
        reality,
        report: run.memories.find((memory) => memory.realityId === reality.id)
      }))
      .filter((entry): entry is { reality: Reality; report: WakeReport } => Boolean(entry.report))
      .filter(({ reality }) => run.memoryIntegrity.some((seal) =>
        seal.realityId === reality.id && seal.verdict === "verified"
      ))
      .slice(0, run.definition.maxSiblingDreams);
    if (siblings.length < 2) return;
    const realityIds = siblings.map(({ reality }) => reality.id).sort();
    if (run.reflections.some((reflection) =>
      [...reflection.realityIds].sort().join(":") === realityIds.join(":")
    )) return;

    const reflection = this.reflections.compare(parent, siblings, now());
    run.reflections.push(reflection);
    const reflectedParent = RealityEntity.hydrate(parent)
      .advanceTime(
        2,
        "Reflecting across sibling Dreams",
        reflection.sharedInvariants.length
          ? `${reflection.sharedInvariants.length} invariant${reflection.sharedInvariants.length === 1 ? "" : "s"} survived competing worlds.`
          : "Sibling Dreams disagreed; synthesis must preserve the disagreement."
      )
      .snapshot();
    this.replaceReality(run, reflectedParent);
    await this.emit(
      run,
      reflectedParent,
      "reflection.created",
      `Reality Mirror compared ${siblings.length} sibling Dreams: ${reflection.sharedInvariants.length} shared invariants and ${reflection.disagreements.length} disagreements.`,
      {
        missionId: run.id,
        reflectionId: reflection.id,
        realityIds: reflection.realityIds,
        sharedInvariantCount: reflection.sharedInvariants.length,
        disagreementCount: reflection.disagreements.length,
        confidence: reflection.confidence
      }
    );
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
            ? `Retry the bounded Adversarial Subject in ${active.name}`
            : `Inject the Adversarial Subject into ${active.name}`
        };
      }
      if (intervention?.status === "sealed" && !intervention.diagnosis) {
        return {
          id: "inspect",
          kind: "advance",
          executor: "codex",
          label: `Ask investigator Subjects to diagnose the sealed fault in ${active.name}`
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
      if (this.canCreateDream(run, active)) {
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
        label: `Kick: return Memory from ${active.name}`
      };
    }

    if (active.codexThreadId?.startsWith("unbound:")) {
      return {
        id: "inspect",
        kind: "advance",
        executor: "codex",
        label: `Ask Codex to review ${run.definition.scope} in local source and surface the highest-value uncertainty`
      };
    }
    if (this.canCreateDream(run, active)) {
      return {
        id: "create_dream",
        kind: "dream",
        executor: "orchestrator",
        label: run.memories.length
          ? "Create competing sibling Dream from the remaining uncertainty"
          : "Create Dream from the highest-value uncertainty"
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
        label: `Ask Codex to deepen the local ${run.definition.scope} source review`
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
        label: "Synthesise validated memories into Reality"
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
      label: "Stabilise the proven Reality"
    };
  }

  private assertBudget(run: MissionRun): void {
    const used = this.observedTokens(run);
    if (used >= run.definition.tokenBudget) {
      throw new Error(`Mission observed SDK token ceiling reached (${used.toLocaleString("en-US")} input plus output tokens).`);
    }
  }

  private observedTokens(run: MissionRun): number {
    return run.observedTokens;
  }

  private assertTurnWithinTokenCeiling(
    run: MissionRun,
    usedBefore: number,
    events: CodexRuntimeEvent[]
  ): void {
    const usedAfter = usedBefore + runtimeTokenEvidence(events);
    if (usedAfter > run.definition.tokenBudget) {
      throw new CodexOutputValidationError("InvestigationReportSchema", [{
        path: "usage.totalTokens",
        code: "mission_token_ceiling_exceeded"
      }]);
    }
  }

  private async materialiseContext(
    worktrees: WorktreeManagerPort,
    reality: Reality
  ): Promise<void> {
    const constraints = reality.constitution.constraints.map((entry) => `- ${entry}`).join("\n");
    const truths = reality.constitution.parentTruths.map((entry) => `- ${entry}`).join("\n");
    const laws = (reality.constitution.runtimeLaws ?? []).map((entry) => `- ${entry}`).join("\n");
    const evidence = reality.evidence.length
      ? reality.evidence.map((entry) => `- [${entry.kind}] ${entry.title}: ${entry.summary}`).join("\n")
      : "- No evidence has been admitted.";
    const subjects = reality.subjects.length
      ? reality.subjects.map((subject) =>
        `- ${subject.name} (${subject.role}) / ${subject.status}: ${subject.mission}`
      ).join("\n")
      : "- No Subjects are currently chartered.";
    await worktrees.writeFile(
      reality.worktreePath!,
      ".inception/reality/REALITY.md",
      `# ${reality.name}

Reality ID: ${reality.id}
Parent Reality ID: ${reality.parentId ?? "None"}
Depth: ${reality.depth}
Time dilation: ${reality.constitution.timeDilation ?? 1}x
Codex thread: ${reality.codexThreadId ?? "Unbound"}

## Premise

${reality.premise}

## Mission

${reality.constitution.mission}

## Constraints

${constraints}

## Parent Truths

${truths || "- No inherited parent truths."}

## Runtime Laws

${laws || "- No additional runtime laws."}

## Memory Admission Policy

${reality.constitution.memoryPolicy ?? "verified-reports-and-artefacts"}

## Authorization Boundary

${reality.constitution.safetyProfile === "authorized-local-defensive-review"
    ? "Authorized local defensive review: source and synthetic local tests only; no running or external target."
    : "General software development inside the operator-provided Reality worktree."}

## Admitted Evidence

${evidence}

## Subjects

${subjects}

## Wake Contract

${reality.constitution.wakeContract.map((entry) => `- ${entry}`).join("\n")}
`
    );
    await worktrees.writeFile(
      reality.worktreePath!,
      ".inception/reality/AGENTS.override.md",
      `# Reality Agent Contract

- Operate only inside this worktree and this Reality's premise.
- Parent-owned Reality Anchors are immutable.
- A root inspection may investigate and test freely, but the orchestrator will roll its filesystem back before admitting knowledge.
- Do not create child Dreams. Return one structured Dream proposal to the orchestrator.
- Label hypothetical or simulated evidence as synthetic.
- Use Subjects only for bounded, independent investigations and wait for every Subject to return.
- Treat an exploratory search with no matches as evidence, not a failed prerequisite. Do not chain optional \`rg\` probes after required commands, and use quoted \`-g\` patterns instead of shell globs.
- Inspect only the current HEAD ancestry. Never enumerate Git refs, reflogs, unreachable objects, sibling branches, or other worktrees; cross-Reality Git inspection invalidates this Reality's evidence.
- Return evidence, artefacts, decisions, belief changes, and validated summaries. Never expose hidden reasoning.
`
    );
    await worktrees.writeFile(
      reality.worktreePath!,
      ".inception/anchors/manifest.json",
      `${JSON.stringify({
        realityId: reality.id,
        anchors: reality.anchors.map((anchor) => ({
          id: anchor.id,
          ownerRealityId: anchor.ownerRealityId,
          name: anchor.hidden ? "Hidden parent-owned proof" : anchor.name,
          immutable: true,
          hidden: anchor.hidden
        }))
      }, null, 2)}\n`
    );
  }

  private async ensureDependencyEnvironment(
    run: MissionRun,
    reality: Reality,
    worktrees: WorktreeManagerPort,
    phase: "inspection" | "synthesis" | "verification"
  ): Promise<DependencyBootstrapResult | undefined> {
    const contract = run.definition.dependencyBootstrap;
    if (
      !contract
      || (
        phase === "inspection"
        && reality.depth !== contract.targetDepth
      )
    ) {
      return undefined;
    }
    await this.emit(
      run,
      reality,
      "environment.bootstrap.started",
      `Parent-authorized dependencies entered ${reality.name}.`,
      {
        missionId: run.id,
        phase,
        kind: contract.kind,
        manifestPath: contract.manifestPath,
        dependencyPath: dependencyPath(contract),
        indexUrl: contract.indexUrl,
        targetDepth: contract.targetDepth,
        metadata: {
          stage: "environment",
          status: "started",
          detail: `${contract.kind} / ${contract.manifestPath} / Dream depth ${contract.targetDepth}`
        }
      }
    );
    const result = await this.dependencyBootstrap.bootstrap(
      worktrees,
      reality.worktreePath!,
      contract
    );
    await this.emit(
      run,
      reality,
      result.status === "completed"
        ? "environment.bootstrap.completed"
        : "environment.bootstrap.failed",
      result.status === "completed"
        ? `${result.reused ? "Verified" : "Installed"} pinned dependencies inside ${reality.name}.`
        : `Reality-local dependency bootstrap could not complete in ${reality.name}.`,
      {
        missionId: run.id,
        phase,
        status: result.status,
        command: result.command,
        manifestPath: result.manifestPath,
        manifestSha256: result.manifestSha256,
        packageCount: result.packageCount,
        runtimeVersion: result.runtimeVersion,
        runtimeExecutable: result.runtimeExecutable,
        packageManagerVersion: result.packageManagerVersion,
        exitCode: result.exitCode,
        indexUrl: contract.indexUrl,
        dependencyPath: dependencyPath(contract),
        durationMs: result.durationMs,
        reused: result.reused,
        diagnostic: result.diagnostic,
        metadata: {
          stage: "environment",
          status: result.status,
          command: result.command,
          exitCode: result.exitCode,
          diagnostic: result.diagnostic,
          detail: [
            result.runtimeExecutable,
            result.runtimeVersion,
            result.packageManagerVersion ? `npm ${result.packageManagerVersion}` : undefined,
            result.reused ? "reused" : "created"
          ].filter(Boolean).join(" / ")
        }
      }
    );
    return result;
  }

  private async ensureActionWorktree(
    run: MissionRun,
    reality: Reality,
    workspace: MissionWorkspace,
    action: MissionAction
  ): Promise<Reality> {
    if (await workspace.worktrees.isPresent(reality.worktreePath)) return reality;
    const seal = run.memoryIntegrity.find((entry) =>
      entry.realityId === reality.id && entry.verdict === "verified"
    );
    if (seal) {
      return this.restoreSealedWorktree(
        run,
        reality,
        seal.sourceCommit,
        workspace.worktrees
      );
    }
    const rootCanBeReformed = reality.depth === 0
      && !run.events.some((event) => event.type === "synthesis.completed");
    if (!rootCanBeReformed) {
      throw new Error(
        `Reality ${reality.name} is missing its worktree and has no immutable source checkpoint that can be restored.`
      );
    }
    const descriptor = await workspace.worktrees.create(
      reality.id,
      "HEAD",
      workspace.repoRoot
    );
    const restored = RealityEntity.hydrate(reality)
      .bindRuntime(
        reality.codexThreadId ?? `unbound:${reality.id}`,
        descriptor.path,
        descriptor.branchName
      )
      .snapshot();
    this.replaceReality(run, restored);
    await this.materialiseContext(workspace.worktrees, restored);
    await this.emit(
      run,
      restored,
      "reality.recovered",
      `${restored.name} worktree was reformed from its unchanged repository baseline.`,
      {
        missionId: run.id,
        action,
        recovery: "root-baseline",
        worktreePath: descriptor.path
      }
    );
    return restored;
  }

  private async restoreSealedWorktree(
    run: MissionRun,
    reality: Reality,
    sourceCommit: string,
    worktrees: WorktreeManagerPort
  ): Promise<Reality> {
    const descriptor = await worktrees.create(reality.id, sourceCommit);
    const restored = RealityEntity.hydrate(reality)
      .bindRuntime(
        reality.codexThreadId ?? `unbound:${reality.id}`,
        descriptor.path,
        descriptor.branchName
      )
      .snapshot();
    this.replaceReality(run, restored);
    await this.emit(
      run,
      restored,
      "reality.recovered",
      `${restored.name} worktree was restored from its immutable memory checkpoint.`,
      {
        missionId: run.id,
        recovery: "sealed-source",
        sourceCommit,
        worktreePath: descriptor.path
      }
    );
    return restored;
  }

  private async bindRealityThread(
    run: MissionRun,
    realityId: string,
    threadId: string
  ): Promise<Reality> {
    const current = this.requireReality(run, realityId);
    if (current.codexThreadId === threadId) return current;
    const bound = RealityEntity.hydrate(current)
      .bindRuntime(threadId, current.worktreePath!, current.branchName!)
      .snapshot();
    this.replaceReality(run, bound);
    await this.emit(run, bound, "codex.thread.bound", `Codex thread bound to ${bound.name} and persisted for later turns.`, {
      missionId: run.id,
      threadId
    });
    return bound;
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
    run.eventCount += 1;
    const metadata = event.payload.metadata;
    if (metadata && typeof metadata === "object") {
      const values = metadata as Record<string, unknown>;
      run.observedTokens +=
        (typeof values.inputTokens === "number" ? values.inputTokens : 0)
        + (typeof values.outputTokens === "number" ? values.outputTokens : 0);
    }
    run.updatedAt = event.occurredAt;
    const autopilot = this.autopilotControls.get(run.id);
    if (autopilot) run.autopilot = { ...autopilot };
    await this.repository.appendMissionEvent(run.id, event);
    await this.repository.saveMissionRun(MissionRunSchema.parse(run));
    this.eventBus.publish(event);
  }

  private replaceReality(run: MissionRun, reality: Reality): void {
    const index = run.realities.findIndex((entry) => entry.id === reality.id);
    if (index < 0) run.realities.push(reality);
    else run.realities[index] = reality;
    run.updatedAt = now();
  }

  private startAutopilotLoop(id: string): void {
    if (this.autopilotLoops.has(id)) return;
    const loop = this.runAutopilot(id)
      .finally(() => this.autopilotLoops.delete(id));
    this.autopilotLoops.set(id, loop);
  }

  private async runAutopilot(id: string): Promise<void> {
    while (true) {
      const run = await this.requireRun(id);
      const control = this.autopilotControls.get(id) ?? run.autopilot;
      if (control.mode !== "running") return;
      const active = this.requireActive(run);
      const elapsedMinutes = autopilotActiveMilliseconds(control) / 60_000;
      if (control.actionsCompleted >= control.maxActions) {
        await this.pauseAutopilot(run, active, "The configured auto-mode action limit was reached.");
        return;
      }
      if (elapsedMinutes >= control.maxMinutes) {
        await this.pauseAutopilot(run, active, "The configured auto-mode active-runtime limit was reached.");
        return;
      }
      if (run.status === "fractured") {
        await this.pauseAutopilot(run, active, "Reality fractured; inspect the validated failure before continuing.");
        return;
      }
      const next = this.describeAction(run, active);
      if (!next) {
        const timestamp = now();
        const completed = {
          ...control,
          ...pauseAutopilotClock(control, timestamp),
          mode: "completed" as const,
          updatedAt: timestamp,
          pauseReason: undefined,
          approvedAction: undefined
        };
        this.autopilotControls.set(id, completed);
        run.autopilot = completed;
        await this.emit(run, active, "autopilot.completed", "Guided auto mode reached a stabilised Reality.", {
          missionId: id,
          actionsCompleted: completed.actionsCompleted
        });
        return;
      }
      const proofFailure = next.id === "repair"
        && run.proofResults.some((proof) => proof.status === "failed");
      const gated = (next.kind === "dream" && control.pauseOnDream)
        || (next.kind === "intervene" && control.pauseOnIntervention)
        || proofFailure;
      if (gated && control.approvedAction !== next.id) {
        const reason = proofFailure
          ? "Immutable proof failed; inspect the evidence before authorizing repair."
          : next.kind === "dream"
            ? "A new counterfactual premise requires explicit approval."
            : "An adversarial intervention requires explicit approval.";
        await this.pauseAutopilot(run, active, reason);
        return;
      }
      const executing = {
        ...control,
        approvedAction: undefined,
        lastAction: next.id,
        updatedAt: now()
      };
      this.autopilotControls.set(id, executing);
      try {
        await this.act(id, next.id);
      } catch (error) {
        const current = await this.requireRun(id);
        const rejectedIntervention = next.id === "intervene"
          ? current.interventions.find((entry) =>
              entry.realityId === current.activeRealityId && entry.status === "rejected"
            )
          : undefined;
        await this.pauseAutopilot(
          current,
          this.requireActive(current),
          `Action ${next.id} stopped: ${rejectedIntervention?.rejectionReason ?? safeFailure(error)}`
        );
        return;
      }
      const current = await this.requireRun(id);
      const latest = this.autopilotControls.get(id) ?? current.autopilot;
      if (latest.mode !== "running") return;
      const advanced = {
        ...latest,
        actionsCompleted: latest.actionsCompleted + 1,
        lastAction: next.id,
        updatedAt: now()
      };
      this.autopilotControls.set(id, advanced);
      current.autopilot = advanced;
      await this.repository.saveMissionRun(MissionRunSchema.parse(current));
    }
  }

  private async pauseAutopilot(
    run: MissionRun,
    reality: Reality,
    reason: string
  ): Promise<void> {
    const current = this.autopilotControls.get(run.id) ?? run.autopilot;
    if (current.mode === "paused" && current.pauseReason === reason) {
      this.autopilotControls.set(run.id, current);
      run.autopilot = current;
      return;
    }
    const timestamp = now();
    const paused = {
      ...current,
      ...pauseAutopilotClock(current, timestamp),
      mode: "paused" as const,
      pauseReason: reason,
      updatedAt: timestamp
    };
    this.autopilotControls.set(run.id, paused);
    run.autopilot = paused;
    await this.emit(run, reality, "autopilot.paused", `Guided auto mode paused: ${reason}`, {
      missionId: run.id,
      actionsCompleted: paused.actionsCompleted,
      reason
    });
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
