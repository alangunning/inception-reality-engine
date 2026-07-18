import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

export const CodexProcessSchema = z.object({
  pid: z.number().int().positive(),
  parentPid: z.number().int().nonnegative(),
  elapsed: z.string().min(1).max(40),
  workingDirectory: z.string().min(1).max(500).optional()
}).strict();

export const CodexProcessListSchema = z.array(CodexProcessSchema);

export const CodexStopResultSchema = z.object({
  attempted: z.number().int().nonnegative(),
  stopped: z.number().int().nonnegative(),
  remaining: CodexProcessListSchema
}).strict();

export type CodexProcess = z.infer<typeof CodexProcessSchema>;
export type CodexStopResult = z.infer<typeof CodexStopResultSchema>;

interface SystemProcess {
  pid: number;
  parentPid: number;
  elapsed: string;
  command: string;
}

function workingDirectory(command: string): string | undefined {
  const match = command.match(/(?:^|\s)--cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function isCodexExecution(command: string): boolean {
  return /(?:^|[/\\])codex(?:\.exe)?\s+exec(?:\s|$)/i.test(command);
}

function parsePosixProcesses(output: string): SystemProcess[] {
  return output.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);
    if (!match) return [];
    return [{
      pid: Number(match[1]),
      parentPid: Number(match[2]),
      elapsed: match[3]!,
      command: match[4]!
    }];
  });
}

async function systemProcesses(): Promise<SystemProcess[]> {
  if (process.platform === "win32") {
    const script = [
      "Get-CimInstance Win32_Process",
      "Select-Object ProcessId,ParentProcessId,CommandLine",
      "ConvertTo-Json -Compress"
    ].join(" | ");
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
      maxBuffer: 5_000_000
    });
    const parsed = JSON.parse(stdout || "[]") as Array<{
      ProcessId?: number;
      ParentProcessId?: number;
      CommandLine?: string;
    }> | {
      ProcessId?: number;
      ParentProcessId?: number;
      CommandLine?: string;
    };
    return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((entry) => {
      if (!entry.ProcessId || !entry.CommandLine) return [];
      return [{
        pid: entry.ProcessId,
        parentPid: entry.ParentProcessId ?? 0,
        elapsed: "active",
        command: entry.CommandLine
      }];
    });
  }

  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,ppid=,etime=,command="], {
    maxBuffer: 5_000_000
  });
  return parsePosixProcesses(stdout);
}

function publicProcesses(processes: SystemProcess[]): CodexProcess[] {
  return CodexProcessListSchema.parse(
    processes
      .filter((entry) => isCodexExecution(entry.command))
      .map((entry) => ({
        pid: entry.pid,
        parentPid: entry.parentPid,
        elapsed: entry.elapsed,
        workingDirectory: workingDirectory(entry.command)
      }))
  );
}

function descendantPids(processes: SystemProcess[], rootPids: Set<number>): number[] {
  const descendants = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of processes) {
      if ((rootPids.has(entry.parentPid) || descendants.has(entry.parentPid)) && !descendants.has(entry.pid)) {
        descendants.add(entry.pid);
        changed = true;
      }
    }
  }
  return [...descendants];
}

function signal(pid: number, signalName: NodeJS.Signals): void {
  try {
    process.kill(pid, signalName);
  } catch {
    // The process may have returned between listing and signalling.
  }
}

export class CodexProcessControl {
  async list(): Promise<CodexProcess[]> {
    return publicProcesses(await systemProcesses());
  }

  async stopAll(): Promise<CodexStopResult> {
    const processes = await systemProcesses();
    const codex = publicProcesses(processes);
    const rootPids = new Set(codex.map((entry) => entry.pid));
    const descendants = descendantPids(processes, rootPids);

    for (const pid of descendants.reverse()) signal(pid, "SIGTERM");
    for (const pid of rootPids) signal(pid, "SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 500));

    for (const pid of descendants) signal(pid, "SIGKILL");
    for (const pid of rootPids) signal(pid, "SIGKILL");
    if (codex.length) await new Promise((resolve) => setTimeout(resolve, 250));

    const finalRemaining = await this.list();
    const remainingPids = new Set(finalRemaining.map((entry) => entry.pid));
    return CodexStopResultSchema.parse({
      attempted: codex.length,
      stopped: codex.filter((entry) => !remainingPids.has(entry.pid)).length,
      remaining: finalRemaining
    });
  }
}
