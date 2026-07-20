import { z } from "zod";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MissionLimitApprovalSchema = z.object({
  tokenBudget: z.number().int().min(1_000).max(30_000_000),
  maxActions: z.number().int().min(1).max(100),
  maxMinutes: z.number().int().min(1).max(180)
}).strict();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const [{ id }, approval] = await Promise.all([
      context.params,
      request.json().then((body) => MissionLimitApprovalSchema.parse(body))
    ]);
    const snapshot = await getRuntime().missionOrchestrator.approveLimits(id, approval);
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({
      error: error instanceof z.ZodError || error instanceof SyntaxError
        ? "Choose whole-number Mission limits: tokens from 1,000 to 30,000,000, actions from 1 to 100, and active minutes from 1 to 180."
        : error instanceof Error
          ? error.message
          : "Could not approve Mission limits."
    }, { status: 409 });
  }
}
