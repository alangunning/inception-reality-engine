import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  RealityEntity,
  RealityRunArchiveSchema,
  type AnchorResult,
  type DemoAutopilotState,
  type DemoSession,
  type InvestigationReport,
  type MemoryIntegritySeal,
  type Reality,
  type RealityEvent,
  type RealityEventType,
  type RealityRunArchive,
  type WakeReport
} from "@inception/domain";
import {
  CodexOutputValidationError,
  type CodexExecutionResult,
  type CodexObservedSubject,
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexSynthesisResult,
  type CodexWakeResult,
  WakeReportValidationError
} from "./codex-port";
import type { WorktreeManagerPort } from "./worktree-port";
import { MemoryIntegrityService } from "./memory-integrity-service";
import {
  ENUMERATION_RESPONSE_TEST,
  ROTATING_IP_TEST,
  SECURE_PASSWORD_RESET_IMPLEMENTATION
} from "./demo-fixture";
import type { RealityEventBus, RealityRepository } from "./ports";
import { SynthesisService } from "./synthesis-service";

export type DemoAction =
  | "inspect"
  | "create_attack_dream"
  | "enter_subjects"
  | "discover_abuse"
  | "create_nested_dream"
  | "wake_nested"
  | "wake_parent"
  | "synthesise"
  | "run_anchors"
  | "repair"
  | "stabilise";

export interface ActiveRealityOperation {
  id: string;
  action: DemoAction;
  label: string;
  executor: "codex" | "orchestrator";
  realityId: string;
  startedAt: string;
}

export interface DemoNextAction {
  id: DemoAction;
  kind: "advance" | "dream" | "kick" | "verify";
  executor: "codex" | "orchestrator";
  verb: string;
  target: string;
  label: string;
}

export interface DemoSnapshot {
  session: DemoSession;
  realities: Reality[];
  events: RealityEvent[];
  activeReality: Reality | null;
  operation: ActiveRealityOperation | null;
  nextAction: DemoNextAction | null;
}

export type DemoAutopilotCommand =
  | {
      command: "start";
      paceMilliseconds?: number;
      maxActions?: number;
      maxMinutes?: number;
      pauseOnDream?: boolean;
    }
  | { command: "resume" }
  | { command: "pause" }
  | { command: "stop" };

interface ActionDefinition {
  id: DemoAction;
  kind: DemoNextAction["kind"];
  executor: DemoNextAction["executor"];
  verb: string;
}

const ACTION_PLAN: Record<number, ActionDefinition> = {
  0: { id: "inspect", kind: "advance", executor: "codex", verb: "audit and improve" },
  1: { id: "create_attack_dream", kind: "dream", executor: "orchestrator", verb: "create Dream" },
  2: { id: "enter_subjects", kind: "advance", executor: "orchestrator", verb: "enter bounded Subjects" },
  3: { id: "discover_abuse", kind: "advance", executor: "codex", verb: "investigate" },
  4: { id: "create_nested_dream", kind: "dream", executor: "orchestrator", verb: "create nested Dream" },
  5: { id: "wake_nested", kind: "kick", executor: "codex", verb: "return validated memory" },
  6: { id: "wake_parent", kind: "kick", executor: "codex", verb: "return validated memory" },
  7: { id: "synthesise", kind: "advance", executor: "codex", verb: "synthesise returned memories" },
  8: { id: "run_anchors", kind: "verify", executor: "orchestrator", verb: "run immutable anchors" },
  9: { id: "stabilise", kind: "advance", executor: "orchestrator", verb: "stabilise" }
};

const ROOT_NAME = "Waking Reality";

function isDescendantOf(realities: Reality[], candidateId: string, ancestorId: string): boolean {
  let candidate = realities.find((entry) => entry.id === candidateId);
  while (candidate?.parentId) {
    if (candidate.parentId === ancestorId) return true;
    candidate = realities.find((entry) => entry.id === candidate?.parentId);
  }
  return false;
}

export class RealityOrchestrator {
  private operation: Promise<void> = Promise.resolve();
  private seedOperation: Promise<void> = Promise.resolve();
  private reconcileOperation: Promise<void> = Promise.resolve();
  private activeOperation: ActiveRealityOperation | null = null;
  private demoAutopilotControl: DemoAutopilotState | null = null;
  private demoAutopilotLoop: Promise<void> | null = null;
  private readonly memoryIntegrity = new MemoryIntegrityService();

  constructor(
    private readonly repository: RealityRepository,
    private readonly eventBus: RealityEventBus,
    private readonly codexRuntime: CodexRuntime,
    private readonly worktrees: WorktreeManagerPort,
    private readonly synthesis: SynthesisService,
    private readonly repoRoot: string
  ) {}

