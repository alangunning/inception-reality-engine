export interface WorktreeDescriptor {
  path: string;
  branchName: string;
}

export interface WorktreeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface WorktreeManagerPort {
  discoverRepoRoot(startDirectory?: string): Promise<string>;
  create(realityId: string, baseRef?: string, parentWorktreePath?: string): Promise<WorktreeDescriptor>;
  remove(descriptor: WorktreeDescriptor): Promise<void>;
  cleanupAll(): Promise<number>;
  writeFile(worktreePath: string, relativePath: string, content: string): Promise<void>;
  readFile(worktreePath: string, relativePath: string): Promise<string>;
  listChangedFiles(worktreePath: string): Promise<string[]>;
  diff(worktreePath: string, pathspec?: string): Promise<string>;
  run(worktreePath: string, command: string, args: string[]): Promise<WorktreeRunResult>;
}
