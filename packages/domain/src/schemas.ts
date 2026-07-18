import { z } from "zod";

export const RealityStatusSchema = z.enum([
  "forming",
  "exploring",
  "waking",
  "stabilised",
  "kicked"
]);

export const RealityKindSchema = z.enum(["waking", "dream"]);

export const RealityConstitutionSchema = z.object({
  mission: z.string().min(1),
  scope: z.string().min(1).optional(),
  premise: z.string().min(1),
  constraints: z.array(z.string()),
  wakeContract: z.array(z.string()),
  parentTruths: z.array(z.string()),
  timeDilation: z.number().int().positive().optional(),
  runtimeLaws: z.array(z.string()).optional()
});

export const WorldStateSchema = z.object({
  summary: z.string(),
  implementationState: z.string(),
  simulatedMinutes: z.number().int().nonnegative(),
  currentFocus: z.string(),
  status: z.string()
});

export const SubjectSchema = z.object({
  id: z.string(),
  realityId: z.string(),
  name: z.string(),
  role: z.string(),
  mission: z.string(),
  status: z.enum(["entered", "investigating", "returned"]),
  findings: z.array(z.string())
});

export const BeliefSchema = z.object({
  id: z.string(),
  realityId: z.string(),
  statement: z.string(),
  confidence: z.number().min(0).max(1),
  origin: z.enum(["initial", "observed", "inherited", "synthesised"]),
  supersedesBeliefId: z.string().optional(),
  evidenceIds: z.array(z.string()),
  createdAt: z.string()
});

export const EvidenceSchema = z.object({
  id: z.string(),
  realityId: z.string(),
  kind: z.enum(["observation", "code", "test", "invariant", "decision"]),
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  artefactPath: z.string().optional(),
  provenance: z.enum(["observed", "synthetic", "inherited", "model-reported"]).optional(),
  createdAt: z.string()
});

export const DreamProposalSchema = z.object({
  id: z.string(),
  realityId: z.string(),
  title: z.string(),
  premise: z.string(),
  uncertainty: z.string(),
  rationale: z.string(),
  impactProbability: z.number().min(0).max(1).optional(),
  expectedInsight: z.string().optional(),
  estimatedTokens: z.number().int().nonnegative().optional(),
  costClass: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["open", "dreaming", "resolved"])
});

export const InvestigationEvidenceSchema = z.object({
  kind: z.enum(["observation", "code", "test", "invariant", "decision"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  source: z.string().min(1),
  artefactPath: z.string().nullable(),
  synthetic: z.boolean()
});

export const SubjectReportSchema = z.object({
  subjectId: z.string(),
  name: z.string().min(1),
  role: z.string().min(1),
  findings: z.array(z.string().min(1)),
  artefactPaths: z.array(z.string())
});

export const InvestigationBeliefChangeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceTitles: z.array(z.string())
});

export const AdversarialFaultClassSchema = z.enum([
  "boundary-condition",
  "dependency-failure",
  "concurrency",
  "state-corruption",
  "permission",
  "performance"
]);

export const AdversarialDiagnosisSchema = z.object({
  rootCause: z.string().min(1).max(1_000),
  faultClass: AdversarialFaultClassSchema,
  suspectedChangedFiles: z.array(z.string().min(1).max(500)).max(20),
  evidenceTitles: z.array(z.string().min(1).max(240)).max(20),
  confidence: z.number().min(0).max(1),
  remainingUncertainty: z.array(z.string().min(1).max(500)).max(20)
});

export const DreamProposalDraftSchema = z.object({
  title: z.string().min(1),
  premise: z.string().min(1),
  uncertainty: z.string().min(1),
  rationale: z.string().min(1),
  impactProbability: z.number().min(0).max(1),
  expectedInsight: z.string().min(1),
  estimatedTokens: z.number().int().nonnegative(),
  costClass: z.enum(["low", "medium", "high"])
});

export const InvestigationReportSchema = z.object({
  realityId: z.string(),
  summary: z.string().min(1),
  evidence: z.array(InvestigationEvidenceSchema),
  subjectReports: z.array(SubjectReportSchema),
  changedBeliefs: z.array(InvestigationBeliefChangeSchema),
  dreamProposal: DreamProposalDraftSchema.nullable(),
  adversarialDiagnosis: AdversarialDiagnosisSchema.nullable().optional(),
  remainingUncertainty: z.array(z.string()),
  changedFiles: z.array(z.string()),
  generatedAt: z.string()
});