  async ensureSeeded(): Promise<void> {
    const run = this.seedOperation.then(async () => {
      const existing = await this.repository.getSession();
      if (existing) return;

      const root = RealityEntity.create({
        depth: 0,
        kind: "waking",
        name: ROOT_NAME,
        premise: "Improve an incomplete password-reset implementation without violating hidden product and security requirements.",
        constitution: {
          mission: "Make password reset resistant to abuse while preserving user privacy and existing token semantics.",
          scope: "password-reset security",
          premise: "The current per-IP rate limiter may be enough, but that belief has not survived an adversarial world.",
          constraints: [
            "Do not expose raw model reasoning.",
            "Do not reveal whether an account exists.",
            "Do not alter parent-owned Reality Anchors.",
            "Prefer decisive tests over speculative discussion.",
            "Use repository scripts from the Reality worktree and keep generated caches inside that worktree.",
            "Classify a non-zero command as test evidence, environment failure, or configuration failure before retrying.",
            "Keep exploration focused on demo/password-reset and the generated .inception Reality context. Do not inspect or modify Reality Engine control-plane packages.",
            "During exploration, run only focused password-reset tests. Do not run monorepo-wide test, typecheck, or build commands; immutable anchor verification owns the full proof phase."
          ],
          wakeContract: [
            "State initial beliefs and what changed.",
            "Return evidence and reproducible artefacts.",
            "Separate invariants from world-specific observations.",
            "Preserve remaining uncertainty."
          ],
          parentTruths: [
            "Reset tokens expire after fifteen minutes.",
            "The public API shape must remain stable."
          ],
          timeDilation: 1,
          dreamStrategy: "single-chain",
          maxSiblingDreams: 1,
          runtimeLaws: [
            "Production behavior must be supported by executable repository evidence.",
            "A failed proof prevents Reality stabilisation."
          ]
        },
        initialBeliefs: [{
          statement: "Per-IP rate limiting probably prevents password-reset abuse.",
          confidence: 0.72,
          origin: "initial"
        }],
        inheritedAnchors: [
          {
            id: "anchor-generic-response",
            realityId: "root",
            ownerRealityId: "root",
            name: "Enumeration-safe response",
            description: "Known and unknown accounts must receive the same public response.",
            testCommand: "vitest demo/password-reset/tests/anchors.spec.ts",
            immutable: true,
            hidden: true,
            status: "pending"
          },
          {
            id: "anchor-token-expiry",
            realityId: "root",
            ownerRealityId: "root",
            name: "Token expiry preserved",
            description: "Reset tokens remain valid for at most fifteen minutes.",
            testCommand: "vitest demo/password-reset/tests/anchors.spec.ts",
            immutable: true,
            hidden: true,
            status: "pending"
          },
          {
            id: "anchor-distributed-abuse",
            realityId: "root",
            ownerRealityId: "root",
            name: "Rotating-IP resistance",
            description: "A single identifier cannot receive unlimited reset deliveries through source-address rotation.",
            testCommand: "vitest demo/password-reset/tests/anchors.spec.ts",
            immutable: true,
            hidden: true,
            status: "pending"
          }
        ]
      });

      const descriptor = await this.worktrees.create(root.snapshot().id, "HEAD");
      root.bindRuntime(`unbound:${root.snapshot().id}`, descriptor.path, descriptor.branchName);
      const reality = root.snapshot();
      await this.materialiseRealityContext(reality);
      await this.repository.saveReality(reality);

      const timestamp = new Date().toISOString();
      const session: DemoSession = {
        id: "singleton",
        phase: 0,
        activeRealityId: reality.id,
        finalDiff: "",
        anchorResults: [],
        memoryIntegrity: [],
        autopilot: {
          mode: "off",
          kind: this.codexRuntime.mode === "real" ? "guided-real" : "demo",
          maxActions: 20,
          maxMinutes: 60,
          paceMilliseconds: 1_000,
          pauseOnDream: true,
          actionsCompleted: 0
        },
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await this.repository.saveSession(session);
      await this.emit(reality, "reality.created", "Waking Reality formed with three immutable anchors.", {
        worktree: descriptor.path
      });
    });
    this.seedOperation = run.catch(() => undefined);
    await run;
  }

  async snapshot(): Promise<DemoSnapshot> {
    await this.ensureSeeded();
    await this.ensureRealityWorktrees();
    const [session, persistedRealities, events] = await Promise.all([
      this.repository.getSession(),
      this.repository.listRealities(),
      this.repository.listEvents(500)
    ]);
    if (!session) throw new Error("Demo session is missing.");
    const realities = session.phase >= 10
      ? await this.deferOpenProposals(persistedRealities)
      : persistedRealities;
    if (
      session.autopilot.mode === "running"
      && !this.demoAutopilotControl
      && !this.demoAutopilotLoop
    ) {
      session.autopilot = {
        ...session.autopilot,
        mode: "paused",
        pauseReason: "The server restarted; resume explicitly to continue without starting Codex on page load.",
        updatedAt: new Date().toISOString()
      };
      await this.repository.saveSession(session);
    }
    const activeReality = realities.find((reality) => reality.id === session.activeRealityId) ?? null;
    return {
      session,
      realities,
      events,
      activeReality,
      operation: this.activeOperation ? { ...this.activeOperation } : null,
      nextAction: this.activeOperation ? null : this.describeAction(session, activeReality)
    };
  }

  async act(action: DemoAction): Promise<DemoSnapshot> {
    const run = this.operation.then(async () => {
      await this.ensureSeeded();
      await this.ensureRealityWorktrees();
      const session = await this.requireSession();
      if (!session.activeRealityId) {
        throw new Error("The Reality operation has no active locus.");
      }
      const activeReality = await this.repository.getReality(session.activeRealityId);
      if (!activeReality) {
        throw new Error("The active Reality could not be found.");
      }
      const nextAction = this.describeAction(session, activeReality);
      if (!nextAction) {
        throw new Error(`No Reality action exists for phase ${session.phase}.`);
      }
      if (action !== nextAction.id) {
        throw new Error(`Action ${action} is not valid in phase ${session.phase}; expected ${nextAction.id}.`);
      }

      const operation = {
        id: randomUUID(),
        action,
        label: nextAction.label,
        executor: nextAction.executor,
        realityId: session.activeRealityId,
        startedAt: new Date().toISOString()
      } satisfies ActiveRealityOperation;
      this.activeOperation = operation;
      try {
        switch (action) {
          case "inspect": await this.inspectRoot(session); break;
          case "create_attack_dream": await this.createAttackDream(session); break;
          case "enter_subjects": await this.enterSubjects(session); break;
          case "discover_abuse": await this.discoverAbuse(session); break;
          case "create_nested_dream": await this.createNestedDream(session); break;
          case "wake_nested": await this.wakeNestedDream(session); break;
          case "wake_parent": await this.wakeAttackDream(session); break;
          case "synthesise": await this.synthesiseMemories(session); break;
          case "run_anchors": await this.runAnchors(session); break;
          case "repair": await this.repairReality(session); break;
          case "stabilise": await this.stabilise(session); break;
        }
      } catch (error) {
        const failure = this.describeOperationFailure(operation, error);
        if (failure.kind !== "contract_rejected") {
          const latestReality = await this.repository.getReality(operation.realityId) ?? activeReality;
          await this.emit(latestReality, "reality.fractured", failure.summary, {
            action,
            failureKind: failure.kind,
            codexProcessActive: false
          }).catch(() => undefined);
        }
        throw new Error(failure.responseMessage);
      } finally {
        if (this.activeOperation?.id === operation.id) this.activeOperation = null;
      }
    });
    this.operation = run.catch(() => undefined);
    await run;
    return this.snapshot();
  }

  async controlAutopilot(command: DemoAutopilotCommand): Promise<DemoSnapshot> {
    await this.ensureSeeded();
    if (this.activeOperation) {
      throw new Error(`Wait for "${this.activeOperation.label}" to finish before changing guided auto mode.`);
    }
    const session = await this.requireSession();
    const reality = session.activeRealityId
      ? await this.repository.getReality(session.activeRealityId)
      : null;
    if (!reality) throw new Error("The active Demo Reality is unavailable.");
    const timestamp = new Date().toISOString();
    const guidedReal = this.codexRuntime.mode === "real";
    if (command.command === "start") {
      if (session.phase >= 10) throw new Error("The Demo Mission is already stabilised.");
      session.autopilot = {
        mode: "running",
        kind: guidedReal ? "guided-real" : "demo",
        maxActions: Math.max(1, Math.min(command.maxActions ?? 20, 20)),
        maxMinutes: Math.max(1, Math.min(command.maxMinutes ?? (guidedReal ? 180 : 60), 180)),
        paceMilliseconds: Math.max(250, Math.min(command.paceMilliseconds ?? 1_000, 10_000)),
        pauseOnDream: command.pauseOnDream ?? true,
        actionsCompleted: 0,
        startedAt: timestamp,
        updatedAt: timestamp
      };
      this.demoAutopilotControl = { ...session.autopilot };
      await this.repository.saveSession(session);
      await this.emit(
        reality,
        "autopilot.started",
        guidedReal
          ? "Guided real auto mode started; bounded Codex actions will advance while parent-owned gates remain armed."
          : "Recording auto mode started; the deterministic Reality path will advance without Codex usage.",
        {
        kind: session.autopilot.kind,
        paceMilliseconds: session.autopilot.paceMilliseconds,
        maxActions: session.autopilot.maxActions,
        maxMinutes: session.autopilot.maxMinutes,
        pauseOnDream: session.autopilot.pauseOnDream
      });
      this.startDemoAutopilotLoop();
    } else if (command.command === "resume") {
      if (session.autopilot.mode !== "paused") {
        throw new Error("Demo auto mode is not paused.");
      }
      session.autopilot = {
        ...session.autopilot,
        mode: "running",
        approvedAction: this.describeAction(session, reality)?.id,
        pauseReason: undefined,
        updatedAt: timestamp
      };
      this.demoAutopilotControl = { ...session.autopilot };
      await this.repository.saveSession(session);
      this.startDemoAutopilotLoop();
    } else {
      session.autopilot = {
        ...session.autopilot,
        mode: command.command === "pause" ? "paused" : "stopped",
        pauseReason: command.command === "pause"
          ? "Paused by the operator after the current Reality action."
          : "Stopped by the operator after the current Reality action.",
        updatedAt: timestamp
      };
      this.demoAutopilotControl = { ...session.autopilot };
      await this.repository.saveSession(session);
      await this.emit(
        reality,
        command.command === "pause" ? "autopilot.paused" : "autopilot.stopped",
        command.command === "pause"
          ? "Guided auto mode paused by the operator."
          : "Guided auto mode stopped by the operator.",
        { actionsCompleted: session.autopilot.actionsCompleted }
      );
    }
    return this.snapshot();
  }

  async reset(): Promise<DemoSnapshot> {
    if (this.demoAutopilotControl?.mode === "running") {
      this.demoAutopilotControl = {
        ...this.demoAutopilotControl,
        mode: "stopped",
        pauseReason: "Stopped for full reset.",
        updatedAt: new Date().toISOString()
      };
    }
    if (this.activeOperation) {
      throw new Error(`Cannot reset while "${this.activeOperation.label}" is active.`);
    }
    await this.archiveCurrentRun();
    const realities = (await this.repository.listRealities()).sort((a, b) => b.depth - a.depth);
    for (const reality of realities) {
      if (reality.worktreePath && reality.branchName) {
        await this.worktrees.remove({ path: reality.worktreePath, branchName: reality.branchName });
      }
    }
    await this.worktrees.cleanupAll();
    await this.repository.deleteAll();
    await this.ensureSeeded();
    return this.snapshot();
  }

  async currentRunLog(): Promise<RealityRunArchive> {
    await this.ensureSeeded();
    return this.collectRunLog("current", new Date().toISOString());
  }

  async listRunArchives(limit = 20): Promise<RealityRunArchive[]> {
    return this.repository.listRunArchives(limit);
  }

  async getRunArchive(id: string): Promise<RealityRunArchive | null> {
    return this.repository.getRunArchive(id);
  }

  private async inspectRoot(session: DemoSession): Promise<void> {
    const root = await this.requireNamedReality(ROOT_NAME);
    const runtimeResult = await this.requestInspection(root);
    if (!runtimeResult.report.dreamProposal) {
      await this.rejectContract(root, "InvestigationReportSchema", "dreamProposal", "required_uncertainty");
    }
    const entity = RealityEntity.hydrate(root);
    entity.bindRuntime(runtimeResult.threadId, root.worktreePath!, root.branchName!);
    this.addObservedSubjects(entity, runtimeResult);
    const applied = this.applyInvestigationReport(entity, runtimeResult.report, false);
    entity
      .setStatus("exploring", "Reality inspecting implementation")
      .setImplementationState(runtimeResult.report.summary)
      .advanceTime(12, "Testing the initial abuse model", runtimeResult.summary);
    const updated = entity.snapshot();
    await this.repository.saveReality(updated);
    await this.emit(updated, "inspection.completed", runtimeResult.report.summary, {
      evidenceIds: applied.evidenceIds,
      changedFiles: [],
      baselineRestored: true
    });
    for (const evidence of updated.evidence.filter((entry) => applied.evidenceIds.includes(entry.id))) {
      await this.emit(updated, "evidence.discovered", `Evidence discovered: ${evidence.title}.`, {
        evidenceId: evidence.id,
        provenance: evidence.provenance ?? "model-reported"
      });
    }
    await this.emit(
      updated,
      "uncertainty.discovered",
      `Uncertainty surfaced: ${runtimeResult.report.dreamProposal!.uncertainty}`,
      { proposal: runtimeResult.report.dreamProposal!.title }
    );
    await this.advanceSession(session, 1, updated.id);
  }

  private async createAttackDream(session: DemoSession): Promise<void> {
    const root = await this.requireNamedReality(ROOT_NAME);
    const proposal = root.proposals.find((entry) => entry.status === "open");
    if (!proposal) throw new Error("Attack Dream proposal missing.");
    const rootEntity = RealityEntity.hydrate(root).updateProposal(proposal.id, "dreaming");

    const dream = RealityEntity.create({
      parentId: root.id,
      depth: 1,
      kind: "dream",
      name: proposal.title,
      premise: proposal.premise,
      constitution: {
        mission: "Break the current password-reset abuse assumptions using bounded adversarial investigation.",
        scope: "coordinated password-reset abuse",
        premise: proposal.premise,
        constraints: root.constitution.constraints,
        wakeContract: root.constitution.wakeContract,
        parentTruths: [...root.constitution.parentTruths, "Per-IP throttling exists in the parent implementation."],
        timeDilation: 12,
        dreamStrategy: "competing-siblings",
        maxSiblingDreams: 2,
        runtimeLaws: [
          "Coordinated attackers may use independent accounts and network sources.",
          "Subject claims require code, response, or executable test evidence."
        ]
      },
      inheritedAnchors: root.anchors,
      initialBeliefs: [{
        statement: "Per-IP limiting probably prevents practical password-reset abuse.",
        confidence: 0.72,
        origin: "inherited"
      }]
    });
    const descriptor = await this.worktrees.create(
      dream.snapshot().id,
      root.branchName ?? "HEAD",
      root.worktreePath
    );
    dream.bindRuntime(`unbound:${dream.snapshot().id}`, descriptor.path, descriptor.branchName)
      .setStatus("exploring", "Dream entered")
      .advanceTime(3, "Establishing coordinated-attack conditions");
    const created = dream.snapshot();
    await this.materialiseRealityContext(created);
    await this.repository.saveReality(rootEntity.snapshot());
    await this.repository.saveReality(created);
    await this.emit(created, "dream.created", `Creating dream: ${created.name}.`, {
      parentId: root.id,
      depth: 1,
      impactProbability: proposal.impactProbability,
      estimatedTokens: proposal.estimatedTokens
    });
    await this.advanceSession(session, 2, created.id);
  }

  private async enterSubjects(session: DemoSession): Promise<void> {
    const dream = await this.requireDreamAtDepth(1);
    const entity = RealityEntity.hydrate(dream);
    const subjects = [
      { id: randomUUID(), name: "Ariadne", role: "Attacker", mission: "Find observable differences and scalable abuse paths.", status: "entered" as const, findings: [] },
      { id: randomUUID(), name: "Arthur", role: "Investigator", mission: "Trace counters, response shapes, and trust boundaries.", status: "entered" as const, findings: [] },
      { id: randomUUID(), name: "Eames", role: "Test engineer", mission: "Turn the strongest suspicion into a deterministic test.", status: "entered" as const, findings: [] }
    ];
    for (const subject of subjects) entity.addSubject(subject);
    entity.advanceTime(7, "Subjects investigating independent attack surfaces", "Three bounded investigations are active inside this Reality.");
    const updated = entity.snapshot();
    await this.repository.saveReality(updated);
    for (const subject of subjects) {
      await this.emit(updated, "subject.entered", `Subject entered: ${subject.name}, ${subject.role}.`, { subjectId: subject.id, mission: subject.mission });
    }
    await this.advanceSession(session, 3, updated.id);
  }

  private async discoverAbuse(session: DemoSession): Promise<void> {
    const dream = await this.requireDreamAtDepth(1);
    const runtimeResult = await this.requestInspection(dream);
    if (!runtimeResult.report.dreamProposal) {
      await this.rejectContract(dream, "InvestigationReportSchema", "dreamProposal", "required_uncertainty");
    }
    if (
      dream.constitution.dreamStrategy === "competing-siblings"
      && !runtimeResult.report.alternativeDreamProposal
    ) {
      await this.rejectContract(
        dream,
        "InvestigationReportSchema",
        "alternativeDreamProposal",
        "required_competing_uncertainty"
      );
    }
    const entity = RealityEntity.hydrate(dream);
    entity.bindRuntime(runtimeResult.threadId, dream.worktreePath!, dream.branchName!);
    const applied = this.applyInvestigationReport(entity, runtimeResult.report, true);
    entity.advanceTime(16, "Selecting the decisive nested experiment", runtimeResult.report.summary);
    const updated = entity.snapshot();
    await this.repository.saveReality(updated);
    for (const evidence of updated.evidence.filter((entry) => applied.evidenceIds.includes(entry.id))) {
      await this.emit(updated, "evidence.discovered", `Evidence discovered: ${evidence.title}.`, {
        evidenceId: evidence.id,
        provenance: evidence.provenance ?? "model-reported"
      });
    }
    for (const change of runtimeResult.report.changedBeliefs) {
      await this.emit(updated, "belief.changed", `Belief changed: ${change.to}`, { confidence: change.confidence });
    }
    for (const subject of updated.subjects) {
      await this.emit(updated, "subject.returned", `Subject returned: ${subject.name}.`, {
        subjectId: subject.id,
        findings: subject.findings
      });
    }
    for (const proposal of [
      runtimeResult.report.dreamProposal,
      runtimeResult.report.alternativeDreamProposal
    ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))) {
      await this.emit(
        updated,
        "uncertainty.discovered",
        `Uncertainty surfaced: ${proposal.uncertainty}`,
        { proposal: proposal.title }
      );
    }
    await this.advanceSession(session, 4, updated.id);
  }

