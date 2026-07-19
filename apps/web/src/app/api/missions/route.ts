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
    const runs = await container.missionOrchestrator.list();
    return Response.json({
      runs: runs.map((run) => ({
        id: run.id,
        name: run.definition.name,
        scope: run.definition.scope,
        status: run.status,
        realityCount: run.realities.length,
        updatedAt: run.updatedAt
      })),
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
