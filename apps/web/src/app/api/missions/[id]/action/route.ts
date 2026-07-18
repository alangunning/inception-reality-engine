import { z } from "zod";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MissionActionSchema = z.object({
  action: z.enum([
    "inspect",
    "create_dream",
    "kick",
    "synthesise",
    "verify",
    "repair",
    "stabilise"
  ])
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const [{ id }, { action }] = await Promise.all([
      context.params,
      request.json().then((value) => MissionActionSchema.parse(value))
    ]);
    const snapshot = await getRuntime().missionOrchestrator.act(id, action);
    return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Mission action failed." },
      { status: 400 }
    );
  }
}
