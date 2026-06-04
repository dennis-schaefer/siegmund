import { Octokit } from "@octokit/rest";

export interface IssueRef {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export interface SubIssue extends IssueRef {
  blockedBy: number[];
}

interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
}

export function readConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  if (!repo) throw new Error("GITHUB_REPO is not set (expected owner/repo)");
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error(`GITHUB_REPO must be in the form owner/repo, got: ${repo}`);
  }
  return { token, owner, repo: name };
}

export function createClient(cfg: GithubConfig): Octokit {
  return new Octokit({ auth: cfg.token });
}

function extractLabels(labels: unknown): string[] {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((l) => (typeof l === "string" ? l : (l as { name?: string }).name))
    .filter((n): n is string => typeof n === "string");
}

export async function fetchPrdIssue(
  client: Octokit,
  cfg: GithubConfig,
  number: number,
): Promise<IssueRef> {
  const { data } = await client.issues.get({
    owner: cfg.owner,
    repo: cfg.repo,
    issue_number: number,
  });
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? "",
    labels: extractLabels(data.labels),
  };
}

function parseBlockedBy(body: string): number[] {
  const match = body.match(/##\s*Blocked by\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!match) return [];
  const section = match[1];
  if (/\bnone\b/i.test(section)) return [];
  const numbers = new Set<number>();
  for (const ref of section.matchAll(/#(\d+)/g)) {
    numbers.add(Number(ref[1]));
  }
  return [...numbers];
}

function isChildOfPrd(body: string, prdNumber: number): boolean {
  const pattern = new RegExp(`##\\s*Parent PRD\\s*\\n\\s*#${prdNumber}\\b`, "i");
  return pattern.test(body);
}

export async function fetchSubIssues(
  client: Octokit,
  cfg: GithubConfig,
  prdNumber: number,
): Promise<SubIssue[]> {
  const all = await client.paginate(client.issues.listForRepo, {
    owner: cfg.owner,
    repo: cfg.repo,
    state: "open",
    per_page: 100,
  });

  const subs: SubIssue[] = [];
  for (const raw of all) {
    if (raw.pull_request) continue;
    if (raw.number === prdNumber) continue;
    const body = raw.body ?? "";
    if (!isChildOfPrd(body, prdNumber)) continue;
    subs.push({
      number: raw.number,
      title: raw.title,
      body,
      labels: extractLabels(raw.labels),
      blockedBy: parseBlockedBy(body),
    });
  }
  return subs;
}
