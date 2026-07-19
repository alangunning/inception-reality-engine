import { z } from "zod";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InterventionBudgetApprovalSchema = z.object({
  tokenBudget: z.number().int().min(1_000).max(500_000),
  retry: z.boolean().optional()
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const [{ id }, approval] = await Promise.all([
      context.params,
      request.json().then((body) => InterventionBudgetApprovalSchema.parse(body))
    ]);
    const snapshot = await getRuntime().missionOrchestrator.approveInterventionBudget(
      id,
      approval
    );
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({
      error: error instanceof z.ZodError
        ? "Choose a whole-number token ceiling between 1,000 and 500,000."
        : error instanceof Error
          ? error.message
          : "Could not approve the intervention budget."
    }, { status: 409 });
  }
}
