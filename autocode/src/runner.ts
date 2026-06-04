import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { EligibilityResult } from "./eligibility.js";
import type { IssueRef, SubIssue } from "./github.js";
import { formatPlanInventory } from "./planner.js";
import { createStreamRenderer } from "./stream.js";
import { paths } from "./worktree.js";

const here = dirname(fileURLToPath(import.meta.url));
const promptDir = resolve(here, "..", "prompts");

async function readPrompt(name: string): Promise<string> {
  return readFile(resolve(promptDir, name), "utf8");
}

function runClaude(
  systemPrompt: string,
  userMessage: string,
  cwd: string,
  model: string,
): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(
      "claude",
      [
        "--print",
        "--output-format",
        "stream-json",
        "--verbose",
        // Autonomous agent in an isolated container — bypass the interactive
        // permission prompts that headless mode cannot answer.
        "--dangerously-skip-permissions",
        "--model",
        model,
        "--system-prompt",
        systemPrompt,
      ],
      {
        cwd,
        stdio: ["pipe", "pipe", "inherit"],
        // Claude Code refuses --dangerously-skip-permissions as root unless it
        // detects a sandbox. The container runs as root, so signal it.
        env: { ...process.env, IS_SANDBOX: "1" },
      },
    );

    const renderer = createStreamRenderer();
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => renderer.write(chunk));

    child.on("error", rejectP);
    child.on("exit", (code) => {
      renderer.finish();
      if (code === 0) resolveP();
      else rejectP(new Error(`claude exited with code ${code}`));
    });
    child.stdin.end(userMessage);
  });
}

export async function runPlanningPhase(
  prd: IssueRef,
  eligibility: EligibilityResult,
  model: string,
): Promise<void> {
  const systemPrompt = await readPrompt("plan.md");
  const inventory = formatPlanInventory(eligibility);
  const userMessage = [
    `# PRD #${prd.number} — ${prd.title}`,
    "",
    prd.body.trim() || "(no body)",
    "",
    "---",
    "",
    "## Sub-issues",
    "",
    inventory || "(none found)",
  ].join("\n");
  await runClaude(systemPrompt, userMessage, paths.workspace, model);
}

export async function runImplementationPhase(
  issue: SubIssue,
  model: string,
): Promise<void> {
  const parts: string[] = [await readPrompt("basic.md")];
  if (issue.labels.includes("backend")) parts.push(await readPrompt("backend.md"));
  if (issue.labels.includes("frontend")) parts.push(await readPrompt("frontend.md"));
  const systemPrompt = parts.join("\n\n");

  const userMessage = [
    `# Issue #${issue.number} — ${issue.title}`,
    "",
    issue.body.trim() || "(no body)",
  ].join("\n");

  await runClaude(systemPrompt, userMessage, paths.workspace, model);
}

export async function runReviewPhase(
  prd: IssueRef,
  diff: string,
  model: string,
): Promise<void> {
  const systemPrompt = await readPrompt("review.md");
  const userMessage = [
    `# PRD #${prd.number} — ${prd.title}`,
    "",
    prd.body.trim() || "(no body)",
    "",
    "---",
    "",
    "## Diff (main...HEAD)",
    "",
    "```diff",
    diff,
    "```",
  ].join("\n");
  await runClaude(systemPrompt, userMessage, paths.workspace, model);
}

export function closeIssue(
  repo: string,
  issueNumber: number,
  branch: string,
  commitSha: string,
): void {
  const comment = `Implemented in branch \`${branch}\`. Commit: ${commitSha}`;
  const result = spawnSync(
    "gh",
    [
      "issue",
      "close",
      String(issueNumber),
      "--repo",
      repo,
      "--comment",
      comment,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`gh issue close failed for #${issueNumber}`);
  }
}
