import type { RealityEvent } from "@inception/domain";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const missionId = new URL(request.url).searchParams.get("missionId");
  if (!missionId) {
    return Response.json({ error: "missionId is required." }, { status: 400 });
  }
  const encoder = new TextEncoder();
  const { missionEventBus } = getRuntime();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "connected", summary: "Mission Reality stream connected." });
      unsubscribe = missionEventBus.subscribe((event: RealityEvent) => {
        if (event.payload.missionId === missionId) send(event);
      });
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": mission heartbeat\n\n"));
      }, 15_000);
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
