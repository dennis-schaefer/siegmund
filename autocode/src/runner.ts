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
): Promise<string> {
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
      if (code === 0) resolveP(renderer.result());
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

/** A single actionable improvement the review agent wants turned into a fix. */
export interface Finding {
  title: string;
  body: string;
  labels: string[];
}

/** Prompt-composition hints the orchestrator understands; anything else is dropped. */
const KNOWN_FINDING_LABELS = ["backend", "frontend"] as const;

/**
 * The machine contract appended to `review.md` at runtime. Lives in code, next
 * to `parseFindings`, so the schema and its parser are versioned together and
 * cannot drift out of a hand-edited Markdown file.
 */
export const REVIEW_OUTPUT_CONTRACT = `## Machine-readable output (required)

After the human-readable report above, emit **as the very last thing** exactly
one fenced \`\`\`json block and nothing after it. It is the only part of your
output that is parsed by a machine, so it must be valid JSON.

Schema:

\`\`\`json
{
  "findings": [
    {
      "title": "Imperative short title of the improvement",
      "body": "What is wrong, where (file:symbol), and what the fix must achieve.\\n\\n## Acceptance criteria\\n- [ ] concrete, testable criterion\\n- [ ] a negative / boundary test where it applies",
      "labels": ["backend"]
    }
  ]
}
\`\`\`

Rules:
- Every actionable improvement you found — including scope creep worth
  reverting — becomes exactly one finding with testable acceptance criteria in
  its \`body\`.
- \`labels\` is an optional subset of ["backend","frontend"] used only as
  prompt-composition hints. Do not add any other labels.
- Do **not** write \`## Parent\` or \`## Blocked by\` — the orchestrator adds those.
- Nothing to fix → emit \`{"findings": []}\`.`;

/** Extract the body of the last \`\`\`json fenced block, or null if none. */
function lastJsonFence(text: string): string | null {
  const fence = /\`\`\`json\s*\n([\s\S]*?)\n\`\`\`/gi;
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = fence.exec(text)) !== null) {
    last = match[1];
  }
  return last;
}

/**
 * Parse the review agent's findings contract. Pure and tolerant: a missing or
 * malformed JSON block yields `[]` plus a warning rather than crashing a run
 * that has already done real work.
 */
export function parseFindings(text: string): Finding[] {
  const raw = lastJsonFence(text);
  if (raw === null) {
    console.error("[autocode] WARNING — review produced no ```json block; treating as no findings.");
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[autocode] WARNING — review's JSON block did not parse; treating as no findings.");
    return [];
  }

  const findings = (parsed as { findings?: unknown })?.findings;
  if (!Array.isArray(findings)) {
    console.error("[autocode] WARNING — review JSON has no findings array; treating as no findings.");
    return [];
  }

  const result: Finding[] = [];
  for (const entry of findings) {
    if (typeof entry !== "object" || entry === null) continue;
    const { title, body, labels } = entry as Record<string, unknown>;
    if (typeof title !== "string" || title.trim().length === 0) continue;
    if (typeof body !== "string" || body.trim().length === 0) continue;
    const cleanLabels = Array.isArray(labels)
      ? labels.filter(
          (l): l is string =>
            typeof l === "string" &&
            (KNOWN_FINDING_LABELS as readonly string[]).includes(l),
        )
      : [];
    result.push({ title: title.trim(), body: body.trim(), labels: cleanLabels });
  }
  return result;
}

export async function runReviewPhase(
  prd: IssueRef,
  diff: string,
  model: string,
): Promise<Finding[]> {
  const reviewMd = await readPrompt("review.md");
  const systemPrompt = `${reviewMd}\n\n${REVIEW_OUTPUT_CONTRACT}`;
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
  const output = await runClaude(systemPrompt, userMessage, paths.workspace, model);
  return parseFindings(output);
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
