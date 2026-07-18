import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  RealityEntity,
  RealityRunArchiveSchema,
  type AnchorResult,
  type DemoSession,
  type Reality,
  type RealityEvent,
  type RealityEventType,
  type RealityRunArchive
} from "@inception/domain";
import {
  type CodexRuntime,
  type CodexRuntimeEvent,
  type CodexWakeResult,
  WakeReportValidationError
} from "./codex-port";
import type { WorktreeManager } from "@inception/worktree-manager";
import { ROTATING_IP_TEST, SECURE_PASSWORD_RESET_IMPLEMENTATION } from "./demo-fixture";
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
  7: { id: "synthesise", kind: "advance", executor: "orchestrator", verb: "synthesise returned memories" },
  8: { id: "run_anchors", kind: "verify", executor: "orchestrator", verb: "run immutable anchors" },
  9: { id: "stabilise", kind: "advance", executor: "orchestrator", verb: "stabilise" }
};

const ROOT_NAME = "Waking Reality";
const ATTACK_DREAM_NAME = "Under coordinated attack";
const ROTATING_DREAM_NAME = "Rotating IP swarm";

export class RealityOrchestrator {
  private operation: Promise<void> = Promise.resolve();
  private seedOperation: Promise<void> = Promise.resolve();
  private activeOperation: ActiveRealityOperation | null = null;

  constructor(
    private readonly repository: RealityRepository,
    private readonly eventBus: RealityEventBus,
    private readonly codexRuntime: CodexRuntime,
    private readonly worktrees: WorktreeManager,
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
            "Classify a non-zero command as test evidence, environment failure, or configuration failure before retrying."
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
      await this.repository.saveReality(reality);

      const timestamp = new Date().toISOString();
      const session: DemoSession = {
        id: "singleton",
        phase: 0,
        activeRealityId: reality.id,
        finalDiff: "",
        anchorResults: [],
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
    const [session, realities, events] = await Promise.all([
      this.repository.getSession(),
      this.repository.listRealities(),
      this.repository.listEvents()
    ]);
    if (!session) throw new Error("Demo session is missing.");
    const activeReality = realities.find((reality) => reality.id === session.activeRealityId) ?? null;
    return {
      session,
      realities,
      events,
      activeReality,
      operation: this.activeOperation ? { ...this.activeOperation } : null,
      nextAction: this.activeOperation ? null : this.describeAction(session.phase, activeReality)
    };
  }

  async act(action: DemoAction): Promise<DemoSnapshot> {
    const run = this.operation.then(async () => {
      await this.ensureSeeded();
      const session = await this.requireSession();
      const definition = ACTION_PLAN[session.phase];
      const expected = definition?.id;
      if (action !== expected) {
        throw new Error(`Action ${action} is not valid in phase ${session.phase}; expected ${expected ?? "none"}.`);
      }
      if (!session.activeRealityId) {
        throw new Error("The Reality operation has no active locus.");
      }
      const activeReality = await this.repository.getReality(session.activeRealityId);
      if (!activeReality) {
        throw new Error("The active Reality could not be found.");
      }
      const nextAction = this.describeAction(session.phase, activeReality);
      if (!nextAction) {
        throw new Error(`No Reality action exists for phase ${session.phase}.`);
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
          case "stabilise": await this.stabilise(session); break;
        }
      } finally {
        if (this.activeOperation?.id === operation.id) this.activeOperation = null;
      }
    });
    this.operation = run.catch(() => undefined);
    await run;
    return this.snapshot();
  }

