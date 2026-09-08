#!/usr/bin/env node
/* State checks and real-browser journeys against the temporary Python fixture.
   No fixture projects, traces, screenshots or results are stored in this skill. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
const here = dirname(fileURLToPath(import.meta.url)),
  sandbox = { globalThis: {}, console };
vm.runInNewContext(await readFile(join(here, "state.js"), "utf8"), sandbox);
const { DraftStore, diffOps, diffHTML } = sandbox.globalThis.DocDokiState;
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log("PASS", name);
}
const docs = { A: { source: "A0", path: "A" }, B: { source: "B0", path: "B" } };
check("A1 → B1 → A2 undo is chronological", () => {
  const s = new DraftStore(docs);
  s.set("A", "A1");
  s.set("B", "B1");
  s.set("A", "A2");
  assert.equal(s.undo(), "A");
  assert.equal(s.source("A"), "A1");
  assert.equal(s.source("B"), "B1");
  assert.equal(s.undo(), "B");
  assert.equal(s.source("B"), "B0");
  s.undo();
  assert.equal(s.drafts.size, 0);
});
check("Saved history accumulates separately from current disk preconditions", () => {
  const s = new DraftStore(docs);
  for (const [path, to] of [
    ["A", "A1"],
    ["B", "B1"],
    ["A", "A2"],
  ]) {
    s.set(path, to);
    const edits = s.startSave();
    s.finishSave({ ok: true, documents: { [path]: { path, source: to } }, receipt: edits });
  }
  s.set("A", "A3");
  assert.deepEqual(
    Array.from(s.receipt, (e) => [e.path, e.from, e.to]),
    [
      ["A", "A0", "A1"],
      ["B", "B0", "B1"],
      ["A", "A1", "A2"],
    ],
  );
  assert.equal(s.edits()[0].from, "A2");
  assert.equal(s.edits()[0].to, "A3");
});
check("Save locks mutations and adopts actual stored sources", () => {
  const s = new DraftStore(docs);
  s.set("A", "A1");
  assert.equal(s.startSave()[0].to, "A1");
  assert.equal(s.startSave(), null);
  assert.equal(s.set("A", "A2"), false);
  s.undo();
  s.discard("A", docs.A);
  assert.equal(s.source("A"), "A1");
  s.finishSave({
    ok: true,
    documents: { A: { source: "A1 normalized", path: "A" } },
    receipt: [{ path: "A", from: "A0", to: "A1 normalized" }],
  });
  assert.equal(s.drafts.size, 0);
  s.set("A", "A2");
  assert.equal(s.edits()[0].from, "A1 normalized");
  assert.equal(s.receipt.length, 1);
});
check("Failed saves retain drafts, history and original source", () => {
  const s = new DraftStore(docs);
  s.set("A", "A1");
  s.startSave();
  s.finishSave({ ok: false });
  assert.equal(s.source("A"), "A1");
  assert.equal(s.edits()[0].from, "A0");
  s.undo();
  assert.equal(s.drafts.size, 0);
});
check("Discard invalidates even equal-text sources and cannot undo across adoption", () => {
  const s = new DraftStore(docs);
  let version = s.version;
  assert.equal(s.discard("A", docs.A), true);
  assert.ok(s.version > version);
  s.set("A", "A1");
  s.set("B", "B1");
  version = s.version;
  s.discard("A", { path: "A", source: "A1" });
  assert.ok(s.version > version);
  assert.equal(s.drafts.has("A"), false);
  assert.equal(s.undo(), "B");
  assert.equal(s.undo(), null);
  s.set("A", "A2");
  s.discard("A", { path: "A", source: "external A" });
  assert.equal(s.source("A"), "external A");
  s.set("A", "A3");
  s.startSave();
  version = s.version;
  assert.equal(s.discard("A", null), false);
  assert.equal(s.version, version);
  s.finishSave({ ok: false });
  s.discard("A", null);
  assert.equal(s.base.has("A"), false);
});
check("Staged sources preserve mixed line endings exactly", () => {
  const s = new DraftStore({ A: { source: "A\r\nB\n" } });
  s.set("A", "A\r\nC\n");
  assert.equal(s.source("A"), "A\r\nC\n");
  s.undo();
  assert.equal(s.source("A"), "A\r\nB\n");
});
check("Diff is bounded, complete and HTML-safe", () => {
  const a = Array.from({ length: 4000 }, (_, i) => "old " + i).join("\n"),
    b = Array.from({ length: 4000 }, (_, i) => "new " + i).join("\n");
  const start = performance.now(),
    html = diffHTML(a, b);
  assert.ok(performance.now() - start < 1000);
  assert.ok(html.includes("<details open"));
  assert.ok(html.includes("new 3999"));
  assert.ok(html.includes("old 3999"));
  assert.ok(diffHTML("a\nb", "a\n<script>").includes("&lt;script&gt;"));
  assert.ok(diffHTML("same words old", "same words new").includes("<ins>new</ins>"));
  assert.equal(diffOps(["x"], ["x"]).length, 1);
});

if (process.argv.includes("--browser")) {
  const { runBrowserChecks } = await import("./tests/browser.mjs");
  checks += await runBrowserChecks();
}
console.log(`\n${checks} checks passed.`);
