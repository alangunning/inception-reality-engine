import { z } from "zod";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PrepareTargetSchema = z.object({
  id: z.literal("vampi")
});

export async function GET(): Promise<Response> {
  try {
    return Response.json({
      targets: await getRuntime().trainingTargets.list()
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not inspect training targets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = PrepareTargetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Choose a supported training target." }, { status: 400 });
    }
    const target = await getRuntime().trainingTargets.prepare(parsed.data.id);
    return Response.json({ target }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not prepare the training target." },
      { status: 500 }
    );
  }
}