  private async createNestedDream(session: DemoSession): Promise<void> {
    const parent = await this.requireDreamAtDepth(1);
    const proposal = parent.proposals.find((entry) => entry.status === "open");
    if (!proposal) throw new Error("Nested Dream proposal missing.");
    const parentEntity = RealityEntity.hydrate(parent).updateProposal(proposal.id, "dreaming");
    const nested = RealityEntity.create({
      parentId: parent.id,
      depth: 2,
      kind: "dream",
      name: proposal.title,
      premise: proposal.premise,
      constitution: {
        mission: `Produce one deterministic regression artefact that decides this bounded uncertainty: ${proposal.uncertainty}`,
        scope: proposal.title,
        premise: proposal.premise,
        constraints: parent.constitution.constraints,
        wakeContract: parent.constitution.wakeContract,
        parentTruths: parent.constitution.parentTruths,
        timeDilation: 120,
        dreamStrategy: parent.constitution.dreamStrategy,
        maxSiblingDreams: parent.constitution.maxSiblingDreams,
        runtimeLaws: [
          "Retain at least one decisive test artefact; other worktree-local exploration remains allowed.",
          "Wake immediately after one deterministic test decides the premise."
        ]
      },
      inheritedAnchors: parent.anchors,
      initialBeliefs: [{
        statement: "The parent defence probably survives this bounded counterfactual.",
        confidence: 0.64,
        origin: "inherited"
      }]
    });
    const descriptor = await this.worktrees.create(
      nested.snapshot().id,
      parent.branchName ?? "HEAD",
      parent.worktreePath
    );
    nested.bindRuntime(`unbound:${nested.snapshot().id}`, descriptor.path, descriptor.branchName)
      .setStatus("exploring", "Nested Dream entered")
      .advanceTime(4, `Preparing one decisive ${proposal.title} experiment`);
    const created = nested.snapshot();
    await this.materialiseRealityContext(created);
    await this.repository.saveReality(parentEntity.snapshot());
    await this.repository.saveReality(created);
    await this.emit(created, "dream.created", `Creating dream: ${created.name}.`, {
      parentId: parent.id,
      depth: 2,
      impactProbability: proposal.impactProbability,
      estimatedTokens: proposal.estimatedTokens
    });
    await this.advanceSession(session, 5, created.id);
  }

  private async wakeNestedDream(session: DemoSession): Promise<void> {
    if (!session.activeRealityId) throw new Error("Nested Dream locus missing.");
    const nested = await this.repository.getReality(session.activeRealityId);
    if (!nested || nested.kind !== "dream" || nested.depth !== 2) {
      throw new Error("The active locus is not a nested Dream.");
    }
    const quarantinedSeal = session.memoryIntegrity.find((seal) =>
      seal.realityId === nested.id
      && seal.verdict === "quarantined"
    );
    const evidenceOnlyQuarantine = quarantinedSeal?.checks
      .filter((check) => check.status === "failed")
      .every((check) => check.name === "evidence-lineage") === true;
    const canCorrectReturnedMemory = Boolean(
      nested.wakeReport
      && quarantinedSeal
      && evidenceOnlyQuarantine
      && await this.hasPromotableNestedMemory(nested)
      && await this.matchesCanonicalSealedSource(nested, quarantinedSeal)
    );
    const returned = canCorrectReturnedMemory
      ? await this.correctNestedWakeReport(nested)
      : await this.experienceAndWakeNestedDream(nested);
    const report = returned.wakeReport!;

    const parent = await this.requireDreamAtDepth(1);
    await this.emit(returned, "wake.sealing", "Reality Totem is sealing the nested memory to its failing artefact and Git source.", {
      wakeStage: "sealing",
      wakeStageIndex: 2
    });
    const seal = await this.sealCanonicalMemory(session, returned, parent, report);
    const integritySession = await this.acceptCanonicalMemorySeal(session, returned, seal);
    const proposal = parent.proposals.find((entry) => entry.status === "dreaming");
    const parentEntity = RealityEntity.hydrate(parent);
    if (proposal) parentEntity.updateProposal(proposal.id, "resolved");
    parentEntity.addEvidence({
      id: randomUUID(),
      kind: "test",
      title: `Memory returned from ${nested.name}`,
      summary: report.recommendation,
      source: `wake-report:${nested.id}`,
      artefactPath: report.artefacts[0]?.path
    });
    parentEntity.advanceTime(5, "Receiving nested memory", `A decisive failing test returned from ${nested.name}.`);
    const updatedParent = parentEntity.snapshot();
    await this.repository.saveReality(updatedParent);
    await this.emit(returned, "wake.returning", "Validated nested memory is returning to the coordinated-attack Dream.", {
      parentRealityId: parent.id,
      wakeStage: "returning",
      wakeStageIndex: 3
    });
    await this.emit(returned, "memory.returned", `Memory returned from ${nested.name} with a failing test artefact.`, { report });
    const remainingProposal = updatedParent.proposals.some((entry) => entry.status === "open");
    await this.advanceSession(
      integritySession,
      remainingProposal ? 5 : 6,
      updatedParent.id
    );
  }

  private async correctNestedWakeReport(nested: Reality): Promise<Reality> {
    const priorTestPath = nested.wakeReport?.artefacts.find((artefact) =>
      artefact.kind === "test"
    )?.path;
    if (!priorTestPath) {
      throw new Error("The quarantined memory has no retained regression artefact to revalidate.");
    }
    const waking = RealityEntity.hydrate(nested)
      .setStatus("waking", "Correcting quarantined evidence lineage");
    const correcting = waking.snapshot();
    await this.repository.saveReality(correcting);
    await this.emit(
      correcting,
      "wake.collecting",
      "Correcting the quarantined Wake Report against the source Reality's exact evidence ledger.",
      {
        correction: "evidence-lineage",
        retainedArtefactPath: priorTestPath,
        evidenceIds: correcting.evidence.map((entry) => entry.id),
        wakeStage: "collecting",
        wakeStageIndex: 1
      }
    );
    const result = await this.requestWake({
      ...correcting,
      codexThreadId: nested.codexThreadId?.startsWith("unbound:")
        ? undefined
        : nested.codexThreadId
    });
    const returnedTest = result.report.artefacts.find((artefact) =>
      artefact.kind === "test" && artefact.path === priorTestPath
    );
    if (!returnedTest) {
      await this.rejectContract(
        correcting,
        "WakeReportSchema",
        "artefacts.path",
        "retained_decisive_test_not_returned"
      );
    }
    waking
      .bindRuntime(result.threadId, nested.worktreePath!, nested.branchName!)
      .setWakeReport(result.report);
    const corrected = waking.snapshot();
    await this.repository.saveReality(corrected);
    return corrected;
  }

