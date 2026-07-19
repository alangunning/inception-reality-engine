import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const snapshot = await getRuntime().missionOrchestrator.reset(id);
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not reset the mission." },
      { status: 409 }
    );
  }
}
