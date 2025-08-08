import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs/promises";
import * as path from "path";

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

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoName: string) {
    this.repoPath = path.join(WORKSPACE_DIR, repoName);
    this.git = simpleGit(this.repoPath);
  }

  async ensureWorkspaceDir(): Promise<void> {
    try {
      await fs.access(WORKSPACE_DIR);
    } catch {
      await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    }
  }

  async cloneRepository(cloneUrl: string, accessToken: string): Promise<void> {
    await this.ensureWorkspaceDir();
    
    // Add token to clone URL for authentication
    const authenticatedUrl = cloneUrl.replace(
      "https://github.com/",
      `https://${accessToken}@github.com/`
    );

    await simpleGit(WORKSPACE_DIR).clone(authenticatedUrl, this.repoPath);
  }

  async getStatus(): Promise<GitStatus> {
    const status = await this.git.status();
    return {
      modified: status.modified,
      not_added: status.not_added,
      conflicted: status.conflicted,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed.map(r => typeof r === 'string' ? r : r.from + ' -> ' + r.to),
      staged: status.staged,
    };
  }

  async addFiles(files: string[]): Promise<void> {
    await this.git.add(files);
  }

  async commit(message: string, author?: { name: string; email: string }): Promise<string> {
    if (author) {
      await this.git.addConfig("user.name", author.name);
      await this.git.addConfig("user.email", author.email);
    }
    
    const result = await this.git.commit(message);
    return result.commit;
  }

  async push(branch = "main", accessToken?: string): Promise<void> {
    if (accessToken) {
      // Configure remote with token for authentication
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === "origin");
      if (origin && origin.refs.push) {
        const authenticatedUrl = origin.refs.push.replace(
          "https://github.com/",
          `https://${accessToken}@github.com/`
        );
        await this.git.removeRemote("origin");
        await this.git.addRemote("origin", authenticatedUrl);
      }
    }
    
    await this.git.push("origin", branch);
  }

  async pull(branch = "main"): Promise<void> {
    await this.git.pull("origin", branch);
  }

  async createBranch(branchName: string): Promise<void> {
    await this.git.checkoutLocalBranch(branchName);
  }

  async switchBranch(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  async getBranches(): Promise<string[]> {
    const branches = await this.git.branch();
    return branches.all.filter(branch => !branch.startsWith("remotes/"));
  }

  async getCurrentBranch(): Promise<string> {
    const branches = await this.git.branch();
    return branches.current;
  }

  async getCommitHistory(limit = 10): Promise<CommitInfo[]> {
    const log = await this.git.log({ maxCount: limit });
    return log.all.map(commit => ({
      hash: commit.hash,
      date: commit.date,
      message: commit.message,
      author_name: commit.author_name,
      author_email: commit.author_email,
    }));
  }

  async getDiff(file?: string): Promise<string> {
    if (file) {
      return await this.git.diff([file]);
    }
    return await this.git.diff();
  }

  async readFile(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.repoPath, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      return content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.repoPath, filePath);
    const dirPath = path.dirname(fullPath);
    
    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.repoPath, filePath);
    await fs.unlink(fullPath);
  }

  async listFiles(dirPath = ""): Promise<string[]> {
    const fullPath = path.join(this.repoPath, dirPath);
    try {
      const files = await fs.readdir(fullPath, { recursive: true });
      return files.filter(file => typeof file === "string") as string[];
    } catch (error) {
      console.error(`Error listing files in ${dirPath}:`, error);
      return [];
    }
  }

  getRepoPath(): string {
    return this.repoPath;
  }
}