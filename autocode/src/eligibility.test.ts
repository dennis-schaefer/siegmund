import assert from "node:assert/strict";
import { test } from "node:test";

import { computeEligibility, REQUIRED_LABEL } from "./eligibility.js";
import type { IssueStateMap, IssueStatus, SubIssue } from "./github.js";

function sub(
  number: number,
  opts: { ready?: boolean; blockedBy?: number[]; labels?: string[] } = {},
): SubIssue {
  const labels = opts.labels ?? (opts.ready === false ? [] : [REQUIRED_LABEL]);
  return {
    number,
    title: `Issue ${number}`,
    body: "",
    labels,
    blockedBy: opts.blockedBy ?? [],
  };
}

function states(
  entries: Record<number, { state: "open" | "closed"; labels?: string[] }>,
): IssueStateMap {
  const map: IssueStateMap = new Map();
  for (const [num, v] of Object.entries(entries)) {
    const status: IssueStatus = { state: v.state, labels: v.labels ?? [] };
    map.set(Number(num), status);
  }
  return map;
}

test("issue without the ready label is ignored entirely", () => {
  const children = [sub(7, { ready: false })];
  const result = computeEligibility(children, states({ 7: { state: "open" } }));
  assert.equal(result.runnable.length, 0);
  assert.equal(result.heldBack.length, 0);
});

test("ready issue with no blockers is runnable", () => {
  const children = [sub(7)];
  const result = computeEligibility(children, states({ 7: { state: "open" } }));
  assert.deepEqual(
    result.runnable.map((i) => i.number),
    [7],
  );
});

test("closed blocker counts as satisfied", () => {
  const children = [sub(7, { blockedBy: [6] })];
  const result = computeEligibility(
    children,
    states({ 6: { state: "closed" }, 7: { state: "open" } }),
  );
  assert.deepEqual(
    result.runnable.map((i) => i.number),
    [7],
  );
  // The closed blocker is dropped from the in-run edge set.
  assert.deepEqual(result.runnable[0].blockedBy, []);
});

test("open ready blocker is kept as an in-run dependency edge", () => {
  const children = [sub(6), sub(7, { blockedBy: [6] })];
  const result = computeEligibility(
    children,
    states({ 6: { state: "open", labels: [REQUIRED_LABEL] }, 7: { state: "open" } }),
  );
  assert.deepEqual(
    result.runnable.map((i) => i.number).sort(),
    [6, 7],
  );
  const seven = result.runnable.find((i) => i.number === 7)!;
  assert.deepEqual(seven.blockedBy, [6]);
});

test("open non-ready blocker holds the dependent back", () => {
  const children = [sub(7, { blockedBy: [6] })];
  const result = computeEligibility(
    children,
    states({ 6: { state: "open" }, 7: { state: "open" } }),
  );
  assert.equal(result.runnable.length, 0);
  assert.deepEqual(
    result.heldBack.map((h) => h.issue.number),
    [7],
  );
  assert.match(result.heldBack[0].reasons[0], /open #6 \(not ready\)/);
});

test("hold-back propagates transitively along in-run edges", () => {
  // 9 (ready) -> 7 (ready, blocked by open non-ready 6)
  const children = [sub(7, { blockedBy: [6] }), sub(9, { blockedBy: [7] })];
  const result = computeEligibility(
    children,
    states({
      6: { state: "open" },
      7: { state: "open", labels: [REQUIRED_LABEL] },
      9: { state: "open" },
    }),
  );
  assert.equal(result.runnable.length, 0);
  assert.deepEqual(
    result.heldBack.map((h) => h.issue.number),
    [7, 9],
  );
  const nine = result.heldBack.find((h) => h.issue.number === 9)!;
  assert.match(nine.reasons[0], /held-back #7/);
});

test("phantom blocker warns but the issue still runs", () => {
  const children = [sub(7, { blockedBy: [99] })];
  const result = computeEligibility(children, states({ 7: { state: "open" } }));
  assert.deepEqual(
    result.runnable.map((i) => i.number),
    [7],
  );
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /#7 references unknown #99/);
});

test("partial progress: runnable proceeds while held-back is reported", () => {
  // 7 blocked by open non-ready 6; 9 unblocked.
  const children = [sub(7, { blockedBy: [6] }), sub(9)];
  const result = computeEligibility(
    children,
    states({ 6: { state: "open" }, 7: { state: "open" }, 9: { state: "open" } }),
  );
  assert.deepEqual(
    result.runnable.map((i) => i.number),
    [9],
  );
  assert.deepEqual(
    result.heldBack.map((h) => h.issue.number),
    [7],
  );
});
