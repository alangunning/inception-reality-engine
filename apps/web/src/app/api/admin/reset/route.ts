import { getRuntime, presentSnapshot } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(): Promise<Response> {
  try {
    const runtimeContainer = getRuntime();
    const abortedSdkOperations = runtimeContainer.codexRuntime.abortAll();
    const stopped = await runtimeContainer.processControl.stopAll();

    let active = (await runtimeContainer.orchestrator.snapshot()).operation;
    for (let attempt = 0; active && attempt < 50; attempt += 1) {
      await wait(100);
      active = (await runtimeContainer.orchestrator.snapshot()).operation;
    }
    if (active) {
      return Response.json(
        { error: `The operation "${active.label}" has not stopped yet.` },
        { status: 409 }
      );
    }

    const snapshot = await runtimeContainer.orchestrator.reset();
    return Response.json(
      {
        stopped,
        abortedSdkOperations,
        snapshot: presentSnapshot(snapshot)
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not fully reset the Reality Engine." },
      { status: 500 }
    );
  }
}
