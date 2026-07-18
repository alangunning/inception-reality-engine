import type { RealityEvent, RealityRunArchive } from "@inception/domain";
import { getRuntime } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RunLogSummary {
  id: string;
  phase: number;
  startedAt: string;
  archivedAt: string;
  realityCount: number;
  eventCount: number;
  commandCount: number;
  failedCommandCount: number;
  recoveredAfterFailure: boolean;
  failureKinds: Record<string, number>;
}

function metadata(event: RealityEvent): Record<string, unknown> {
  const value = event.payload.metadata;
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function summarise(archive: RealityRunArchive): RunLogSummary {
  const terminalCommands = archive.events.filter((event) => {
    const value = metadata(event);
    return value.stage === "command" && (value.status === "completed" || value.status === "failed");
  });
  const failedCommands = terminalCommands.filter((event) => metadata(event).status === "failed");
  const firstFailureIndex = terminalCommands.findIndex((event) => metadata(event).status === "failed");
  const failureKinds = failedCommands.reduce<Record<string, number>>((counts, event) => {
    const kind = metadata(event).failureKind;
    const key = typeof kind === "string" ? kind : "unclassified";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return {
    id: archive.id,
    phase: archive.session.phase,
    startedAt: archive.session.createdAt,
    archivedAt: archive.archivedAt,
    realityCount: archive.realities.length,
    eventCount: archive.events.length,
    commandCount: terminalCommands.length,
    failedCommandCount: failedCommands.length,
    recoveredAfterFailure: firstFailureIndex >= 0
      && terminalCommands.slice(firstFailureIndex + 1).some((event) => metadata(event).status === "completed"),
    failureKinds
  };
}

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const orchestrator = getRuntime().orchestrator;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const archive = id === "current"
        ? await orchestrator.currentRunLog()
        : await orchestrator.getRunArchive(id);
      if (!archive) return json({ error: "Run log not found." }, 404);
      if (url.searchParams.get("download") === "1") {
        const filename = `inception-run-${id.replace(/[^a-z0-9-]/gi, "-")}.json`;
        return json(archive, 200, {
          "Content-Disposition": `attachment; filename="${filename}"`
        });
      }
      return json({ run: archive, summary: summarise(archive) });
    }

    const [current, archives] = await Promise.all([
      orchestrator.currentRunLog(),
      orchestrator.listRunArchives(20)
    ]);
    return json({
      current: summarise(current),
      archives: archives.map(summarise)
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not load retrospective run logs." },
      500
    );
  }
}
