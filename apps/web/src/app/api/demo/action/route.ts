import { z } from "zod";
import { getRuntime, presentSnapshot } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ActionSchema = z.object({
  action: z.enum([
    "inspect",
    "create_attack_dream",
    "enter_subjects",
    "discover_abuse",
    "create_nested_dream",
    "wake_nested",
    "wake_parent",
    "synthesise",
    "run_anchors",
    "stabilise"
  ])
});

export async function POST(request: Request): Promise<Response> {
  try {
    const { action } = ActionSchema.parse(await request.json());
    const snapshot = await getRuntime().orchestrator.act(action);
    return Response.json(presentSnapshot(snapshot), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
