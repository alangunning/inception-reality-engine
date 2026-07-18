import type { Reality } from "./schemas";

export function buildDreamPrompt(reality: Reality): string {
  const history = reality.evidence.length
    ? reality.evidence.map((entry) => `- [${entry.kind}] ${entry.title}: ${entry.summary}`).join("\n")
    : "- No evidence has been recorded yet.";
  const beliefs = reality.beliefs.length
    ? reality.beliefs.map((entry) => `- ${entry.statement} (confidence ${entry.confidence})`).join("\n")
    : "- No explicit beliefs yet.";
  const anchors = reality.anchors.length
    ? reality.anchors.map((entry) => `- IMMUTABLE: ${entry.name} — ${entry.description}`).join("\n")
    : "- No explicit anchors.";

  return `You are operating inside the Reality \"${reality.name}\".

PREMISE
${reality.premise}

CONSTITUTION
Mission: ${reality.constitution.mission}
Constraints:
${reality.constitution.constraints.map((item) => `- ${item}`).join("\n")}
Parent truths:
${reality.constitution.parentTruths.map((item) => `- ${item}`).join("\n")}

WORLD HISTORY AND EVIDENCE
${history}

CURRENT BELIEFS
${beliefs}

REALITY ANCHORS
${anchors}

OPERATING CONTRACT
- Work only inside this Reality's Git worktree.
- Treat anchors as immutable parent-owned requirements.
- Request Subjects only for bounded, independent investigations.
- Never return hidden reasoning. Return concise observations, evidence, artefacts, decisions, and belief changes.

WAKE CONTRACT
${reality.constitution.wakeContract.map((item) => `- ${item}`).join("\n")}
When kicked, return only JSON matching the supplied WakeReport schema.`;
}
