import type { IssueStateMap, SubIssue } from "./github.js";

/** The triage label an issue must carry before autocode will implement it. */
export const REQUIRED_LABEL = "ready-for-agent";

export interface HeldBack {
  issue: SubIssue;
  reasons: string[];
}

export interface EligibilityResult {
  /** Ready issues whose blockers are all satisfied, in arbitrary order.
   *  Their `blockedBy` is trimmed to in-run edges (other runnable issues) so a
   *  downstream topological sort sees no dangling references. */
  runnable: SubIssue[];
  /** Ready issues that cannot run this time, each with human-readable reasons. */
  heldBack: HeldBack[];
  /** Non-fatal warnings (e.g. a blocker that exists in no issue). */
  warnings: string[];
}

/**
 * Partition the `ready-for-agent` sub-issues into the ones autocode may
 * implement now and the ones it must hold back.
 *
 * A ready issue is *runnable* iff every blocker is satisfied:
 *  - blocker closed on GitHub            → satisfied (done)
 *  - blocker open and also ready         → in-run dependency (kept as an edge)
 *  - blocker open and not ready          → unsatisfied → hold back
 *  - blocker exists in no issue (phantom)→ warn + proceed (treated as satisfied)
 *
 * Hold-back propagates transitively: if A is an in-run blocker of B and A is
 * held back, B is held back too.
 */
export function computeEligibility(
  children: SubIssue[],
  issueState: IssueStateMap,
): EligibilityResult {
  const ready = children.filter((c) => c.labels.includes(REQUIRED_LABEL));
  const readyByNumber = new Map<number, SubIssue>();
  for (const issue of ready) readyByNumber.set(issue.number, issue);

  const warnings: string[] = [];
  // Reasons that directly disqualify an issue (open, non-ready blocker).
  const directReasons = new Map<number, string[]>();
  // Edges to other ready issues that must be built earlier in this same run.
  const inRunBlockers = new Map<number, number[]>();

  for (const issue of ready) {
    const reasons: string[] = [];
    const edges: number[] = [];
    for (const blocker of issue.blockedBy) {
      const status = issueState.get(blocker);
      if (!status) {
        warnings.push(`#${issue.number} references unknown #${blocker}`);
        continue;
      }
      if (status.state === "closed") continue; // done
      if (readyByNumber.has(blocker)) {
        edges.push(blocker); // in-run dependency
        continue;
      }
      reasons.push(`blocked by open #${blocker} (not ready)`);
    }
    if (reasons.length > 0) directReasons.set(issue.number, reasons);
    inRunBlockers.set(issue.number, edges);
  }

  // Propagate hold-back transitively along in-run edges.
  const heldReasons = new Map<number, string[]>();
  for (const [num, reasons] of directReasons) heldReasons.set(num, [...reasons]);

  let changed = true;
  while (changed) {
    changed = false;
    for (const issue of ready) {
      if (heldReasons.has(issue.number)) continue;
      const blockedHolders = (inRunBlockers.get(issue.number) ?? []).filter(
        (b) => heldReasons.has(b),
      );
      if (blockedHolders.length > 0) {
        heldReasons.set(
          issue.number,
          blockedHolders
            .sort((a, b) => a - b)
            .map((b) => `blocked by held-back #${b}`),
        );
        changed = true;
      }
    }
  }

  const runnable: SubIssue[] = [];
  const heldBack: HeldBack[] = [];
  for (const issue of ready) {
    if (heldReasons.has(issue.number)) {
      heldBack.push({ issue, reasons: heldReasons.get(issue.number)! });
      continue;
    }
    // All in-run edges point at runnable issues (a held-back blocker would have
    // propagated to this one), so trimming to them is safe for topo sort.
    runnable.push({ ...issue, blockedBy: inRunBlockers.get(issue.number) ?? [] });
  }

  runnable.sort((a, b) => a.number - b.number);
  heldBack.sort((a, b) => a.issue.number - b.issue.number);
  warnings.sort();

  return { runnable, heldBack, warnings };
}
