import { getRuntime, presentSnapshot } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  try {
    const snapshot = presentSnapshot(await getRuntime().orchestrator.snapshot());
    const download = new URL(request.url).searchParams.get("download") === "1";
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
        ...(download ? {
          "Content-Disposition": "attachment; filename=\"inception-mission-password-reset.json\""
        } : {})
      }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load the password-reset Mission." },
      { status: 500 }
    );
  }
}
