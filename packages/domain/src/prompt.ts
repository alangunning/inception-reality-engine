import type { Reality } from "./schemas";

export function buildDreamPrompt(reality: Reality): string {
  const history = reality.evidence.length
    ? reality.evidence.map((entry) => `- [${entry.kind}] ${entry.title}: ${entry.summary}`).join("\n")
    : "- No evidence has been recorded yet.";
  const beliefs = reality.beliefs.length
    ? reality.beliefs.map((entry) => `- ${entry.statement} (confidence ${entry.confidence})`).join("\n")
    : "- No explicit beliefs yet.";
  const anchors = reality.anchors.length
    ? reality.anchors.map((entry) => `- IMMUTABLE, OWNER ${entry.ownerRealityId}: ${entry.name} — ${entry.description}`).join("\n")
    : "- No explicit anchors.";
  const runtimeLaws = reality.constitution.runtimeLaws?.length
    ? reality.constitution.runtimeLaws.map((item) => `- ${item}`).join("\n")
    : "- No additional world-specific runtime laws.";
  const safetyBoundary = reality.constitution.safetyProfile === "authorized-local-defensive-review"
    ? `AUTHORIZED LOCAL DEFENSIVE MAINTENANCE BOUNDARY
- The operator supplied this local Git repository and authorized defensive source review, local testing, remediation, and regression prevention.
- Work only with repository source and synthetic local test data. Do not contact a running service, external target, account, credential, or network system.
- The outcome is defensive: identify, prevent, or remediate the bounded defect. Do not add unnecessary exploitation detail.
- This authorization boundary is immutable in every child Reality and Subject thread.

`
    : "";

  return `${safetyBoundary}You are operating inside the Reality \"${reality.name}\".
Reality ID: ${reality.id}

PREMISE
${reality.premise}

CONSTITUTION
Mission: ${reality.constitution.mission}
Constraints:
${reality.constitution.constraints.map((item) => `- ${item}`).join("\n")}
Parent truths:
${reality.constitution.parentTruths.map((item) => `- ${item}`).join("\n")}
Time dilation: ${reality.constitution.timeDilation ?? 1}x waking time
World-specific runtime laws:
${runtimeLaws}
Memory admission policy: ${reality.constitution.memoryPolicy ?? "verified-reports-and-artefacts"}
Dream strategy: ${reality.constitution.dreamStrategy ?? "single-chain"} with at most ${reality.constitution.maxSiblingDreams ?? 1} sibling world(s)

WORLD HISTORY AND EVIDENCE
World status: ${reality.worldState.status}
Current focus: ${reality.worldState.currentFocus}
World summary: ${reality.worldState.summary}
Implementation state: ${reality.worldState.implementationState}
Simulated time: ${reality.worldState.simulatedMinutes} minutes

${history}

CURRENT BELIEFS
${beliefs}

REALITY ANCHORS
${anchors}

OPERATING CONTRACT
- Work only inside this Reality's Git worktree.
- Read .inception/reality/REALITY.md, .inception/reality/AGENTS.override.md, and .inception/anchors/manifest.json before acting.
- Treat anchors as immutable parent-owned requirements.
- Request Subjects only for bounded, independent investigations.
- You may propose a child Dream, but you must never create one yourself.
- Label simulated or hypothetical observations as synthetic evidence.
- Never return hidden reasoning. Return concise observations, evidence, artefacts, decisions, and belief changes.

WAKE CONTRACT
${reality.constitution.wakeContract.map((item) => `- ${item}`).join("\n")}
When kicked, return only JSON matching the supplied WakeReport schema and set realityId exactly to "${reality.id}".`;
}
