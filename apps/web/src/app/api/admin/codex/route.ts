import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const runtimeContainer = getRuntime();
    return Response.json(
      {
        processes: await runtimeContainer.processControl.list(),
        codexMode: runtimeContainer.codexMode
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not inspect Codex processes." },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<Response> {
  try {
    return Response.json(
      await getRuntime().processControl.stopAll(),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not stop Codex processes." },
      { status: 500 }
    );
  }
}