  private async experienceAndWakeNestedDream(nested: Reality): Promise<Reality> {
    const investigation = await this.requestInspection({
      ...nested,
      codexThreadId: nested.codexThreadId?.startsWith("unbound:") ? undefined : nested.codexThreadId
    });
    const experienced = RealityEntity.hydrate(nested)
      .bindRuntime(investigation.threadId, nested.worktreePath!, nested.branchName!);
    this.addObservedSubjects(experienced, investigation);
    const applied = this.applyInvestigationReport(experienced, investigation.report, false, false);
    const enumerationDream = /enumeration|response oracle/i.test(nested.name);
    let attackPath = investigation.report.evidence.find((entry) =>
      entry.kind === "test" && entry.artefactPath
    )?.artefactPath ?? investigation.report.changedFiles.find((entry) =>
      /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(entry)
    );
    if (this.codexRuntime.mode === "mock") {
      attackPath = enumerationDream
        ? "demo/password-reset/tests/enumeration.attack.spec.ts"
        : "demo/password-reset/tests/rotating-ip.attack.spec.ts";
      await this.worktrees.writeFile(
        nested.worktreePath!,
        attackPath,
        enumerationDream ? ENUMERATION_RESPONSE_TEST : ROTATING_IP_TEST
      );
      experienced.addEvidence({
        id: randomUUID(),
        kind: "test",
        title: enumerationDream
          ? "Enumeration response test prepared"
          : "Rotating-IP attack test prepared",
        summary: enumerationDream
          ? "The nested Reality encoded the public response boundary as a deterministic regression test."
          : "The nested Reality encoded the inherited delivery limit as a deterministic regression test.",
        source: "nested-dream-codex",
        artefactPath: attackPath,
        provenance: "synthetic"
      });
    }
    if (!attackPath || path.isAbsolute(attackPath) || attackPath.split(/[\\/]/).includes("..")) {
      await this.rejectContract(nested, "InvestigationReportSchema", "evidence.artefactPath", "missing_decisive_test");
      throw new Error("The nested Dream did not retain a safe, decisive regression artefact.");
    }
    const verifiedAttackPath = attackPath;
    const vitestPath = path.join(this.repoRoot, "node_modules", "vitest", "vitest.mjs");
    const attackResult = await this.worktrees.run(nested.worktreePath!, process.execPath, [
      vitestPath,
      "run",
      verifiedAttackPath,
      "--config",
      "demo/password-reset/vitest.config.ts"
    ]);
    const attackCommandOutput = [attackResult.stdout, attackResult.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    if (attackResult.exitCode === 0) {
      throw new Error("The nested Dream's regression artefact passed before synthesis, so it did not prove the counterfactual vulnerability.");
    }
    const assertionFailed = /\b(?:Test Files|Tests?)\s+\d+\s+failed\b/i.test(attackCommandOutput)
      || /\b\d+\s+tests?\s+failed\b/i.test(attackCommandOutput)
      || /\bAssertionError\b/i.test(attackCommandOutput);
    if (!assertionFailed) {
      throw new Error(
        "The nested Dream's regression command failed before a test assertion was reached; configuration or environment failures cannot become evidence."
      );
    }
    const attackOutput = attackCommandOutput
      .split("\n")
      .slice(-10)
      .join("\n");
    experienced.advanceTime(8, `Executing the ${nested.name} regression`, investigation.report.summary);
    const experiencedReality = experienced.snapshot();
    await this.repository.saveReality(experiencedReality);
    await this.emit(experiencedReality, "inspection.completed", "Nested Codex investigation produced a decisive regression artefact.", {
      evidenceIds: applied.evidenceIds,
      changedFiles: investigation.report.changedFiles,
      artefactPath: attackPath
    });
    await this.emit(experiencedReality, "evidence.discovered", `Failing test artefact decides ${nested.name}.`, {
      verdict: "failed-as-expected",
      artefactPath: attackPath,
      output: attackOutput
    });

    const waking = RealityEntity.hydrate(experiencedReality).setStatus("waking", "Kick received").advanceTime(2, "Preparing structured memory");
    await this.repository.saveReality(waking.snapshot());
    await this.emit(waking.snapshot(), "kick.triggered", `Kick triggered: stop ${nested.name} and return evidence.`, {});
    await this.emit(waking.snapshot(), "wake.collecting", "Collecting the failing test, changed belief, and remaining uncertainty.", {
      wakeStage: "collecting",
      wakeStageIndex: 1
    });
    const result = await this.requestWake({
      ...waking.snapshot(),
      codexThreadId: experiencedReality.codexThreadId
    });
    const returnedTest = result.report.artefacts.find((artefact) =>
      artefact.kind === "test" && artefact.path === verifiedAttackPath
    );
    if (!returnedTest) {
      await this.rejectContract(nested, "WakeReportSchema", "artefacts.path", "decisive_test_not_returned");
    }
    waking.bindRuntime(result.threadId, nested.worktreePath!, nested.branchName!).setWakeReport(result.report);
    const returned = waking.snapshot();
    await this.repository.saveReality(returned);
    return returned;
  }

  private async wakeAttackDream(session: DemoSession): Promise<void> {
    const dream = await this.requireDreamAtDepth(1);
    const waking = RealityEntity.hydrate(dream).setStatus("waking", "Kick received").advanceTime(3, "Consolidating subject and nested memories");
    await this.repository.saveReality(waking.snapshot());
    await this.emit(waking.snapshot(), "kick.triggered", "Kick triggered: coordinated-attack Dream must return what generalises.", {});
    await this.emit(waking.snapshot(), "wake.collecting", "Collecting Subject findings and inherited nested memories.", {
      wakeStage: "collecting",
      wakeStageIndex: 1
    });
    const result = await this.requestWake({
      ...waking.snapshot(),
      codexThreadId: dream.codexThreadId?.startsWith("unbound:") ? undefined : dream.codexThreadId
    });
    waking.bindRuntime(result.threadId, dream.worktreePath!, dream.branchName!).setWakeReport(result.report);
    const returned = waking.snapshot();
    await this.repository.saveReality(returned);

    const root = await this.requireNamedReality(ROOT_NAME);
    await this.emit(returned, "wake.sealing", "Reality Totem is sealing the parent Dream memory and verified descendant lineage.", {
      wakeStage: "sealing",
      wakeStageIndex: 2
    });
    const seal = await this.sealCanonicalMemory(session, returned, root, result.report);
    const integritySession = await this.acceptCanonicalMemorySeal(session, returned, seal);
    const proposal = root.proposals.find((entry) => entry.status === "dreaming");
    const rootEntity = RealityEntity.hydrate(root);
    if (proposal) rootEntity.updateProposal(proposal.id, "resolved");
    rootEntity.addEvidence({
      id: randomUUID(),
      kind: "invariant",
      title: "Memory: abuse controls must be layered",
      summary: result.report.recommendation,
      source: `wake-report:${dream.id}`
    });
    rootEntity.advanceTime(6, "Receiving coordinated-attack memory", "The parent Dream returned layered defensive invariants.");
    const updatedRoot = rootEntity.snapshot();
    await this.repository.saveReality(updatedRoot);
    await this.emit(returned, "wake.returning", "Validated parent memory is returning to the waking Reality.", {
      parentRealityId: root.id,
      wakeStage: "returning",
      wakeStageIndex: 3
    });
    await this.emit(returned, "memory.returned", "Memory returned from the coordinated-attack Dream.", { report: result.report });
    await this.advanceSession(integritySession, 7, updatedRoot.id);
  }

  private async synthesiseMemories(session: DemoSession): Promise<void> {
    const realities = await this.repository.listRealities();
    const root = realities.find((entry) => entry.name === ROOT_NAME);
    const attack = realities.find((entry) => entry.kind === "dream" && entry.depth === 1);
    let nestedRealities = realities
      .filter((entry) => entry.kind === "dream" && entry.depth === 2)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    if (!root || !attack || !nestedRealities.length) {
      throw new Error("The waking Reality and every canonical Dream must exist before synthesis.");
    }
    if (!root.worktreePath) throw new Error("Waking Reality worktree missing.");
    let integritySession = session;
    for (let index = 0; index < nestedRealities.length; index += 1) {
      const nested = nestedRealities[index]!;
      if (await this.hasPromotableNestedMemory(nested)) continue;
      await this.emit(
        nested,
        "validation.rejected",
        "Persisted nested memory predates the decisive artefact contract; re-entering the nested Reality for validation.",
        {
          contract: "WakeReportSchema",
          issues: [{ path: "realityId|artefacts.path", code: "legacy_memory_requires_revalidation" }]
        }
      );
      const revalidated = await this.experienceAndWakeNestedDream(nested);
      nestedRealities[index] = revalidated;
      integritySession = {
        ...integritySession,
        memoryIntegrity: integritySession.memoryIntegrity.filter((seal) =>
          seal.realityId !== nested.id
          && !seal.descendantRealityIds.includes(nested.id)
        ),
        updatedAt: new Date().toISOString()
      };
      await this.repository.saveSession(integritySession);
      await this.emit(
        revalidated,
        "memory.returned",
        "Nested memory revalidated with an identity-bound failing test artefact.",
        { report: revalidated.wakeReport }
      );
    }
    const sources = [...nestedRealities, attack];
    const reports = sources
      .map((reality) => reality.wakeReport)
      .filter((report): report is WakeReport => Boolean(report));
    if (reports.length !== sources.length) {
      throw new Error("Every Dream memory must return before synthesis.");
    }
    const lineageRealities = [root, attack, ...nestedRealities];
    for (const source of sources) {
      const existingSeal = integritySession.memoryIntegrity.find((seal) =>
        seal.realityId === source.id
      );
      const reportMatches = Boolean(
        existingSeal
        && source.wakeReport
        && this.memoryIntegrity.matchesReport(existingSeal, source.wakeReport)
      );
      const descendantsMatch = Boolean(
        existingSeal
        && this.memoryIntegrity.matchesDescendantSeals(
          existingSeal,
          source,
          lineageRealities,
          integritySession.memoryIntegrity
        )
      );
      const sourceMatches = existingSeal
        ? await this.matchesCanonicalSealedSource(source, existingSeal)
        : false;
      if (
        existingSeal?.verdict === "verified"
        && reportMatches
        && descendantsMatch
        && sourceMatches
      ) {
        continue;
      }
      if (existingSeal) {
        const failedCheck = !reportMatches
          ? "report-digest"
          : !descendantsMatch
            ? "descendant-lineage"
            : "source-state";
        const quarantined = this.memoryIntegrity.quarantine(
          existingSeal,
          failedCheck,
          `The ${failedCheck} check changed after this memory crossed its Kick boundary.`
        );
        integritySession = await this.acceptCanonicalMemorySeal(
          integritySession,
          source,
          quarantined
        );
      }
      const report = source.wakeReport;
      const parent = source.parentId
        ? await this.repository.getReality(source.parentId)
        : null;
      if (!report || !parent) throw new Error("Memory integrity lineage is incomplete.");
      const seal = await this.sealCanonicalMemory(integritySession, source, parent, report);
      integritySession = await this.acceptCanonicalMemorySeal(integritySession, source, seal);
    }

    await this.promoteWakeArtefacts(root, sources, reports);
    const runtimeResult = await this.requestSynthesis(root, reports);
    if (!runtimeResult.applied) {
      await this.worktrees.writeFile(root.worktreePath, "demo/password-reset/src/password-reset.ts", SECURE_PASSWORD_RESET_IMPLEMENTATION);
      await this.worktrees.writeFile(root.worktreePath, "demo/password-reset/tests/rotating-ip.attack.spec.ts", ROTATING_IP_TEST);
      await this.worktrees.writeFile(root.worktreePath, "demo/password-reset/tests/enumeration.attack.spec.ts", ENUMERATION_RESPONSE_TEST);
    }
    const runtimeRoot = RealityEntity.hydrate(root)
      .bindRuntime(runtimeResult.threadId, root.worktreePath, root.branchName!)
      .snapshot();
    const synthesised = this.synthesis.synthesise(runtimeRoot, reports);
    const changedFiles = await this.worktrees.listChangedFiles(root.worktreePath);
    const diff = await this.worktrees.diff(root.worktreePath, "demo/password-reset");
    await this.repository.saveReality(synthesised);
    await this.emit(synthesised, "synthesis.completed", runtimeResult.report.summary, {
      reports: reports.map((report) => report.realityId),
      changedFiles,
      retainedArtefacts: runtimeResult.report.retainedArtefacts,
      unresolved: runtimeResult.report.unresolved
    });
    await this.advanceSession({ ...integritySession, finalDiff: diff }, 8, synthesised.id, { finalDiff: diff });
  }

  private async hasPromotableNestedMemory(reality: Reality): Promise<boolean> {
    const report = reality.wakeReport;
    if (!report || report.realityId !== reality.id || !reality.worktreePath) return false;
    const artefact = report.artefacts.find((entry) =>
      entry.kind === "test"
      && !path.isAbsolute(entry.path)
      && !entry.path.split(/[\\/]/).includes("..")
      && /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(entry.path)
    );
    if (!artefact) return false;
    try {
      await this.worktrees.readFile(reality.worktreePath, artefact.path);
      return true;
    } catch {
      return artefact.content !== undefined;
    }
  }

  private async sealCanonicalMemory(
    session: DemoSession,
    reality: Reality,
    parent: Reality,
    report: WakeReport
  ): Promise<MemoryIntegritySeal> {
    if (!reality.worktreePath) throw new Error("Memory source Reality is missing its worktree.");
    let artefactsResolvable = true;
    for (const artefact of report.artefacts) {
      if (
        path.isAbsolute(artefact.path)
        || artefact.path.split(/[\\/]/).includes("..")
      ) {
        artefactsResolvable = false;
        break;
      }
      if (artefact.content !== undefined || artefact.kind === "note") continue;
      try {
        await this.worktrees.readFile(reality.worktreePath, artefact.path);
      } catch {
        artefactsResolvable = false;
        break;
      }
    }
    const realities = await this.repository.listRealities();
    const descendantSeals = session.memoryIntegrity.filter((seal) =>
      seal.verdict === "verified"
      && isDescendantOf(realities, seal.realityId, reality.id)
    );
    const descendantSourcesValid = (await Promise.all(descendantSeals.map(async (seal) => {
      const source = realities.find((candidate) => candidate.id === seal.realityId);
      return Boolean(source) && await this.matchesCanonicalSealedSource(source!, seal);
    }))).every(Boolean);
    const sourceState = await this.worktrees.diff(reality.worktreePath);
    const sourceCommit = await this.worktrees.checkpoint(
      reality.worktreePath,
      `Memory integrity seal for ${reality.id}`
    );
    return this.memoryIntegrity.seal({
      reality,
      parent,
      report,
      realities,
      inheritedMemories: realities
        .map((candidate) => candidate.wakeReport)
        .filter((memory): memory is WakeReport => Boolean(memory)),
      priorSeals: session.memoryIntegrity,
      sourceState,
      sourceCommit,
      artefactsResolvable,
      descendantSourcesValid
    });
  }

  private async matchesCanonicalSealedSource(
    reality: Reality,
    seal: MemoryIntegritySeal
  ): Promise<boolean> {
    if (!reality.worktreePath) return false;
    try {
      const [currentCommit, clean] = await Promise.all([
        this.worktrees.currentCommit(reality.worktreePath),
        this.worktrees.isClean(reality.worktreePath)
      ]);
      return this.memoryIntegrity.matchesSealedSource(seal, currentCommit, clean);
    } catch {
      return false;
    }
  }

  private async acceptCanonicalMemorySeal(
    session: DemoSession,
    reality: Reality,
    seal: MemoryIntegritySeal
  ): Promise<DemoSession> {
    const nextSession: DemoSession = {
      ...session,
      memoryIntegrity: [
        ...session.memoryIntegrity.filter((entry) => entry.realityId !== seal.realityId),
        seal
      ],
      updatedAt: new Date().toISOString()
    };
    await this.repository.saveSession(nextSession);
    if (seal.verdict === "quarantined") {
      await this.emit(reality, "memory.quarantined", `Memory quarantined from ${reality.name}; parent-owned integrity policy rejected its lineage.`, {
        sealId: seal.id,
        policyVersion: seal.policyVersion,
        failedChecks: seal.checks
          .filter((check) => check.status === "failed")
          .map((check) => check.name)
      });
      throw new Error("Memory integrity gate quarantined the returned memory.");
    }
    await this.emit(reality, "memory.verified", `Memory integrity verified for ${reality.name}; its parent Reality may inherit it.`, {
      sealId: seal.id,
      policyVersion: seal.policyVersion,
      descendantSealCount: seal.descendantSealIds.length
    });
    return nextSession;
  }

  private async runAnchors(session: DemoSession): Promise<void> {
    const root = await this.requireNamedReality(ROOT_NAME);
    if (!root.worktreePath) throw new Error("Waking worktree missing.");
    const vitestPath = path.join(this.repoRoot, "node_modules", "vitest", "vitest.mjs");
    const patterns: Record<string, string> = {
      "anchor-generic-response": "returns the same public response",
      "anchor-token-expiry": "preserves the fifteen-minute token expiry",
      "anchor-distributed-abuse": "limits one identifier"
    };
    const anchorResults: AnchorResult[] = [];

    for (const anchor of root.anchors) {
      const pattern = patterns[anchor.id] ?? anchor.name;
      const command = `vitest anchors.spec.ts -t "${pattern}"`;
      await this.emit(root, "anchor.started", `Anchor executing: ${anchor.name}.`, {
        anchorId: anchor.id,
        ownerRealityId: anchor.ownerRealityId
      });
      const startedAt = Date.now();
      const result = await this.worktrees.run(root.worktreePath, process.execPath, [
        vitestPath,
        "run",
        "demo/password-reset/tests/anchors.spec.ts",
        "--config",
        "demo/password-reset/vitest.config.ts",
        "-t",
        pattern
      ]);
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      anchorResults.push({
        anchorId: anchor.id,
        name: anchor.name,
        status: result.exitCode === 0 ? "passed" : "failed",
        output: output.split("\n").slice(-10).join("\n"),
        command,
        durationMs: Date.now() - startedAt
      });
    }
    const anchors = root.anchors.map((anchor) => {
      const result = anchorResults.find((entry) => entry.anchorId === anchor.id);
      return { ...anchor, status: result?.status ?? "failed", output: result?.output ?? "Anchor did not execute." };
    });
    await this.emit(root, "verification.started", "Complete inherited regression suite entered the waking Reality.", {});
    const verificationStartedAt = Date.now();
    const verificationCommand = "vitest run demo/password-reset/tests";
    const verification = await this.worktrees.run(root.worktreePath, process.execPath, [
      vitestPath,
      "run",
      "demo/password-reset/tests",
      "--config",
      "demo/password-reset/vitest.config.ts"
    ]);
    const verificationOutput = [verification.stdout, verification.stderr]
      .filter(Boolean)
      .join("\n")
      .trim()
      .split("\n")
      .slice(-16)
      .join("\n");
    const changedFiles = await this.worktrees.listChangedFiles(root.worktreePath);
    const regressionResult = {
      status: verification.exitCode === 0 ? "passed" as const : "failed" as const,
      output: verificationOutput,
      command: verificationCommand,
      durationMs: Date.now() - verificationStartedAt,
      testFiles: [
        "demo/password-reset/tests/anchors.spec.ts",
        ...changedFiles.filter((file) => file.endsWith(".spec.ts"))
      ].filter((file, index, files) => files.indexOf(file) === index)
    };
    const allPassed =
      anchorResults.length === root.anchors.length
      && anchorResults.every((anchor) => anchor.status === "passed")
      && regressionResult.status === "passed";
    const updated = RealityEntity.hydrate(root)
      .replaceAnchors(anchors)
      .advanceTime(
        9,
        "Verifying parent-owned invariants and returned artefacts",
        allPassed
          ? "Immutable anchors and the complete inherited regression suite passed."
          : "Reality proof failed; stabilisation is blocked until repair."
      )
      .snapshot();
    await this.repository.saveReality(updated);
    for (const anchor of anchors) {
      await this.emit(
        updated,
        anchor.status === "passed" ? "anchor.passed" : "anchor.failed",
        `${anchor.name}: ${anchor.status}.`,
        { anchorId: anchor.id, ownerRealityId: anchor.ownerRealityId }
      );
    }
    await this.emit(
      updated,
      regressionResult.status === "passed" ? "verification.passed" : "verification.failed",
      regressionResult.status === "passed"
        ? `Complete regression proof passed across ${regressionResult.testFiles.length} test artefacts.`
        : "Complete regression proof failed; Reality cannot stabilise.",
      {
        command: regressionResult.command,
        testFiles: regressionResult.testFiles,
        durationMs: regressionResult.durationMs
      }
    );
    if (!allPassed) {
      await this.emit(updated, "reality.fractured", "Reality fracture: implementation, returned evidence, and proof do not yet agree.", {});
    }
    await this.advanceSession(
      { ...session, anchorResults, regressionResult },
      9,
      updated.id,
      { anchorResults, regressionResult }
    );
  }

  private async stabilise(session: DemoSession): Promise<void> {
    const root = await this.requireNamedReality(ROOT_NAME);
    const anchorsPassed =
      session.anchorResults.length === root.anchors.length
      && session.anchorResults.every((result) => result.status === "passed");
    if (!anchorsPassed || session.regressionResult?.status !== "passed") {
      await this.emit(root, "reality.fractured", "Reality cannot stabilise until every immutable anchor and regression proof passes.", {});
      throw new Error("Reality cannot stabilise because its proof is incomplete or failing.");
    }
    await this.deferOpenProposals(await this.repository.listRealities());
    const updated = RealityEntity.hydrate(root)
      .setStatus("stabilised", "Reality stabilised")
      .setImplementationState("Layered controls verified by immutable anchors")
      .advanceTime(4, "Preserving inherited knowledge", "The waking Reality now contains the tested implementation and returned memories.")
      .snapshot();
    await this.repository.saveReality(updated);
    await this.emit(updated, "reality.stabilised", "Reality stabilised: implementation, memories, and anchors agree.", {});
    await this.advanceSession(session, 10, updated.id);
  }

  private async deferOpenProposals(realities: Reality[]): Promise<Reality[]> {
    const updated: Reality[] = [];
    for (const reality of realities) {
      const statusRank: Record<Reality["proposals"][number]["status"], number> = {
        open: 0,
        deferred: 1,
        dreaming: 2,
        resolved: 3
      };
      const uniqueByPremise = new Map<string, Reality["proposals"][number]>();
      for (const proposal of reality.proposals) {
        const key = proposal.title.trim().toLocaleLowerCase();
        const existing = uniqueByPremise.get(key);
        if (!existing) {
          uniqueByPremise.set(key, proposal);
          continue;
        }
        if (statusRank[proposal.status] > statusRank[existing.status]) {
          uniqueByPremise.set(key, { ...existing, status: proposal.status });
        }
      }
      const unique = [...uniqueByPremise.values()];
      const open = unique.filter((proposal) => proposal.status === "open");
      if (!open.length && unique.length === reality.proposals.length) {
        updated.push(reality);
        continue;
      }
      const entity = RealityEntity.hydrate({ ...reality, proposals: unique });
      for (const proposal of open) entity.updateProposal(proposal.id, "deferred");
      const deferred = entity.snapshot();
      await this.repository.saveReality(deferred);
      for (const proposal of open) {
        await this.emit(
          deferred,
          "uncertainty.deferred",
          `Remaining uncertainty retained beyond this run's Dream budget: ${proposal.uncertainty}`,
          {
            proposalId: proposal.id,
            title: proposal.title,
            reason: "dream-budget-exhausted"
          }
        );
      }
      updated.push(deferred);
    }
    return updated;
  }

  private async repairReality(session: DemoSession): Promise<void> {
    const root = await this.requireNamedReality(ROOT_NAME);
    const reports = (await this.repository.listRealities())
      .filter((reality) => reality.kind === "dream")
      .sort((left, right) => right.depth - left.depth)
      .map((reality) => reality.wakeReport)
      .filter((report): report is WakeReport => Boolean(report));
    const context = [
      ...session.anchorResults
        .filter((result) => result.status === "failed")
        .map((result) => `${result.name}: ${result.output}`),
      session.regressionResult?.status === "failed" ? session.regressionResult.output : ""
    ].filter(Boolean).join("\n\n");
    const runtimeResult = await this.requestSynthesis(root, reports, context);
    if (!root.worktreePath) throw new Error("Waking Reality worktree missing.");
    if (!runtimeResult.applied) {
      await this.worktrees.writeFile(root.worktreePath, "demo/password-reset/src/password-reset.ts", SECURE_PASSWORD_RESET_IMPLEMENTATION);
    }
    const updated = RealityEntity.hydrate(root)
      .bindRuntime(runtimeResult.threadId, root.worktreePath, root.branchName!)
      .setStatus("exploring", "Reality repair returned for proof")
      .advanceTime(8, "Reconciling failed proof", runtimeResult.report.summary)
      .snapshot();
    const diff = await this.worktrees.diff(root.worktreePath, "demo/password-reset");
    await this.repository.saveReality(updated);
    await this.emit(updated, "synthesis.completed", `Repair returned: ${runtimeResult.report.summary}`, {
      changedFiles: await this.worktrees.listChangedFiles(root.worktreePath),
      repair: true
    });
    await this.advanceSession(
      { ...session, finalDiff: diff, anchorResults: [], regressionResult: undefined },
      8,
      updated.id,
      { finalDiff: diff, anchorResults: [], regressionResult: undefined }
    );
  }

  private async requireSession(): Promise<DemoSession> {
    const session = await this.repository.getSession();
    if (!session) throw new Error("Demo session missing.");
    return session;
  }

  private async materialiseRealityContext(reality: Reality): Promise<void> {
    if (!reality.worktreePath) throw new Error(`Reality ${reality.id} has no worktree for its constitution.`);
    const constraints = reality.constitution.constraints.map((entry) => `- ${entry}`).join("\n");
    const truths = reality.constitution.parentTruths.map((entry) => `- ${entry}`).join("\n");
    const laws = (reality.constitution.runtimeLaws ?? []).map((entry) => `- ${entry}`).join("\n");
    await this.worktrees.writeFile(
      reality.worktreePath,
      ".inception/reality/REALITY.md",
      `# ${reality.name}

Reality ID: ${reality.id}
Depth: ${reality.depth}
Time dilation: ${reality.constitution.timeDilation ?? 1}x

## Premise

${reality.premise}

## Mission

${reality.constitution.mission}

## Constraints

${constraints}

## Parent Truths

${truths}

## Runtime Laws

${laws || "- No additional runtime laws."}
`
    );
    await this.worktrees.writeFile(
      reality.worktreePath,
      ".inception/reality/AGENTS.override.md",
      `# Reality Agent Contract

- Operate only inside this worktree and this Reality's premise.
- Parent-owned anchors are immutable.
- Do not create child Dreams. Return a structured Dream proposal to the orchestrator.
- Label hypothetical or simulated evidence as synthetic.
- Use sub-agents only for bounded, independent investigations and wait for them to return.
- Return evidence, artefacts, decisions, and validated summaries. Never expose hidden reasoning.
`
    );
    await this.worktrees.writeFile(
      reality.worktreePath,
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

  private async ensureRealityWorktrees(): Promise<void> {
    const run = this.reconcileOperation.then(async () => {
      const realities = (await this.repository.listRealities()).sort((left, right) => left.depth - right.depth);
      const restored = new Map<string, Reality>();

      for (const persisted of realities) {
        if (await this.worktrees.isPresent(persisted.worktreePath)) {
          restored.set(persisted.id, persisted);
          continue;
        }

        await this.emit(
          persisted,
          "reality.fractured",
          `Reality fracture detected: ${persisted.name} lost its isolated worktree.`,
          { failureKind: "worktree_missing", codexProcessActive: false }
        );
        const parent = persisted.parentId ? restored.get(persisted.parentId) : undefined;
        const descriptor = await this.worktrees.create(
          persisted.id,
          parent?.branchName ?? "HEAD",
          parent?.worktreePath
        );
        const entity = RealityEntity.hydrate(persisted).bindRuntime(
          persisted.codexThreadId ?? `unbound:${persisted.id}`,
          descriptor.path,
          descriptor.branchName
        );
        const recovered = entity.snapshot();
        await this.materialiseRealityContext(recovered);
        await this.restorePersistedArtefacts(recovered);
        await this.repository.saveReality(recovered);
        await this.emit(
          recovered,
          "reality.recovered",
          `Reality restored: ${recovered.name} regained an isolated worktree without starting Codex.`,
          {
            failureKind: "worktree_missing",
            worktree: descriptor.path,
            codexProcessActive: false
          }
        );
        restored.set(recovered.id, recovered);
      }
    });
    this.reconcileOperation = run.catch(() => undefined);
    await run;
  }

  private async restorePersistedArtefacts(reality: Reality): Promise<void> {
    const retainedPaths = new Set([
      ...reality.evidence
        .map((evidence) => evidence.artefactPath)
        .filter((artefactPath): artefactPath is string => Boolean(artefactPath)),
      ...(reality.wakeReport?.artefacts.map((artefact) => artefact.path) ?? [])
    ]);
    for (const retainedPath of retainedPaths) {
      const canonicalContent = retainedPath === "demo/password-reset/tests/rotating-ip.attack.spec.ts"
        ? ROTATING_IP_TEST
        : retainedPath === "demo/password-reset/tests/enumeration.attack.spec.ts"
          ? ENUMERATION_RESPONSE_TEST
          : undefined;
      if (canonicalContent) {
        await this.worktrees.writeFile(reality.worktreePath!, retainedPath, canonicalContent);
      }
    }
    for (const artefact of reality.wakeReport?.artefacts ?? []) {
      if (
        path.isAbsolute(artefact.path)
        || artefact.path.split(/[\\/]/).includes("..")
        || artefact.path.includes("not-supplied")
      ) {
        continue;
      }
      if (retainedPaths.has(artefact.path) && (
        artefact.path === "demo/password-reset/tests/rotating-ip.attack.spec.ts"
        || artefact.path === "demo/password-reset/tests/enumeration.attack.spec.ts"
      )) {
        continue;
      }
      if (!artefact.content) continue;
      await this.worktrees.writeFile(reality.worktreePath!, artefact.path, artefact.content);
    }
  }

  private describeOperationFailure(
    operation: ActiveRealityOperation,
    error: unknown
  ): { kind: string; summary: string; responseMessage: string } {
    const detail = (error instanceof Error ? error.message : String(error))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
    if (/ENOENT|No such file or directory/i.test(detail)) {
      return {
        kind: "worktree_missing",
        summary: `${operation.label} could not start because its Reality worktree was missing. No Codex process remains; the worktree will be restored before retry.`,
        responseMessage: `${operation.label} could not start because its Reality worktree was missing. No Codex process remains; refresh once to restore it, then retry.`
      };
    }
    if (/Wake Report/i.test(detail)) {
      return {
        kind: "contract_rejected",
        summary: `${operation.label} returned memory that did not satisfy the validated contract. No unvalidated memory entered the parent Reality.`,
        responseMessage: detail
      };
    }
    if (/Investigation Report|Synthesis Report|validation|contract/i.test(detail)) {
      return {
        kind: "contract_rejected",
        summary: `${operation.label} returned structured output that did not satisfy its validated contract. No unvalidated output entered the Reality.`,
        responseMessage: detail
      };
    }
    if (/quota rejected this turn|no quota was available/i.test(detail)) {
      return {
        kind: "codex_quota_unavailable",
        summary: detail,
        responseMessage: detail
      };
    }
    return {
      kind: operation.executor === "codex" ? "codex_operation_failed" : "reality_operation_failed",
      summary: `${operation.label} did not complete${detail ? `: ${detail}` : "."}`,
      responseMessage: `${operation.label} did not complete${detail ? `: ${detail}` : "."}`
    };
  }

  private describeAction(session: DemoSession, reality: Reality | null): DemoNextAction | null {
    const openProposal = reality?.proposals.find((proposal) => proposal.status === "open");
    const definition = session.phase === 9 && !this.proofPassed(session, reality)
      ? { id: "repair", kind: "advance", executor: "codex", verb: "repair failed proof" } satisfies ActionDefinition
      : session.phase === 5 && reality?.depth === 1 && openProposal
        ? ACTION_PLAN[4]
      : ACTION_PLAN[session.phase];
    if (!definition || !reality) return null;
    const scope = reality.constitution.scope ?? reality.name;
    const target = (() => {
      switch (definition.id) {
        case "inspect": return scope;
        case "create_attack_dream":
        case "create_nested_dream": return openProposal?.title ?? scope;
        case "enter_subjects": return reality.name;
        case "discover_abuse": return scope;
        case "wake_nested":
        case "wake_parent": return reality.name;
        case "synthesise": return `${reality.name} implementation`;
        case "run_anchors": return `${reality.anchors.length} parent-owned requirements`;
        case "repair": return `${reality.name} proof`;
        case "stabilise": return reality.name;
      }
    })();
    const label = (() => {
      switch (definition.id) {
        case "inspect": return `Ask Codex to ${definition.verb} ${target}`;
        case "discover_abuse": return `Ask Codex to ${definition.verb} ${target}`;
        case "create_attack_dream": return `Create Dream: ${target}`;
        case "create_nested_dream": return `Create nested Dream: ${target}`;
        case "enter_subjects": return `Enter attacker, investigator, and test engineer into ${target}`;
        case "wake_nested":
        case "wake_parent": return `Kick ${target}: ${definition.verb}`;
        case "synthesise": return `Synthesise returned memories into the ${target}`;
        case "run_anchors": return `Run ${target}`;
        case "repair": return `Ask Codex to repair ${target}`;
        case "stabilise": return `Stabilise ${target}`;
      }
    })();
    return { ...definition, target, label };
  }

  private proofPassed(session: DemoSession, reality?: Reality | null): boolean {
    const expectedAnchors = reality?.anchors.length ?? session.anchorResults.length;
    return (
      expectedAnchors > 0
      && session.anchorResults.length === expectedAnchors
      && session.anchorResults.every((result) => result.status === "passed")
      && session.regressionResult?.status === "passed"
    );
  }

  private async requestInspection(reality: Reality): Promise<CodexExecutionResult> {
    const baselineCommit = await this.worktrees.checkpoint(
      reality.worktreePath!,
      `Reality baseline before Codex inspection ${reality.id}`
    );
    try {
      const result = await this.codexRuntime.inspect(
        {
          ...reality,
          codexThreadId: reality.codexThreadId?.startsWith("unbound:")
            ? undefined
            : reality.codexThreadId
        },
        async (event) => {
          const current = event.metadata?.threadId
            ? await this.bindRealityThread(reality.id, event.metadata.threadId)
            : await this.repository.getReality(reality.id) ?? reality;
          if (event.metadata?.threadId) return;
          await this.emitCodexEvent(current, event);
        }
      );
      const bound = await this.bindRealityThread(reality.id, result.threadId);
      this.validateSubjectReports(bound, result.report, result.observedSubjects ?? []);
      if (reality.kind === "waking") {
        await this.worktrees.restoreCheckpoint(reality.worktreePath!, baselineCommit);
      }
      return result;
    } catch (error) {
      await this.worktrees.restoreCheckpoint(reality.worktreePath!, baselineCommit);
      const current = await this.repository.getReality(reality.id) ?? reality;
      await this.materialiseRealityContext(current);
      await this.emit(
        current,
        "reality.recovered",
        `Rejected inspection changes were removed from ${reality.name}; its isolated baseline and Codex thread were retained.`,
        {
          baselineCommit,
          threadId: current.codexThreadId,
          validation: error instanceof CodexOutputValidationError
            ? {
                contract: error.contract,
                issues: error.issues
              }
            : undefined
        }
      );
      if (error instanceof CodexOutputValidationError) {
        await this.handleContractRejection(current, error);
      }
      throw error;
    }
  }

  private async bindRealityThread(realityId: string, threadId: string): Promise<Reality> {
    const current = await this.repository.getReality(realityId);
    if (!current) throw new Error(`Reality ${realityId} was not found while binding its Codex thread.`);
    if (current.codexThreadId === threadId) return current;
    const bound = RealityEntity.hydrate(current)
      .bindRuntime(threadId, current.worktreePath!, current.branchName!)
      .snapshot();
    await this.repository.saveReality(bound);
    await this.emit(bound, "codex.thread.bound", `Codex thread bound to ${bound.name} and persisted for later turns.`, {
      threadId
    });
    return bound;
  }

  private addObservedSubjects(
    entity: RealityEntity,
    result: CodexExecutionResult
  ): void {
    for (const subject of result.observedSubjects ?? []) {
      const report = result.report.subjectReports.find((entry) => entry.subjectId === subject.id);
      if (!report || entity.snapshot().subjects.some((entry) => entry.id === subject.id)) continue;
      entity.addSubject({
        id: subject.id,
        name: subject.name,
        role: subject.role,
        mission: subject.mission,
        status: "returned",
        findings: report.findings
      });
    }
  }

  private applyInvestigationReport(
    entity: RealityEntity,
    report: InvestigationReport,
    returnSubjects: boolean,
    acceptDreamProposals = true
  ): { evidenceIds: string[] } {
    const evidenceByTitle = new Map<string, string>();
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
      evidenceByTitle.set(reported.title, evidence.id);
    }

    if (returnSubjects) {
      for (const subject of report.subjectReports) {
        entity.returnSubject(subject.subjectId, subject.findings);
      }
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
          .map((title) => evidenceByTitle.get(title))
          .filter((id): id is string => Boolean(id))
      });
    }

    const proposedDreams = acceptDreamProposals ? [
      report.dreamProposal,
      ...(entity.snapshot().constitution.dreamStrategy === "competing-siblings"
        ? [report.alternativeDreamProposal]
        : [])
    ].filter((proposal): proposal is NonNullable<typeof proposal> => Boolean(proposal)) : [];
    for (const proposal of proposedDreams) {
      const duplicate = entity.snapshot().proposals.some((existing) =>
        existing.title.trim().toLocaleLowerCase() === proposal.title.trim().toLocaleLowerCase()
        || existing.premise.trim().toLocaleLowerCase() === proposal.premise.trim().toLocaleLowerCase()
      );
      if (duplicate) continue;
      entity.addProposal({
        id: randomUUID(),
        ...proposal,
        status: "open"
      });
    }
    return { evidenceIds: [...evidenceByTitle.values()] };
  }

