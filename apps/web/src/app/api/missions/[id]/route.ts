import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const container = getRuntime();
    const body = {
      snapshot: await container.missionOrchestrator.snapshot(id),
      runtime: container.codexRuntime.info()
    };
    const download = new URL(request.url).searchParams.get("download") === "1";
    return Response.json(body, {
      headers: {
        "Cache-Control": "no-store",
        ...(download ? {
          "Content-Disposition": `attachment; filename="inception-mission-${id.replace(/[^a-z0-9-]/gi, "-")}.json"`
        } : {})
      }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load the mission." },
      { status: 404 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const removedWorktrees = await getRuntime().missionOrchestrator.delete(id);
    return Response.json({ deleted: true, removedWorktrees }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not delete the mission." },
      { status: 409 }
    );
  }
}
