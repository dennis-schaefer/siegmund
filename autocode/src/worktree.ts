import { spawnSync } from "node:child_process";

const REPO_PATH = "/repo";
const WORKTREE_PATH = "/workspace";

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    code: result.status ?? -1,
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function branchName(prdNumber: number, prdTitle: string): string {
  return `feat/${prdNumber}-${slugify(prdTitle)}`;
}

export function createWorktree(branch: string): void {
  // Make sure the worktree path is free.
  cleanupWorktree();

  // Ensure base branch (main) exists locally so the new branch can fork from it.
  const baseRef = "main";
  const args = [
    "-C",
    REPO_PATH,
    "worktree",
    "add",
    "-b",
    branch,
    WORKTREE_PATH,
    baseRef,
  ];
  const result = run(args);
  if (result.code !== 0) {
    // If the branch already exists, try checking it out instead.
    const existing = run([
      "-C",
      REPO_PATH,
      "worktree",
      "add",
      WORKTREE_PATH,
      branch,
    ]);
    if (existing.code !== 0) {
      throw new Error(
        `Failed to create worktree on ${branch}: ${result.stderr || existing.stderr}`,
      );
    }
  }
}

export function cleanupWorktree(): void {
  // `worktree remove` requires the worktree to be listed; ignore failures.
  run(["-C", REPO_PATH, "worktree", "remove", "--force", WORKTREE_PATH]);
  // Prune in case the directory was deleted out of band.
  run(["-C", REPO_PATH, "worktree", "prune"]);
}

export function commitAll(message: string): string {
  const add = run(["-C", WORKTREE_PATH, "add", "-A"]);
  if (add.code !== 0) {
    throw new Error(`git add failed: ${add.stderr}`);
  }
  const status = run(["-C", WORKTREE_PATH, "status", "--porcelain"]);
  if (status.stdout.trim().length === 0) {
    throw new Error("Nothing to commit — Claude exited without changes.");
  }
  const commit = run(["-C", WORKTREE_PATH, "commit", "-m", message]);
  if (commit.code !== 0) {
    throw new Error(`git commit failed: ${commit.stderr}`);
  }
  const rev = run(["-C", WORKTREE_PATH, "rev-parse", "HEAD"]);
  if (rev.code !== 0) {
    throw new Error(`git rev-parse failed: ${rev.stderr}`);
  }
  return rev.stdout.trim();
}

export function diffAgainst(base: string): string {
  const result = run(["-C", WORKTREE_PATH, "diff", `${base}...HEAD`]);
  if (result.code !== 0) {
    throw new Error(`git diff failed: ${result.stderr}`);
  }
  return result.stdout;
}

export const paths = {
  repo: REPO_PATH,
  workspace: WORKTREE_PATH,
};
