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
  isPresent(worktreePath?: string): Promise<boolean>;
  writeFile(worktreePath: string, relativePath: string, content: string): Promise<void>;
  readFile(worktreePath: string, relativePath: string): Promise<string>;
  listChangedFiles(worktreePath: string): Promise<string[]>;
  diff(worktreePath: string, pathspec?: string): Promise<string>;
  checkpoint(worktreePath: string, message: string): Promise<string>;
  currentCommit(worktreePath: string): Promise<string>;
  isClean(worktreePath: string): Promise<boolean>;
  sealChanges(worktreePath: string, paths: string[], message: string, baselineRef: string): Promise<string>;
  restoreCheckpoint(worktreePath: string, ref: string): Promise<void>;
  run(worktreePath: string, command: string, args: string[]): Promise<WorktreeRunResult>;
}

export interface MissionWorkspace {
  repoRoot: string;
  worktrees: WorktreeManagerPort;
}

export interface MissionWorkspaceFactoryPort {
  open(repositoryPath: string, missionId: string): Promise<MissionWorkspace>;
}
