import { getRuntime, presentSnapshot } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const snapshot = await getRuntime().orchestrator.reset();
    return Response.json(presentSnapshot(snapshot), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not reset the password-reset Mission." },
      { status: 409 }
    );
  }
}
