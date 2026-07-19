import { z } from "zod";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  before: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const [{ id }, query] = await Promise.all([
      context.params,
      Promise.resolve(QuerySchema.parse(
        Object.fromEntries(new URL(request.url).searchParams)
      ))
    ]);
    const events = await getRuntime().missionOrchestrator.events(
      id,
      query.limit,
      query.before
    );
    return Response.json({
      events,
      nextCursor: events.length === query.limit
        ? events[0]
          ? `${events[0].occurredAt}|${events[0].id}`
          : null
        : null
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Could not load Mission events."
    }, { status: 400 });
  }
}
