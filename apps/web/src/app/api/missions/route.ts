import { MissionDefinitionDraftSchema } from "@inception/domain";
import type { ZodIssue } from "zod";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const fieldLabels: Record<string, string> = {
  name: "Reality name",
  repositoryPath: "local Git repository",
  mission: "mission",
  scope: "scope",
  premise: "initial belief",
  constraints: "constitution constraints",
  proofs: "immutable proof",
  subjects: "Subject charters",
  tokenBudget: "observed SDK token ceiling",
  maxDreamDepth: "Dream depth"
};

function validationError(issues: ZodIssue[]): string {
  const fields = [...new Set(issues.map((issue) => {
    const field = String(issue.path[0] ?? "mission definition");
    return fieldLabels[field] ?? field;
  }))];
  return `Complete or correct the following Mission fields: ${fields.join(", ")}.`;
}

export async function GET(): Promise<Response> {
  try {
    const container = getRuntime();
    const [runs, passwordReset] = await Promise.all([
      container.missionOrchestrator.list(),
      container.orchestrator.snapshot()
    ]);
    const rootReality = passwordReset.realities.find((reality) => reality.depth === 0);
    const savedRuns = runs.map((run) => ({
      id: run.id,
      kind: "saved" as const,
      name: run.definition.name,
      scope: run.definition.scope,
      status: run.status,
      realityCount: run.realities.length,
      updatedAt: run.updatedAt,
      href: `/missions/${encodeURIComponent(run.id)}`,
      resetHref: `/api/missions/${encodeURIComponent(run.id)}/reset`,
      exportHref: `/api/missions/${encodeURIComponent(run.id)}?download=1`,
      canReset: true,
      canDelete: true
    }));
    return Response.json({
      runs: savedRuns,
      library: [{
        id: "password-reset",
        kind: "demo" as const,
        name: "Password Reset Under Coordinated Attack",
        scope: "Password-reset abuse resistance and privacy",
        status: rootReality?.status ?? "forming",
        realityCount: passwordReset.realities.length,
        updatedAt: passwordReset.session.updatedAt,
        href: "/missions/password-reset",
        resetHref: "/api/missions/password-reset/reset",
        exportHref: "/api/missions/password-reset?download=1",
        canReset: true,
        canDelete: false
      }, ...savedRuns],
      runtime: container.codexRuntime.info(),
      enabled: container.codexMode === "real",
      defaultRepositoryPath: process.env.INCEPTION_REPO_ROOT ?? process.cwd()
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not list missions." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = MissionDefinitionDraftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({
        error: validationError(parsed.error.issues),
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code
        }))
      }, { status: 400 });
    }
    const snapshot = await getRuntime().missionOrchestrator.create(parsed.data);
    return Response.json(snapshot, {
      status: 201,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create the mission." },
      { status: 400 }
    );
  }
}

export async function DELETE(): Promise<Response> {
  try {
    const result = await getRuntime().missionOrchestrator.deleteAll();
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not delete saved missions." },
      { status: 409 }
    );
  }
}