  private validateSubjectReports(
    reality: Reality,
    report: InvestigationReport,
    observedSubjects: CodexObservedSubject[]
  ): void {
    const activeSubjects = reality.subjects.filter((subject) =>
      subject.status === "entered" || subject.status === "investigating"
    );
    const expectedSubjects = [
      ...activeSubjects,
      ...observedSubjects.filter((subject) =>
        !activeSubjects.some((entry) => entry.id === subject.id)
      )
    ];
    if (!expectedSubjects.length && report.subjectReports.length === 0) return;
    const mismatch = expectedSubjects.find((subject) => {
      const returned = report.subjectReports.find((entry) => entry.subjectId === subject.id);
      return !returned || returned.name !== subject.name || returned.role !== subject.role;
    });
    const unexpected = report.subjectReports.find((entry) =>
      !expectedSubjects.some((subject) => subject.id === entry.subjectId)
    );
    if (mismatch || unexpected || report.subjectReports.length !== expectedSubjects.length) {
      throw new CodexOutputValidationError("InvestigationReportSchema", [{
        path: "subjectReports",
        code: "subject_identity_mismatch"
      }]);
    }
  }

  private async promoteWakeArtefacts(
    root: Reality,
    sourceRealities: Reality[],
    reports: WakeReport[]
  ): Promise<void> {
    if (!root.worktreePath) throw new Error("Waking Reality worktree missing.");
    for (const report of reports) {
      const source = sourceRealities.find((reality) => reality.id === report.realityId);
      if (!source?.worktreePath) throw new Error(`Memory source Reality ${report.realityId} is missing its worktree.`);
      for (const artefact of report.artefacts) {
        if (path.isAbsolute(artefact.path) || artefact.path.split(/[\\/]/).includes("..")) {
          await this.rejectContract(root, "WakeReportSchema", "artefacts.path", "path_outside_reality");
        }
        let content: string | undefined;
        try {
          content = await this.worktrees.readFile(source.worktreePath, artefact.path);
        } catch {
          content = artefact.content;
        }
        if (content === undefined && artefact.kind === "note") {
          content = `${artefact.name}\n\n${artefact.summary}\n`;
        }
        if (content === undefined) {
          await this.rejectContract(root, "WakeReportSchema", "artefacts.content", "missing_returned_artefact");
        }
        await this.worktrees.writeFile(root.worktreePath, artefact.path, content as string);
        await this.emit(root, "artefact.returned", `Artefact returned: ${artefact.name}.`, {
          sourceRealityId: source.id,
          path: artefact.path,
          kind: artefact.kind
        });
      }
    }
  }

