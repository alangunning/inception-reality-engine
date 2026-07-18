import { randomUUID } from "node:crypto";
import {
  type Belief,
  type DreamProposal,
  type Evidence,
  type Reality,
  type RealityAnchor,
  type RealityConstitution,
  RealitySchema,
  type Subject,
  type WakeReport
} from "./schemas";

const now = () => new Date().toISOString();

export interface CreateRealityInput {
  id?: string;
  parentId?: string | null;
  depth: number;
  kind: "waking" | "dream";
  name: string;
  premise: string;
  constitution: RealityConstitution;
  inheritedAnchors?: RealityAnchor[];
  initialBeliefs?: Array<Pick<Belief, "statement" | "confidence" | "origin">>;
}

export class RealityEntity {
  private constructor(private state: Reality) {}

  static create(input: CreateRealityInput): RealityEntity {
    const id = input.id ?? randomUUID();
    const timestamp = now();
    const state: Reality = {
      id,
      parentId: input.parentId ?? null,
      depth: input.depth,
      kind: input.kind,
      name: input.name,
      status: "forming",
      premise: input.premise,
      constitution: input.constitution,
      worldState: {
        summary: input.premise,
        implementationState: "Unexamined",
        simulatedMinutes: 0,
        currentFocus: "Establishing the world",
        status: "Reality forming"
      },
      subjects: [],
      beliefs: (input.initialBeliefs ?? []).map((belief) => ({
        id: randomUUID(),
        realityId: id,
        statement: belief.statement,
        confidence: belief.confidence,
        origin: belief.origin,
        evidenceIds: [],
        createdAt: timestamp
      })),
      evidence: [],
      proposals: [],
      anchors: (input.inheritedAnchors ?? []).map((anchor) => ({
        ...anchor,
        realityId: id,
        status: "pending",
        output: undefined
      })),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return new RealityEntity(RealitySchema.parse(state));
  }

  static hydrate(reality: Reality): RealityEntity {
    return new RealityEntity(RealitySchema.parse(reality));
  }

  snapshot(): Reality {
    return structuredClone(this.state);
  }

  bindRuntime(threadId: string, worktreePath: string, branchName: string): this {
    this.state.codexThreadId = threadId;
    this.state.worktreePath = worktreePath;
    this.state.branchName = branchName;
    return this.touch();
  }

  setStatus(status: Reality["status"], summary?: string): this {
    this.state.status = status;
    if (summary) this.state.worldState.status = summary;
    return this.touch();
  }

  advanceTime(minutes: number, focus: string, summary?: string): this {
    this.state.worldState.simulatedMinutes += minutes;
    this.state.worldState.currentFocus = focus;
    if (summary) this.state.worldState.summary = summary;
    return this.touch();
  }

  setImplementationState(state: string): this {
    this.state.worldState.implementationState = state;
    return this.touch();
  }

  addSubject(subject: Omit<Subject, "realityId">): this {
    this.state.subjects.push({ ...subject, realityId: this.state.id });
    return this.touch();
  }

  returnSubject(subjectId: string, findings: string[]): this {
    const subject = this.state.subjects.find((entry) => entry.id === subjectId);
    if (subject) {
      subject.status = "returned";
      subject.findings = findings;
    }
    return this.touch();
  }

  addEvidence(evidence: Omit<Evidence, "realityId" | "createdAt">): Evidence {
    const complete: Evidence = {
      ...evidence,
      realityId: this.state.id,
      createdAt: now()
    };
    this.state.evidence.push(complete);
    this.touch();
    return complete;
  }

  addBelief(belief: Omit<Belief, "realityId" | "createdAt">): Belief {
    const complete: Belief = {
      ...belief,
      realityId: this.state.id,
      createdAt: now()
    };
    this.state.beliefs.push(complete);
    this.touch();
    return complete;
  }

  addProposal(proposal: Omit<DreamProposal, "realityId">): this {
    this.state.proposals.push({ ...proposal, realityId: this.state.id });
    return this.touch();
  }

  updateProposal(proposalId: string, status: DreamProposal["status"]): this {
    const proposal = this.state.proposals.find((entry) => entry.id === proposalId);
    if (proposal) proposal.status = status;
    return this.touch();
  }

  setWakeReport(report: WakeReport): this {
    this.state.wakeReport = report;
    this.state.status = "kicked";
    this.state.worldState.status = "Memory returned";
    return this.touch();
  }

  replaceAnchors(anchors: RealityAnchor[]): this {
    this.state.anchors = anchors.map((anchor) => ({ ...anchor, immutable: true as const }));
    return this.touch();
  }

  private touch(): this {
    this.state.updatedAt = now();
    RealitySchema.parse(this.state);
    return this;
  }
}