export const WakeArtefactSchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(["test", "patch", "note", "log"]),
  summary: z.string(),
  content: z.string().nullable().optional().transform((value) => value ?? undefined)
});

export const WakeBeliefChangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string())
});

export const WakeReportSchema = z.object({
  realityId: z.string(),
  initialBeliefs: z.array(z.object({
    statement: z.string(),
    confidence: z.number().min(0).max(1)
  })),
  experiences: z.array(z.string()),
  changedBeliefs: z.array(WakeBeliefChangeSchema),
  invariants: z.array(z.string()),
  artefacts: z.array(WakeArtefactSchema),
  remainingUncertainty: z.array(z.string()),
  recommendation: z.string(),
  generatedAt: z.string()
});

export const SynthesisReportSchema = z.object({
  realityId: z.string(),
  summary: z.string().min(1),
  appliedMemories: z.array(z.string()),
  changedFiles: z.array(z.string()),
  retainedArtefacts: z.array(z.string()),
  unresolved: z.array(z.string()),
  generatedAt: z.string()
});

export const RealityAnchorSchema = z.object({
  id: z.string(),
  realityId: z.string(),
  ownerRealityId: z.string(),
  name: z.string(),
  description: z.string(),
  testCommand: z.string(),
  immutable: z.literal(true),
  hidden: z.boolean(),
  status: z.enum(["pending", "passed", "failed"]),
  output: z.string().optional()
});

export const RealityEventTypeSchema = z.enum([
  "reality.created",
  "codex.thread.bound",
  "codex.progress",
  "inspection.completed",
  "uncertainty.discovered",
  "dream.created",
  "subject.entered",
  "subject.started",
  "subject.completed",
  "subject.failed",
  "subject.returned",
  "intervention.armed",
  "intervention.started",
  "intervention.sealed",
  "intervention.rejected",
  "intervention.revealed",
  "evidence.discovered",
  "belief.changed",
  "kick.triggered",
  "memory.returned",
  "memory.quarantined",
  "memory.verified",
  "artefact.returned",
  "synthesis.completed",
  "verification.started",
  "verification.passed",
  "verification.failed",
  "anchor.started",
  "anchor.passed",
  "anchor.failed",
  "reality.fractured",
  "reality.recovered",
  "reality.stabilised",
  "validation.rejected"
]);

export const RealityEventSchema = z.object({
  id: z.string(),
  realityId: z.string(),
  type: RealityEventTypeSchema,
  summary: z.string(),
  dreamTime: z.number().int().nonnegative(),
  payload: z.record(z.unknown()),
  occurredAt: z.string()
});

export const RealitySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  depth: z.number().int().nonnegative(),
  kind: RealityKindSchema,
  name: z.string(),
  status: RealityStatusSchema,
  premise: z.string(),
  constitution: RealityConstitutionSchema,
  worldState: WorldStateSchema,
  subjects: z.array(SubjectSchema),
  beliefs: z.array(BeliefSchema),
  evidence: z.array(EvidenceSchema),
  proposals: z.array(DreamProposalSchema),
  anchors: z.array(RealityAnchorSchema),
  wakeReport: WakeReportSchema.optional(),
  codexThreadId: z.string().optional(),
  worktreePath: z.string().optional(),
  branchName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const AnchorResultSchema = z.object({
  anchorId: z.string(),
  name: z.string(),
  status: z.enum(["passed", "failed"]),
  output: z.string(),
  command: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional()
});

export const RegressionResultSchema = z.object({
  status: z.enum(["passed", "failed"]),
  output: z.string(),
  command: z.string(),
  durationMs: z.number().int().nonnegative(),
  testFiles: z.array(z.string())
});

export const MemoryIntegrityCheckSchema = z.object({
  name: z.enum([
    "schema",
    "identity",
    "report-digest",
    "source-state",
    "anchor-fingerprint",
    "evidence-lineage",
    "artefact-resolution",
    "descendant-lineage",
    "intervention-diagnosis"
  ]),
  status: z.enum(["passed", "failed"]),
  summary: z.string().min(1).max(500)
});

const MemoryIntegrityPolicyV2Checks = [
  "schema",
  "identity",
  "report-digest",
  "source-state",
  "anchor-fingerprint",
  "evidence-lineage",
  "artefact-resolution",
  "descendant-lineage",
  "intervention-diagnosis"
] as const;

