export interface GitHubUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  accessToken?: string;
  createdAt: Date;
}

export interface Repository {
  id: string;
  userId: string;
  githubId: string;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  cloneUrl: string;
  defaultBranch: string;
  isCloned: boolean;
  localPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceFile {
  id: string;
  repositoryId: string | null;
  path: string;
  content: string | null;
  language: string | null;
  isModified: boolean;
  isTracked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitStatus {
  modified: string[];
  not_added: string[];
  conflicted: string[];
  created: string[];
  deleted: string[];
  renamed: string[];
  staged: string[];
}

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
}

export interface AICodeOperation {
  type: "refactor" | "add_feature" | "fix_bugs" | "write_docs" | "analyze";
  files: string[];
  description: string;
  repository?: string;
}

export interface AICodeResult {
  success: boolean;
  changes: FileChange[];
  summary: string;
  error?: string;
}

export interface FileChange {
  path: string;
  content: string;
  isNew: boolean;
  language?: string;
}