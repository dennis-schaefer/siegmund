import type { SubIssue } from "./github.js";

export interface PlanResult {
  order: SubIssue[];
  dangling: { issue: number; missing: number[] }[];
}

export function topologicalSort(issues: SubIssue[]): PlanResult {
  const byNumber = new Map<number, SubIssue>();
  for (const i of issues) byNumber.set(i.number, i);

  const dangling: { issue: number; missing: number[] }[] = [];
  const inDegree = new Map<number, number>();
  const dependents = new Map<number, number[]>();

  for (const issue of issues) {
    inDegree.set(issue.number, 0);
    dependents.set(issue.number, []);
  }

  for (const issue of issues) {
    const missing: number[] = [];
    for (const blocker of issue.blockedBy) {
      if (!byNumber.has(blocker)) {
        missing.push(blocker);
        continue;
      }
      inDegree.set(issue.number, (inDegree.get(issue.number) ?? 0) + 1);
      const list = dependents.get(blocker);
      if (list) list.push(issue.number);
    }
    if (missing.length > 0) {
      dangling.push({ issue: issue.number, missing });
    }
  }

  // Kahn's algorithm — stable across runs by sorting ready set by issue number.
  const ready: number[] = [];
  for (const [num, deg] of inDegree) {
    if (deg === 0) ready.push(num);
  }
  ready.sort((a, b) => a - b);

  const order: SubIssue[] = [];
  while (ready.length > 0) {
    const next = ready.shift()!;
    const issue = byNumber.get(next);
    if (issue) order.push(issue);
    for (const dep of dependents.get(next) ?? []) {
      const newDeg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) {
        // Insert maintaining sort order on issue number.
        let i = 0;
        while (i < ready.length && ready[i] < dep) i++;
        ready.splice(i, 0, dep);
      }
    }
  }

  if (order.length !== issues.length) {
    const remaining = issues
      .filter((i) => !order.some((o) => o.number === i.number))
      .map((i) => `#${i.number}`)
      .join(", ");
    throw new Error(
      `Circular dependency detected among sub-issues: ${remaining}`,
    );
  }

  return { order, dangling };
}

export function formatInventory(issues: SubIssue[]): string {
  return issues
    .map((i) => {
      const labels = i.labels.length > 0 ? i.labels.join(", ") : "—";
      const blockedBy =
        i.blockedBy.length > 0
          ? i.blockedBy.map((n) => `#${n}`).join(", ")
          : "none";
      return `#${i.number} — ${i.title} [labels: ${labels}] — blocked by: ${blockedBy}`;
    })
    .join("\n");
}