  async reset(): Promise<DemoSnapshot> {
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
    const runtimeResult = await this.codexRuntime.inspect(
      {
        ...root,
        codexThreadId: root.codexThreadId?.startsWith("unbound:") ? undefined : root.codexThreadId
      },
      async (event) => this.emitCodexEvent(root, event)
    );
    const entity = RealityEntity.hydrate(root);
    entity.bindRuntime(runtimeResult.threadId, root.worktreePath!, root.branchName!);
    const codeEvidence = entity.addEvidence({
      id: randomUUID(),
      kind: "code",
      title: "IP-only throttle",
      summary: "The implementation counts requests by source IP but has no identifier-level or global safety budget.",
      source: "demo/password-reset/src/password-reset.ts",
      artefactPath: "demo/password-reset/src/password-reset.ts"
    });
    entity.addProposal({
      id: randomUUID(),
      title: ATTACK_DREAM_NAME,
      premise: "Assume an attacker coordinates requests across accounts and source addresses.",
      uncertainty: "Does per-IP rate limiting actually prevent abuse?",
      rationale: "The implementation has only been evaluated in a single-source world.",
      status: "open"
    });
    entity
      .setStatus("exploring", "Reality inspecting implementation")
      .setImplementationState("Per-IP limiter; account-specific responses; no identifier cooldown")
      .advanceTime(12, "Testing the initial abuse model", runtimeResult.summary);
    const updated = entity.snapshot();
    await this.repository.saveReality(updated);
    await this.emit(updated, "codex.thread.bound", "Codex thread bound to the waking Reality worktree.", { threadId: runtimeResult.threadId });
    await this.emit(updated, "inspection.completed", "Password-reset boundary inspected; one defensive layer is visible.", { evidenceId: codeEvidence.id });
    await this.emit(updated, "uncertainty.discovered", "Uncertainty surfaced: can distributed sources bypass per-IP protection?", { proposal: ATTACK_DREAM_NAME });
    await this.advanceSession(session, 1, updated.id);
  }

  private async createAttackDream(session: DemoSession): Promise<void> {
    const root = await this.requireNamedReality(ROOT_NAME);
    const proposal = root.proposals.find((entry) => entry.title === ATTACK_DREAM_NAME);
    if (!proposal) throw new Error("Attack Dream proposal missing.");
    const rootEntity = RealityEntity.hydrate(root).updateProposal(proposal.id, "dreaming");

    const dream = RealityEntity.create({
      parentId: root.id,
      depth: 1,
      kind: "dream",
      name: ATTACK_DREAM_NAME,
      premise: proposal.premise,
      constitution: {
        mission: "Break the current password-reset abuse assumptions using bounded adversarial investigation.",
        scope: "coordinated password-reset abuse",
        premise: proposal.premise,
        constraints: root.constitution.constraints,
        wakeContract: root.constitution.wakeContract,
        parentTruths: [...root.constitution.parentTruths, "Per-IP throttling exists in the parent implementation."]
      },
      inheritedAnchors: root.anchors,
      initialBeliefs: [{
        statement: "Per-IP limiting probably prevents practical password-reset abuse.",
        confidence: 0.72,
        origin: "inherited"
      }]
    });
    const descriptor = await this.worktrees.create(dream.snapshot().id, root.branchName ?? "HEAD");
    dream.bindRuntime(`unbound:${dream.snapshot().id}`, descriptor.path, descriptor.branchName)
      .setStatus("exploring", "Dream entered")
      .advanceTime(3, "Establishing coordinated-attack conditions");
    const created = dream.snapshot();
    await this.repository.saveReality(rootEntity.snapshot());
    await this.repository.saveReality(created);
    await this.emit(created, "dream.created", "Creating dream: Under coordinated attack.", { parentId: root.id, depth: 1 });
    await this.advanceSession(session, 2, created.id);
  }

