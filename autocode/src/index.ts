#!/usr/bin/env node
import { Command } from "commander";

import { computeEligibility } from "./eligibility.js";
import {
  createClient,
  createSubIssue,
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
  .option(
    "--review-rounds <n>",
    "Max review→fix passes (overrides AUTOCODE_REVIEW_MAX_ROUNDS; default 3)",
    (v) => parseInt(v, 10),
  )
  .action(
    async (opts: {
      issue: number;
      dryRun: boolean;
      model?: string;
      reviewRounds?: number;
    }) => {
    const model = opts.model ?? process.env.AUTOCODE_MODEL;
    if (!model || model.trim().length === 0) {
      console.error(
        "[autocode] ERROR: no Claude model configured. Set AUTOCODE_MODEL in .env or pass --model <name>.",
      );
      process.exit(1);
    }

    const envRounds = process.env.AUTOCODE_REVIEW_MAX_ROUNDS;
    const parsedEnvRounds =
      envRounds && envRounds.trim().length > 0 ? parseInt(envRounds, 10) : undefined;
    const maxRounds = opts.reviewRounds ?? parsedEnvRounds ?? 3;
    if (!Number.isInteger(maxRounds) || maxRounds < 1) {
      console.error(
        "[autocode] ERROR: review rounds must be a positive integer (got " +
          `${opts.reviewRounds ?? envRounds}).`,
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

      const repo = `${cfg.owner}/${cfg.repo}`;
      for (let round = 1; ; round++) {
        console.error(`[autocode] review phase (round ${round}/${maxRounds})…`);
        const findings = await runReviewPhase(prd, diffAgainst("main"), model);
        if (findings.length === 0) {
          console.error("[autocode] review clean — nothing to fix.");
          break;
        }

        // Persist every finding as an open sub-issue first: it is the durable
        // record and makes a crashed run resumable via a plain re-run.
        const created: { number: number; title: string; body: string; labels: string[] }[] = [];
        for (const f of findings) {
          const number = await createSubIssue(client, cfg, {
            prdNumber: prd.number,
            title: f.title,
            body: f.body,
            labels: f.labels,
          });
          created.push({ number, title: f.title, body: f.body, labels: f.labels });
          console.error(`[autocode] filed fix issue #${number} — ${f.title}`);
        }

        if (round >= maxRounds) {
          const nums = created.map((c) => `#${c.number}`).join(", ");
          console.error(
            `[autocode] max review rounds (${maxRounds}) reached — ` +
              `${created.length} finding(s) left as open issues: ${nums}. ` +
              `Re-run 'agent run --issue ${prd.number}' to pick them up.`,
          );
          break;
        }

        // Under the limit: fix each finding with a fresh subprocess, commit, close.
        for (const issue of created) {
          console.error(`[autocode] fixing #${issue.number} — ${issue.title}`);
          await runImplementationPhase(
            {
              number: issue.number,
              title: issue.title,
              body: issue.body,
              labels: issue.labels,
              blockedBy: [],
            },
            model,
          );
          const sha = commitAll(`fix: ${issue.title} (closes #${issue.number})`);
          console.error(`[autocode] committed ${sha}`);
          closeIssue(repo, issue.number, branch, sha);
        }
      }
    } finally {
      console.error(`[autocode] cleaning up worktree…`);
      cleanupWorktree();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(`[autocode] ERROR: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
