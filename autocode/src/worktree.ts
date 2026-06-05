import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

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

/**
 * Returns the branch checked out by the worktree registered at `path`:
 *   - `null`  → no worktree is registered at that path
 *   - `""`    → registered, but on a detached HEAD
 *   - branch  → registered on that branch (short name)
 */
function worktreeBranchAt(path: string): string | null {
  const result = run(["-C", REPO_PATH, "worktree", "list", "--porcelain"]);
  if (result.code !== 0) return null;
  // Porcelain output is newline-delimited records separated by a blank line.
  for (const block of result.stdout.split("\n\n")) {
    const lines = block.split("\n");
    const wt = lines
      .find((l) => l.startsWith("worktree "))
      ?.slice("worktree ".length);
    if (wt !== path) continue;
    const br = lines
      .find((l) => l.startsWith("branch "))
      ?.slice("branch ".length);
    if (!br) return ""; // registered but detached
    return br.replace(/^refs\/heads\//, "");
  }
  return null;
}

export function createWorktree(branch: string): void {
  // The worktree registration in /repo/.git survives across container runs even
  // when /workspace itself does not. If a worktree is already registered at the
  // path, reuse it instead of aborting.
  const current = worktreeBranchAt(WORKTREE_PATH);
  if (current !== null) {
    if (current !== branch) {
      // Point the existing worktree at the branch we need (create from main if
      // it does not exist yet). Any uncommitted changes are left untouched.
      let res = run(["-C", WORKTREE_PATH, "checkout", branch]);
      if (res.code !== 0) {
        res = run(["-C", WORKTREE_PATH, "checkout", "-b", branch, "main"]);
        if (res.code !== 0) {
          throw new Error(
            `Failed to switch worktree to ${branch}: ${res.stderr}`,
          );
        }
      }
    }
    return;
  }

  // No live worktree registered — make sure the path is free, then create one.
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
  // A leftover, unregistered directory would still make `worktree add` fail with
  // "already exists"; remove it. Idempotent — ignore if it is already gone.
  rmSync(WORKTREE_PATH, { recursive: true, force: true });
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
  // The container has no git identity and host ~/.gitconfig is not mounted, so
  // inject a configurable bot identity via `-c` (overrides any config file and
  // needs no write access to .git/config).
  const authorName = process.env.AUTOCODE_GIT_NAME?.trim() || "autocode";
  const authorEmail = process.env.AUTOCODE_GIT_EMAIL?.trim() || "autocode@local";
  const commit = run([
    "-C",
    WORKTREE_PATH,
    "-c",
    `user.name=${authorName}`,
    "-c",
    `user.email=${authorEmail}`,
    "commit",
    "-m",
    message,
  ]);
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
