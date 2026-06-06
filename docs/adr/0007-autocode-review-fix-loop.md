# Autocode review→fix loop

Autocode (`autocode/`) implements GitHub PRD issues end-to-end and ran a final
**review pass** over the whole `main...HEAD` diff. Until now the review output
was only streamed to stdout and then thrown away — the review agent named
improvements that nobody implemented. We close that gap.

**Decision.** Review findings become full PRD sub-issues and are fixed in the
**same run** on the **same `feat/` branch** via a bounded re-review loop: review
→ file findings as issues → fix each with a fresh agent → review again, until a
review comes back clean or a round limit is hit. The only stable contract
between the review agent and the orchestrator is a machine-readable
`findings[]` JSON block; everything else in `review.md` may change freely.

- **Same run, not deferred.** Fixes happen in the run that produced them, so the
  result stays "one branch, ready to push." Findings are still persisted as
  issues for traceability and crash-resilience, but the fix does not wait for a
  human to trigger a second run.
- **TS/Octokit mutations, not agent `gh`.** The orchestrator creates the issues
  (`createSubIssue`) and closes them, exactly as it already did for
  implementation sub-issues. GitHub mutations stay deterministic and testable;
  the agent stays a pure function from diff to findings.
- **Findings contract, not section coupling.** The orchestrator is "dumb": each
  finding → one issue → fix it. It does **not** parse the human-readable review
  sections, so `review.md` can be reworded without breaking autocode. The
  verdict is no longer a control signal — an empty `findings[]` means "nothing
  to do." The contract (`REVIEW_OUTPUT_CONTRACT`) lives in `runner.ts` next to
  its parser (`parseFindings`), appended to the review system prompt at runtime,
  so schema and parser are versioned together and cannot drift out of a
  hand-edited Markdown file.
- **Bounded, with overflow as open issues.** The loop runs at most
  `--review-rounds` / `AUTOCODE_REVIEW_MAX_ROUNDS` passes (default 3, resolved
  with the same precedence as `--model` / `AUTOCODE_MODEL`). Findings from the
  final, capped pass are left as open `ready-for-agent` sub-issues — a later
  `agent run --issue <PRD>` picks them up through the existing eligibility/topo
  machinery.

Findings are filed as full PRD sub-issues (`## Parent` → PRD, label
`ready-for-agent`, plus any `backend`/`frontend` hints from the finding) so
`runImplementationPhase` composes the right prompt automatically and a crashed
run is resumable by a plain re-run.

## Considered Options

- **Deferred re-run instead of same-run**: rejected — leaves the branch in a
  known-incomplete state and needs a human to notice and re-trigger; loses the
  "one branch, done" property.
- **Agent runs `gh` to create issues**: rejected — pushes a non-deterministic
  side effect into the agent and makes the return value (the new issue number)
  awkward to capture; Octokit is already wired up and returns it directly.
- **Couple autocode to the review's section headings**: rejected — makes
  `review.md` a load-bearing schema; any rewording silently breaks parsing. A
  single `findings[]` contract decouples the two.

## Consequences

- A run can now create and close issues it was not given up front; the PRD grows
  `fix:` sub-issues over its lifetime, which is the intended audit trail.
- Non-convergence is visible and safe: leftover findings remain as open issues
  plus a log summary rather than failing the run or looping forever.
- `review.md` stays a pure "how to review" guide; the machine contract is code,
  covered by `parseFindings` unit tests, and tolerant — a missing or malformed
  JSON block yields no findings (with a warning) instead of crashing a run that
  already did real work.
