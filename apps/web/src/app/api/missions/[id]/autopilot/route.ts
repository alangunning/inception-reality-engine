import { z } from "zod";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AutopilotCommandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("start"),
    options: z.object({
      maxActions: z.number().int().min(1).max(100).optional(),
      maxMinutes: z.number().int().min(1).max(180).optional(),
      pauseOnDream: z.boolean().optional(),
      pauseOnIntervention: z.boolean().optional()
    }).optional()
  }),
  z.object({ command: z.literal("resume") }),
  z.object({ command: z.literal("pause") }),
  z.object({ command: z.literal("stop") })
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const [{ id }, command] = await Promise.all([
      context.params,
      request.json().then((body) => AutopilotCommandSchema.parse(body))
    ]);
    const snapshot = await getRuntime().missionOrchestrator.controlAutopilot(id, command);
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Could not control auto mode."
    }, { status: 409 });
  }
}