  private async requestSynthesis(
    reality: Reality,
    reports: WakeReport[],
    repairContext?: string
  ): Promise<CodexSynthesisResult> {
    try {
      return await this.codexRuntime.synthesise(
        {
          ...reality,
          codexThreadId: reality.codexThreadId?.startsWith("unbound:")
            ? undefined
            : reality.codexThreadId
        },
        reports,
        async (event) => this.emitCodexEvent(reality, event),
        repairContext
      );
    } catch (error) {
      if (error instanceof CodexOutputValidationError) {
        await this.handleContractRejection(reality, error);
      }
      throw error;
    }
  }

  private async requestWake(reality: Reality): Promise<CodexWakeResult> {
    try {
      return await this.codexRuntime.wake(
        reality,
        async (event) => this.emitCodexEvent(reality, event)
      );
    } catch (error) {
      if (error instanceof WakeReportValidationError || error instanceof CodexOutputValidationError) {
        await this.handleContractRejection(reality, error);
      }
      throw error;
    }
  }

  private async rejectContract(
    reality: Reality,
    contract: CodexOutputValidationError["contract"],
    issuePath: string,
    code: string
  ): Promise<never> {
    return this.handleContractRejection(
      reality,
      new CodexOutputValidationError(contract, [{ path: issuePath, code }])
    );
  }