export const MemoryIntegritySealSchema = z.object({
  id: z.string(),
  realityId: z.string(),
  parentRealityId: z.string(),
  reportDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceStateDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceCommit: z.string().min(7).max(64),
  anchorFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  parentAnchorFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  descendantSealIds: z.array(z.string()),
  descendantRealityIds: z.array(z.string()),
  checks: z.array(MemoryIntegrityCheckSchema).min(7),
  verdict: z.enum(["verified", "quarantined"]),
  policyVersion: z.enum(["memory-integrity/v1", "memory-integrity/v2"]),
  sealedAt: z.string()
}).superRefine((seal, context) => {
  if (seal.policyVersion !== "memory-integrity/v2") return;
  const names = new Set(seal.checks.map((check) => check.name));
  for (const name of MemoryIntegrityPolicyV2Checks) {
    if (names.has(name)) continue;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checks"],
      message: `memory-integrity/v2 requires the ${name} check`
    });
  }
});

export const DemoSessionSchema = z.object({
  id: z.literal("singleton"),
  phase: z.number().int().nonnegative(),
  activeRealityId: z.string().nullable(),
  finalDiff: z.string(),
  anchorResults: z.array(AnchorResultSchema),
  regressionResult: RegressionResultSchema.optional(),
  memoryIntegrity: z.array(MemoryIntegritySealSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const RealityRunArchiveSchema = z.object({
  id: z.string(),
  session: DemoSessionSchema,
  realities: z.array(RealitySchema),
  events: z.array(RealityEventSchema),
  archivedAt: z.string()
});

export const MissionProofSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  executable: z.string().min(1).max(240),
  args: z.array(z.string().max(500)).max(30)
});

export const MissionSubjectCharterSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  mission: z.string().min(1).max(500)
});

export const MissionInterventionContractSchema = z.object({
  id: z.string(),
  enabled: z.literal(true),
  subject: MissionSubjectCharterSchema,
  hypothesis: z.string().min(1).max(1_000),
  faultClasses: z.array(AdversarialFaultClassSchema).min(1).max(3),
  allowedPaths: z.array(z.string().min(1).max(500)).min(1).max(30),
  protectedPaths: z.array(z.string().min(1).max(500)).max(30),
  maxChangedFiles: z.number().int().min(1).max(20),
  maxPatchLines: z.number().int().min(1).max(2_000),
  tokenBudget: z.number().int().min(1_000).max(500_000),
  maxMinutes: z.number().int().min(1).max(60),
  targetDepth: z.number().int().min(1).max(5),
  revealPolicy: z.literal("after-diagnosis"),
  requireRollbackCommit: z.literal(true)
});

export const MissionDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  repositoryPath: z.string().min(1).max(1_000),
  mission: z.string().min(1).max(2_000),
  scope: z.string().min(1).max(240),
  premise: z.string().min(1).max(2_000),
  constraints: z.array(z.string().min(1).max(500)).min(1).max(20),
  parentTruths: z.array(z.string().min(1).max(500)).max(20),
  wakeContract: z.array(z.string().min(1).max(500)).min(1).max(20),
  proofs: z.array(MissionProofSchema).min(1).max(20),
  subjects: z.array(MissionSubjectCharterSchema).max(6),
  intervention: MissionInterventionContractSchema.optional(),
  tokenBudget: z.number().int().positive().max(10_000_000),
  maxDreamDepth: z.number().int().min(1).max(5),
  createdAt: z.string()
});

export const MissionDefinitionDraftSchema = MissionDefinitionSchema.omit({
  id: true,
  createdAt: true
}).extend({
  proofs: z.array(MissionProofSchema.omit({ id: true })).min(1).max(20),
  subjects: z.array(MissionSubjectCharterSchema.omit({ id: true })).max(6),
  intervention: MissionInterventionContractSchema
    .omit({ id: true, subject: true })
    .extend({
      subject: MissionSubjectCharterSchema.omit({ id: true })
    })
    .optional()
});

export const AdversarialInterventionReportSchema = z.object({
  contractId: z.string(),
  realityId: z.string(),
  subjectId: z.string(),
  faultClass: AdversarialFaultClassSchema,
  summary: z.string().min(1).max(2_000),
  changedFiles: z.array(z.string().min(1).max(500)).min(1).max(20),
  expectedSymptoms: z.array(z.string().min(1).max(500)).min(1).max(20),
  generatedAt: z.string()
});

