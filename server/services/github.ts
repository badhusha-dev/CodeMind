import { Octokit } from "@octokit/rest";
import { OAuthApp } from "@octokit/oauth-app";

export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
  name: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  clone_url: string;
  default_branch: string;
}

const app = new OAuthApp({
  clientId: process.env.GITHUB_CLIENT_ID || "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
});

export async function getGitHubAuthUrl(): Promise<string> {
  const { url } = await app.getWebFlowAuthorizationUrl({
    scopes: ["repo", "user:email"],
    state: "random-state-string",
  });
  return url;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const { authentication } = await app.createToken({
    code,
  });
  return authentication.token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.rest.users.getAuthenticated();
  return data as GitHubUser;
}

export async function getGitHubRepositories(accessToken: string): Promise<GitHubRepository[]> {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });
  return data as GitHubRepository[];
}

export async function createGitHubRepository(
  accessToken: string,
  name: string,
  description?: string,
  isPrivate = false
): Promise<GitHubRepository> {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
  });
  return data as GitHubRepository;
}

export async function getRepositoryContents(
  accessToken: string,
  owner: string,
  repo: string,
  path = ""
): Promise<any[]> {
  const octokit = new Octokit({ auth: accessToken });
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error(`Error fetching repository contents:`, error);
    return [];
  }
}

export async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  const octokit = new Octokit({ auth: accessToken });
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });
    
    if ("content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (error) {
    console.error(`Error fetching file content:`, error);
    return null;
  }
}