  private async handleContractRejection(
    reality: Reality,
    error: CodexOutputValidationError
  ): Promise<never> {
    const issue = error.issues[0];
    const issueSummary = issue ? `${issue.path} returned ${issue.code}` : "the structured fields did not match";
    const contractName = error.contract === "WakeReportSchema"
      ? "Wake Report"
      : error.contract === "InvestigationReportSchema"
        ? "Investigation Report"
        : "Synthesis Report";
    await this.emit(
      reality,
      "validation.rejected",
      `${contractName} rejected: ${issueSummary}.`,
      {
        contract: error.contract,
        ...(error.issues.length ? { issues: error.issues } : {})
      }
    );
    if (error.contract === "WakeReportSchema") {
      throw new Error(
        `Memory could not return because the Wake Report failed validation${issue ? ` (${issue.path}: ${issue.code})` : ""}.`
      );
    }
    throw new Error(
      `${contractName} could not enter the Reality because validation failed${issue ? ` (${issue.path}: ${issue.code})` : ""}.`
    );
  }

  private async requireNamedReality(name: string): Promise<Reality> {
    const reality = (await this.repository.listRealities()).find((entry) => entry.name === name);
    if (!reality) throw new Error(`Reality ${name} missing.`);
    return reality;
  }

  private async requireDreamAtDepth(depth: number): Promise<Reality> {
    const reality = (await this.repository.listRealities()).find((entry) =>
      entry.kind === "dream" && entry.depth === depth
    );
    if (!reality) throw new Error(`Dream at depth ${depth} missing.`);
    return reality;
  }