export const AdversarialInterventionAssessmentSchema = z.object({
  outcome: z.enum(["detected", "partial", "missed"]),
  faultClassMatched: z.boolean(),
  identifiedFiles: z.array(z.string().min(1).max(500)).max(20),
  missedFiles: z.array(z.string().min(1).max(500)).max(20),
  evidenceTitles: z.array(z.string().min(1).max(240)).max(20),
  assessedAt: z.string()
});

export const AdversarialInterventionLedgerSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  realityId: z.string(),
  status: z.enum(["armed", "injecting", "sealed", "revealed", "rejected"]),
  armedAt: z.string(),
  startedAt: z.string().optional(),
  sealedAt: z.string().optional(),
  revealedAt: z.string().optional(),
  baselineCommit: z.string().optional(),
  interventionCommit: z.string().optional(),
  subjectThreadId: z.string().optional(),
  changedFileCount: z.number().int().nonnegative().optional(),
  patchLineCount: z.number().int().nonnegative().optional(),
  report: AdversarialInterventionReportSchema.optional(),
  diagnosis: AdversarialDiagnosisSchema.optional(),
  assessment: AdversarialInterventionAssessmentSchema.optional(),
  rejectionReason: z.string().max(500).optional()
});

export const MissionRunSchema = z.object({
  id: z.string(),
  definition: MissionDefinitionSchema,
  status: z.enum(["forming", "exploring", "verifying", "stabilised", "fractured"]),
  realities: z.array(RealitySchema),
  events: z.array(RealityEventSchema),
  activeRealityId: z.string(),
  memories: z.array(WakeReportSchema),
  interventions: z.array(AdversarialInterventionLedgerSchema).default([]),
  memoryIntegrity: z.array(MemoryIntegritySealSchema).default([]),
  proofResults: z.array(AnchorResultSchema),
  finalDiff: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type RealityStatus = z.infer<typeof RealityStatusSchema>;
export type RealityKind = z.infer<typeof RealityKindSchema>;
export type RealityConstitution = z.infer<typeof RealityConstitutionSchema>;
export type WorldState = z.infer<typeof WorldStateSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type Belief = z.infer<typeof BeliefSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type DreamProposal = z.infer<typeof DreamProposalSchema>;
export type InvestigationEvidence = z.infer<typeof InvestigationEvidenceSchema>;
export type SubjectReport = z.infer<typeof SubjectReportSchema>;
export type InvestigationBeliefChange = z.infer<typeof InvestigationBeliefChangeSchema>;
export type AdversarialFaultClass = z.infer<typeof AdversarialFaultClassSchema>;
export type AdversarialDiagnosis = z.infer<typeof AdversarialDiagnosisSchema>;
export type DreamProposalDraft = z.infer<typeof DreamProposalDraftSchema>;
export type InvestigationReport = z.infer<typeof InvestigationReportSchema>;
export type WakeReport = z.infer<typeof WakeReportSchema>;
export type WakeArtefact = z.infer<typeof WakeArtefactSchema>;
export type SynthesisReport = z.infer<typeof SynthesisReportSchema>;
export type RealityAnchor = z.infer<typeof RealityAnchorSchema>;
export type RealityEvent = z.infer<typeof RealityEventSchema>;
export type RealityEventType = z.infer<typeof RealityEventTypeSchema>;
export type Reality = z.infer<typeof RealitySchema>;
export type AnchorResult = z.infer<typeof AnchorResultSchema>;
export type RegressionResult = z.infer<typeof RegressionResultSchema>;
export type DemoSession = z.infer<typeof DemoSessionSchema>;
export type RealityRunArchive = z.infer<typeof RealityRunArchiveSchema>;
export type MissionProof = z.infer<typeof MissionProofSchema>;
export type MissionSubjectCharter = z.infer<typeof MissionSubjectCharterSchema>;
export type MissionInterventionContract = z.infer<typeof MissionInterventionContractSchema>;
export type MissionDefinition = z.infer<typeof MissionDefinitionSchema>;
export type MissionDefinitionDraft = z.infer<typeof MissionDefinitionDraftSchema>;
export type AdversarialInterventionReport = z.infer<typeof AdversarialInterventionReportSchema>;
export type AdversarialInterventionAssessment = z.infer<typeof AdversarialInterventionAssessmentSchema>;
export type AdversarialInterventionLedger = z.infer<typeof AdversarialInterventionLedgerSchema>;
export type MemoryIntegrityCheck = z.infer<typeof MemoryIntegrityCheckSchema>;
export type MemoryIntegritySeal = z.infer<typeof MemoryIntegritySealSchema>;
export type MissionRun = z.infer<typeof MissionRunSchema>;
