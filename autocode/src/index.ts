#!/usr/bin/env node
import { Command } from "commander";

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
    const subsRaw = await fetchSubIssues(client, cfg, prd.number);
    if (subsRaw.length === 0) {
      console.error(`[autocode] no sub-issues found for PRD #${prd.number}.`);
      process.exit(1);
    }

    const { order, dangling } = topologicalSort(subsRaw);
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
    await runPlanningPhase(prd, order, model);

    if (opts.dryRun) {
      console.error("[autocode] dry-run complete — exiting before worktree creation.");
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