  private async archiveCurrentRun(): Promise<void> {
    const session = await this.repository.getSession();
    if (!session) return;
    const events = await this.repository.listEvents(5_000);
    const hasRunActivity = session.phase > 0 || events.some((event) => event.type === "codex.progress");
    if (!hasRunActivity) return;
    const archivedAt = new Date().toISOString();
    await this.repository.saveRunArchive(
      await this.collectRunLog(randomUUID(), archivedAt, session, events)
    );
  }

  private async collectRunLog(
    id: string,
    archivedAt: string,
    session?: DemoSession,
    events?: RealityEvent[]
  ): Promise<RealityRunArchive> {
    const [resolvedSession, realities, resolvedEvents] = await Promise.all([
      session ? Promise.resolve(session) : this.requireSession(),
      this.repository.listRealities(),
      events ? Promise.resolve(events) : this.repository.listEvents(5_000)
    ]);
    return RealityRunArchiveSchema.parse({
      id,
      session: resolvedSession,
      realities,
      events: resolvedEvents,
      archivedAt
    });
  }

  private async advanceSession(
    session: DemoSession,
    phase: number,
    activeRealityId: string,
    changes: Partial<Pick<DemoSession, "finalDiff" | "anchorResults" | "regressionResult">> = {}
  ): Promise<void> {
    await this.repository.saveSession({
      ...session,
      ...changes,
      ...(this.demoAutopilotControl
        ? { autopilot: { ...this.demoAutopilotControl } }
        : {}),
      phase,
      activeRealityId,
      updatedAt: new Date().toISOString()
    });
  }

  private async emit(reality: Reality, type: RealityEventType, summary: string, payload: Record<string, unknown>): Promise<void> {
    const event: RealityEvent = {
      id: randomUUID(),
      realityId: reality.id,
      type,
      summary,
      dreamTime: reality.worldState.simulatedMinutes,
      payload,
      occurredAt: new Date().toISOString()
    };
    await this.repository.appendEvent(event);
    this.eventBus.publish(event);
  }

  private startDemoAutopilotLoop(): void {
    if (this.demoAutopilotLoop) return;
    this.demoAutopilotLoop = this.runDemoAutopilot()
      .finally(() => {
        this.demoAutopilotLoop = null;
      });
  }

  private async runDemoAutopilot(): Promise<void> {
    while (this.demoAutopilotControl?.mode === "running") {
      const session = await this.requireSession();
      const control = this.demoAutopilotControl;
      if (!control || control.mode !== "running") return;
      if (session.phase >= 10) {
        const active = session.activeRealityId
          ? await this.repository.getReality(session.activeRealityId)
          : null;
        const completed: DemoAutopilotState = {
          ...control,
          mode: "completed",
          updatedAt: new Date().toISOString(),
          pauseReason: undefined
        };
        this.demoAutopilotControl = completed;
        await this.repository.saveSession({ ...session, autopilot: completed });
        if (active) {
          await this.emit(active, "autopilot.completed", "Guided auto mode reached the stabilised waking Reality.", {
            actionsCompleted: completed.actionsCompleted
          });
        }
        return;
      }
      if (control.actionsCompleted >= control.maxActions) {
        await this.pauseDemoAutopilot("The configured guided-auto action limit was reached.");
        return;
      }
      const elapsedMinutes = control.startedAt
        ? (Date.now() - new Date(control.startedAt).getTime()) / 60_000
        : 0;
      if (elapsedMinutes >= control.maxMinutes) {
        await this.pauseDemoAutopilot("The configured guided-auto wall-clock limit was reached.");
        return;
      }
      const active = session.activeRealityId
        ? await this.repository.getReality(session.activeRealityId)
        : null;
      const next = this.describeAction(session, active);
      if (!next) {
        await this.pauseDemoAutopilot("The Demo Mission has no valid next action.");
        return;
      }
      const proofFailure = next.id === "repair"
        && session.anchorResults.some((result) => result.status === "failed");
      const gated = control.kind === "guided-real"
        && (
          (next.kind === "dream" && control.pauseOnDream)
          || proofFailure
        );
      if (gated && control.approvedAction !== next.id) {
        await this.pauseDemoAutopilot(
          proofFailure
            ? "An immutable anchor failed; inspect the evidence before authorizing repair."
            : "A new counterfactual premise requires explicit approval."
        );
        return;
      }
      const executing: DemoAutopilotState = {
        ...control,
        approvedAction: undefined,
        lastAction: next.id,
        updatedAt: new Date().toISOString()
      };
      this.demoAutopilotControl = executing;
      try {
        await this.act(next.id);
      } catch (error) {
        await this.pauseDemoAutopilot(
          `Action ${next.id} stopped: ${error instanceof Error ? error.message : "unknown failure"}`
        );
        return;
      }
      const currentSession = await this.requireSession();
      const latest = this.demoAutopilotControl;
      if (!latest || latest.mode !== "running") return;
      const advanced: DemoAutopilotState = {
        ...latest,
        actionsCompleted: latest.actionsCompleted + 1,
        lastAction: next.id,
        updatedAt: new Date().toISOString()
      };
      this.demoAutopilotControl = advanced;
      await this.repository.saveSession({ ...currentSession, autopilot: advanced });
      await new Promise((resolve) => setTimeout(resolve, advanced.paceMilliseconds));
    }
  }

  private async pauseDemoAutopilot(reason: string): Promise<void> {
    const session = await this.requireSession();
    const current = this.demoAutopilotControl ?? session.autopilot;
    const paused: DemoAutopilotState = {
      ...current,
      mode: "paused",
      pauseReason: reason,
      updatedAt: new Date().toISOString()
    };
    this.demoAutopilotControl = paused;
    await this.repository.saveSession({ ...session, autopilot: paused });
    const active = session.activeRealityId
      ? await this.repository.getReality(session.activeRealityId)
      : null;
    if (active) {
      const controllerName = paused.kind === "guided-real"
        ? "Guided real auto mode"
        : "Recording auto mode";
      await this.emit(active, "autopilot.paused", `${controllerName} paused: ${reason}`, {
        actionsCompleted: paused.actionsCompleted,
        reason
      });
    }
  }

  private async emitCodexEvent(reality: Reality, event: CodexRuntimeEvent): Promise<void> {
    const eventType: RealityEventType = event.type === "subject"
      ? event.metadata?.subjectState === "started"
        ? "subject.started"
        : event.metadata?.subjectState === "failed"
          ? "subject.failed"
          : "subject.completed"
      : "codex.progress";
    await this.emit(reality, eventType, event.summary, {
      kind: event.type,
      metadata: event.metadata,
      operationId: this.activeOperation?.id,
      action: this.activeOperation?.action
    });
  }
}
