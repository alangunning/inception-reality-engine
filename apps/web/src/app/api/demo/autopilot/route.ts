import { z } from "zod";
import { getRuntime, presentSnapshot } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DemoAutopilotCommandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("start"),
    paceMilliseconds: z.number().int().min(250).max(10_000).optional()
  }),
  z.object({ command: z.literal("resume") }),
  z.object({ command: z.literal("pause") }),
  z.object({ command: z.literal("stop") })
]);

export async function POST(request: Request): Promise<Response> {
  try {
    const command = DemoAutopilotCommandSchema.parse(await request.json());
    const snapshot = await getRuntime().orchestrator.controlAutopilot(command);
    return Response.json(presentSnapshot(snapshot), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Could not control Demo auto mode."
    }, { status: 409 });
  }
}