  private async enterSubjects(session: DemoSession): Promise<void> {
    const dream = await this.requireNamedReality(ATTACK_DREAM_NAME);
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
    const dream = await this.requireNamedReality(ATTACK_DREAM_NAME);
    const runtimeResult = await this.codexRuntime.inspect(
      {
        ...dream,
        codexThreadId: dream.codexThreadId?.startsWith("unbound:") ? undefined : dream.codexThreadId
      },
      async (event) => this.emitCodexEvent(dream, event)
    );
    const entity = RealityEntity.hydrate(dream);
    entity.bindRuntime(runtimeResult.threadId, dream.worktreePath!, dream.branchName!);
    const [attacker, investigator, tester] = dream.subjects;
    if (attacker) entity.returnSubject(attacker.id, ["Known and unknown accounts receive distinguishable responses."]);
    if (investigator) entity.returnSubject(investigator.id, ["Counters are keyed only by IP; identifiers have no cooldown."]);
    if (tester) entity.returnSubject(tester.id, ["A rotating-source test will decide whether the defence generalises."]);
    const enumeration = entity.addEvidence({
      id: randomUUID(),
      kind: "observation",
      title: "Account enumeration remains possible",
      summary: "The incomplete service returns a distinct message when an account does not exist.",
      source: "attacker-subject"
    });
    const distributed = entity.addEvidence({
      id: randomUUID(),
      kind: "code",
      title: "Distributed abuse has no shared budget",
      summary: "Requests from new IP addresses begin with fresh counters even when the same account is targeted.",
      source: "investigator-subject"
    });
    entity.addBelief({
      id: randomUUID(),
      statement: "Per-IP throttling alone does not generalise to coordinated or distributed abuse.",
      confidence: 0.93,
      origin: "observed",
      supersedesBeliefId: dream.beliefs.at(-1)?.id,
      evidenceIds: [enumeration.id, distributed.id]
    });
    entity.addProposal({
      id: randomUUID(),
      title: ROTATING_DREAM_NAME,
      premise: "Assume one attacker can rotate source IPs for every request against one identifier.",
      uncertainty: "Can source rotation obtain effectively unlimited reset deliveries?",
      rationale: "A nested world can isolate the distributed-address assumption and produce one decisive test.",
      status: "open"
    });
    entity.advanceTime(16, "Selecting the decisive nested experiment", "Enumeration is proven; distributed abuse remains the central uncertainty.");
    const updated = entity.snapshot();
    await this.repository.saveReality(updated);
    await this.emit(updated, "evidence.discovered", "Evidence discovered: account enumeration survives the current implementation.", { evidenceId: enumeration.id });
    await this.emit(updated, "evidence.discovered", "Evidence discovered: IP counters do not share an identifier-level budget.", { evidenceId: distributed.id });
    await this.emit(updated, "belief.changed", "Belief changed: one network boundary is not an abuse boundary.", { confidence: 0.93 });
    for (const subject of updated.subjects) {
      await this.emit(updated, "subject.returned", `Subject returned: ${subject.name}.`, { findings: subject.findings });
    }
    await this.advanceSession(session, 4, updated.id);
  }

  private async createNestedDream(session: DemoSession): Promise<void> {
    const parent = await this.requireNamedReality(ATTACK_DREAM_NAME);
    const proposal = parent.proposals.find((entry) => entry.title === ROTATING_DREAM_NAME);
    if (!proposal) throw new Error("Rotating-IP proposal missing.");
    const parentEntity = RealityEntity.hydrate(parent).updateProposal(proposal.id, "dreaming");
    const nested = RealityEntity.create({
      parentId: parent.id,
      depth: 2,
      kind: "dream",
      name: ROTATING_DREAM_NAME,
      premise: proposal.premise,
      constitution: {
        mission: "Produce a deterministic rotating-IP attack artefact and wake immediately when the result is decisive.",
        scope: "rotating-IP abuse",
        premise: proposal.premise,
        constraints: parent.constitution.constraints,
        wakeContract: parent.constitution.wakeContract,
        parentTruths: [...parent.constitution.parentTruths, "The same identifier is targeted from independent addresses."]
      },
      inheritedAnchors: parent.anchors,
      initialBeliefs: [{
        statement: "Per-IP throttling will still constrain a repeated attack.",
        confidence: 0.64,
        origin: "inherited"
      }]
    });
    const descriptor = await this.worktrees.create(nested.snapshot().id, parent.branchName ?? "HEAD");
    nested.bindRuntime(`unbound:${nested.snapshot().id}`, descriptor.path, descriptor.branchName)
      .setStatus("exploring", "Nested Dream entered")
      .advanceTime(4, "Replaying one account across twelve addresses");
    await this.worktrees.writeFile(descriptor.path, "demo/password-reset/tests/rotating-ip.attack.spec.ts", ROTATING_IP_TEST);
    const vitestPath = path.join(this.repoRoot, "node_modules", "vitest", "vitest.mjs");
    const attackResult = await this.worktrees.run(descriptor.path, process.execPath, [
      vitestPath,
      "run",
      "demo/password-reset/tests/rotating-ip.attack.spec.ts",
      "--config",
      "demo/password-reset/vitest.config.ts"
    ]);
    if (attackResult.exitCode === 0) {
      throw new Error("The rotating-IP Dream did not reproduce the expected vulnerability.");
    }
    const attackOutput = [attackResult.stdout, attackResult.stderr]
      .filter(Boolean)
      .join("\n")
      .trim()
      .split("\n")
      .slice(-10)
      .join("\n");
    const evidence = nested.addEvidence({
      id: randomUUID(),
      kind: "test",
      title: "Rotating-IP attack test prepared",
      summary: "Executed in the nested worktree: twelve source addresses deliver twelve resets instead of the anchored maximum of three.",
      source: "test-engineer-subject",
      artefactPath: "demo/password-reset/tests/rotating-ip.attack.spec.ts"
    });
    const created = nested.snapshot();
    await this.repository.saveReality(parentEntity.snapshot());
    await this.repository.saveReality(created);
    await this.emit(created, "dream.created", "Creating dream: Rotating IP swarm.", { parentId: parent.id, depth: 2 });
    await this.emit(created, "evidence.discovered", "Failing attack artefact proves source rotation bypasses the current limit.", {
      evidenceId: evidence.id,
      verdict: "failed-as-expected",
      output: attackOutput
    });
    await this.advanceSession(session, 5, created.id);
  }

