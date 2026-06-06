import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFindings } from "./runner.js";

/** Wrap a JSON payload in the fenced block the review agent must emit. */
function fence(json: string): string {
  return "Some human-readable report.\n\n```json\n" + json + "\n```\n";
}

test("parses a valid findings block", () => {
  const text = fence(
    JSON.stringify({
      findings: [
        { title: "Fix the thing", body: "It is broken at a.ts:foo", labels: ["backend"] },
      ],
    }),
  );
  const findings = parseFindings(text);
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0], {
    title: "Fix the thing",
    body: "It is broken at a.ts:foo",
    labels: ["backend"],
  });
});

test("empty findings array yields no findings", () => {
  assert.deepEqual(parseFindings(fence('{"findings": []}')), []);
});

test("missing json block yields no findings", () => {
  assert.deepEqual(parseFindings("Just prose, no fenced block at all."), []);
});

test("malformed json yields no findings", () => {
  assert.deepEqual(parseFindings(fence("{not valid json")), []);
});

test("findings that is not an array yields no findings", () => {
  assert.deepEqual(parseFindings(fence('{"findings": "nope"}')), []);
});

test("uses the last json fence when several are present", () => {
  const text =
    "```json\n" +
    JSON.stringify({ findings: [{ title: "Old", body: "stale" }] }) +
    "\n```\n\nmore text\n\n```json\n" +
    JSON.stringify({ findings: [{ title: "New", body: "fresh" }] }) +
    "\n```\n";
  const findings = parseFindings(text);
  assert.deepEqual(
    findings.map((f) => f.title),
    ["New"],
  );
});

test("unknown labels are filtered out, known ones kept", () => {
  const text = fence(
    JSON.stringify({
      findings: [
        { title: "T", body: "B", labels: ["backend", "ready-for-agent", "frontend", 7] },
      ],
    }),
  );
  assert.deepEqual(parseFindings(text)[0].labels, ["backend", "frontend"]);
});

test("findings missing title or body are skipped", () => {
  const text = fence(
    JSON.stringify({
      findings: [
        { title: "", body: "no title" },
        { title: "no body", body: "   " },
        { title: "keep", body: "kept" },
      ],
    }),
  );
  const findings = parseFindings(text);
  assert.deepEqual(
    findings.map((f) => f.title),
    ["keep"],
  );
});

test("missing labels defaults to an empty array", () => {
  const findings = parseFindings(fence('{"findings": [{"title": "T", "body": "B"}]}'));
  assert.deepEqual(findings[0].labels, []);
});
