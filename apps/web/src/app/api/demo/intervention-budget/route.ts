import { z } from "zod";
import { getRuntime, presentSnapshot } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DemoInterventionBudgetApprovalSchema = z.object({
  tokenBudget: z.number().int().min(1_000).max(500_000),
  retry: z.boolean().optional()
});

export async function POST(request: Request): Promise<Response> {
  try {
    const approval = DemoInterventionBudgetApprovalSchema.parse(await request.json());
    const snapshot = await getRuntime().orchestrator.approveInterventionBudget(approval);
    return Response.json(presentSnapshot(snapshot), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({
      error: error instanceof z.ZodError
        ? "Choose a whole-number token ceiling between 1,000 and 500,000."
        : error instanceof Error
          ? error.message
          : "Could not approve the Demo intervention budget."
    }, { status: 409 });
  }
}