  private async wakeNestedDream(session: DemoSession): Promise<void> {
    const nested = await this.requireNamedReality(ROTATING_DREAM_NAME);
    const waking = RealityEntity.hydrate(nested).setStatus("waking", "Kick received").advanceTime(2, "Preparing structured memory");
    await this.repository.saveReality(waking.snapshot());
    await this.emit(waking.snapshot(), "kick.triggered", "Kick triggered: stop the rotating-IP Dream and return evidence.", {});
    const result = await this.requestWake({
      ...waking.snapshot(),
      codexThreadId: nested.codexThreadId?.startsWith("unbound:") ? undefined : nested.codexThreadId
    });
    waking.bindRuntime(result.threadId, nested.worktreePath!, nested.branchName!).setWakeReport(result.report);
    const returned = waking.snapshot();
    await this.repository.saveReality(returned);

    const parent = await this.requireNamedReality(ATTACK_DREAM_NAME);
    const proposal = parent.proposals.find((entry) => entry.title === ROTATING_DREAM_NAME);
    const parentEntity = RealityEntity.hydrate(parent);
    if (proposal) parentEntity.updateProposal(proposal.id, "resolved");
    parentEntity.addEvidence({
      id: randomUUID(),
      kind: "test",
      title: "Memory: rotating-IP attack fails the parent assumption",
      summary: result.report.recommendation,
      source: `wake-report:${nested.id}`,
      artefactPath: result.report.artefacts[0]?.path
    });
    parentEntity.advanceTime(5, "Receiving nested memory", "A decisive failing test returned from depth two.");
    const updatedParent = parentEntity.snapshot();
    await this.repository.saveReality(updatedParent);
    await this.emit(returned, "memory.returned", "Memory returned from the rotating-IP Dream with a failing test artefact.", { report: result.report });
    await this.advanceSession(session, 6, updatedParent.id);
  }

  private async wakeAttackDream(session: DemoSession): Promise<void> {
    const dream = await this.requireNamedReality(ATTACK_DREAM_NAME);
    const waking = RealityEntity.hydrate(dream).setStatus("waking", "Kick received").advanceTime(3, "Consolidating subject and nested memories");
    await this.repository.saveReality(waking.snapshot());
    await this.emit(waking.snapshot(), "kick.triggered", "Kick triggered: coordinated-attack Dream must return what generalises.", {});
    const result = await this.requestWake({
      ...waking.snapshot(),
      codexThreadId: dream.codexThreadId?.startsWith("unbound:") ? undefined : dream.codexThreadId
    });
    waking.bindRuntime(result.threadId, dream.worktreePath!, dream.branchName!).setWakeReport(result.report);
    const returned = waking.snapshot();
    await this.repository.saveReality(returned);

    const root = await this.requireNamedReality(ROOT_NAME);
    const proposal = root.proposals.find((entry) => entry.title === ATTACK_DREAM_NAME);
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
    await this.emit(returned, "memory.returned", "Memory returned from the coordinated-attack Dream.", { report: result.report });
    await this.advanceSession(session, 7, updatedRoot.id);
  }

