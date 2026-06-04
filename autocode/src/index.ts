#!/usr/bin/env node
import { Command } from "commander";

import { computeEligibility } from "./eligibility.js";
import {
  createClient,
  fetchPrdIssue,
  fetchSubIssues,
  readConfig,
} from "./github.js";
import { topologicalSort } from "./planner.js";
import {
  closeIssue,
  runImplementationPhase,
  runPlanningPhase,
  runReviewPhase,
} from "./runner.js";
import {
  branchName,
  cleanupWorktree,
  commitAll,
  createWorktree,
  diffAgainst,
} from "./worktree.js";

const program = new Command();

program
  .name("autocode")
  .description("Autocode agent — reads GitHub PRD issues and implements them via Claude Code.")
  .version("0.1.0");

const agent = program.command("agent").description("Agent commands");

agent
  .command("run")
  .requiredOption("--issue <number>", "PRD issue number", (v) => parseInt(v, 10))
  .option("--dry-run", "Plan only; do not modify files or close issues", false)
  .option(
    "--model <name>",
    "Claude model to use (overrides the AUTOCODE_MODEL env var)",
  )
  .action(async (opts: { issue: number; dryRun: boolean; model?: string }) => {
    const model = opts.model ?? process.env.AUTOCODE_MODEL;
    if (!model || model.trim().length === 0) {
      console.error(
        "[autocode] ERROR: no Claude model configured. Set AUTOCODE_MODEL in .env or pass --model <name>.",
      );
      process.exit(1);
    }

    const cfg = readConfig();
    const client = createClient(cfg);

    console.error(`[autocode] fetching PRD #${opts.issue}…`);
    const prd = await fetchPrdIssue(client, cfg, opts.issue);

    console.error(`[autocode] fetching sub-issues for PRD #${prd.number}…`);
    const { subs, issueState } = await fetchSubIssues(client, cfg, prd.number);
    if (subs.length === 0) {
      console.error(`[autocode] no open sub-issues found for PRD #${prd.number}.`);
      return;
    }

    // Keep only ready-for-agent issues whose blockers are done; report the rest.
    const eligibility = computeEligibility(subs, issueState);
    for (const w of eligibility.warnings) {
      console.error(`[autocode] WARNING — ${w}`);
    }
    for (const h of eligibility.heldBack) {
      console.error(
        `[autocode] held back: #${h.issue.number} — ${h.issue.title} (${h.reasons.join("; ")})`,
      );
    }

    if (eligibility.runnable.length === 0 && eligibility.heldBack.length === 0) {
      console.error(
        `[autocode] no ready-for-agent issues for PRD #${prd.number}.`,
      );
      return;
    }

    const { order, dangling } = topologicalSort(eligibility.runnable);
    if (dangling.length > 0) {
      for (const d of dangling) {
        console.error(
          `[autocode] WARNING — issue #${d.issue} references missing blockers: ${d.missing
            .map((n) => `#${n}`)
            .join(", ")}`,
        );
      }
    }

    console.error(`[autocode] planning phase (model: ${model})…`);
    await runPlanningPhase(prd, eligibility, model);

    if (opts.dryRun) {
      console.error("[autocode] dry-run complete — exiting before worktree creation.");
      return;
    }

    if (order.length === 0) {
      console.error(
        "[autocode] nothing runnable — all ready issues are held back. Exiting before worktree creation.",
      );
      return;
    }

    const branch = branchName(prd.number, prd.title);
    console.error(`[autocode] creating worktree on branch ${branch}…`);
    createWorktree(branch);

    try {
      for (const issue of order) {
        console.error(`[autocode] implementing #${issue.number} — ${issue.title}`);
        await runImplementationPhase(issue, model);
        const sha = commitAll(`feat: ${issue.title} (closes #${issue.number})`);
        console.error(`[autocode] committed ${sha}`);
        closeIssue(
          `${cfg.owner}/${cfg.repo}`,
          issue.number,
          branch,
          sha,
        );
      }

      console.error(`[autocode] review phase…`);
      const diff = diffAgainst("main");
      await runReviewPhase(prd, diff, model);
    } finally {
      console.error(`[autocode] cleaning up worktree…`);
      cleanupWorktree();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(`[autocode] ERROR: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