  private async synthesiseMemories(session: DemoSession): Promise<void> {
    const [root, attack, nested] = await Promise.all([
      this.requireNamedReality(ROOT_NAME),
      this.requireNamedReality(ATTACK_DREAM_NAME),
      this.requireNamedReality(ROTATING_DREAM_NAME)
    ]);
    const reports = [nested.wakeReport, attack.wakeReport].filter((report): report is NonNullable<typeof report> => Boolean(report));
    const synthesised = this.synthesis.synthesise(root, reports);
    if (!synthesised.worktreePath) throw new Error("Waking Reality worktree missing.");
    await this.worktrees.writeFile(synthesised.worktreePath, "demo/password-reset/src/password-reset.ts", SECURE_PASSWORD_RESET_IMPLEMENTATION);
    await this.worktrees.writeFile(synthesised.worktreePath, "demo/password-reset/tests/rotating-ip.attack.spec.ts", ROTATING_IP_TEST);
    await this.worktrees.run(synthesised.worktreePath, "git", ["add", "-N", "demo/password-reset/tests/rotating-ip.attack.spec.ts"]);
    const diff = await this.worktrees.diff(synthesised.worktreePath, "demo/password-reset");
    await this.repository.saveReality(synthesised);
    await this.emit(synthesised, "synthesis.completed", "Returned memories changed the waking implementation and its abuse model.", {
      reports: reports.map((report) => report.realityId),
      changedFiles: [
        "demo/password-reset/src/password-reset.ts",
        "demo/password-reset/tests/rotating-ip.attack.spec.ts"
      ]
    });
    await this.advanceSession({ ...session, finalDiff: diff }, 8, synthesised.id, { finalDiff: diff });
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
    const allPassed = anchorResults.every((anchor) => anchor.status === "passed");
    const updated = RealityEntity.hydrate(root)
      .replaceAnchors(anchors)
      .advanceTime(9, "Verifying parent-owned invariants", allPassed ? "All immutable anchors passed." : "One or more anchors failed.")
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
    await this.advanceSession({ ...session, anchorResults }, 9, updated.id, { anchorResults });
  }

  private async stabilise(session: DemoSession): Promise<void> {
    const root = await this.requireNamedReality(ROOT_NAME);
    const updated = RealityEntity.hydrate(root)
      .setStatus("stabilised", "Reality stabilised")
      .setImplementationState("Layered controls verified by immutable anchors")
      .advanceTime(4, "Preserving inherited knowledge", "The waking Reality now contains the tested implementation and returned memories.")
      .snapshot();
    await this.repository.saveReality(updated);
    await this.emit(updated, "reality.stabilised", "Reality stabilised: implementation, memories, and anchors agree.", {});
    await this.advanceSession(session, 10, updated.id);
  }

  private async requireSession(): Promise<DemoSession> {
    const session = await this.repository.getSession();
    if (!session) throw new Error("Demo session missing.");
    return session;
  }

  private describeAction(phase: number, reality: Reality | null): DemoNextAction | null {
    const definition = ACTION_PLAN[phase];
    if (!definition || !reality) return null;
    const scope = reality.constitution.scope ?? reality.name;
    const openProposal = reality.proposals.find((proposal) => proposal.status === "open");
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
        case "stabilise": return `Stabilise ${target}`;
      }
    })();
    return { ...definition, target, label };
  }

  private async requestWake(reality: Reality): Promise<CodexWakeResult> {
    try {
      return await this.codexRuntime.wake(
        reality,
        async (event) => this.emitCodexEvent(reality, event)
      );
    } catch (error) {
      if (error instanceof WakeReportValidationError) {
        const issue = error.issues[0];
        const issueSummary = issue ? `${issue.path} returned ${issue.code}` : "the structured fields did not match";
        await this.emit(
          reality,
          "validation.rejected",
          `Wake Report rejected: ${issueSummary}.`,
          {
            contract: "WakeReportSchema",
            ...(error.issues.length ? { issues: error.issues } : {})
          }
        );
        throw new Error(
          `Memory could not return because the Wake Report failed validation${issue ? ` (${issue.path}: ${issue.code})` : ""}.`
        );
      }
      throw error;
    }
  }

  private async requireNamedReality(name: string): Promise<Reality> {
    const reality = (await this.repository.listRealities()).find((entry) => entry.name === name);
    if (!reality) throw new Error(`Reality ${name} missing.`);
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
    changes: Partial<Pick<DemoSession, "finalDiff" | "anchorResults">> = {}
  ): Promise<void> {
    await this.repository.saveSession({
      ...session,
      ...changes,
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

  private async emitCodexEvent(reality: Reality, event: CodexRuntimeEvent): Promise<void> {
    await this.emit(reality, "codex.progress", event.summary, {
      kind: event.type,
      metadata: event.metadata,
      operationId: this.activeOperation?.id,
      action: this.activeOperation?.action
    });
  }
}
