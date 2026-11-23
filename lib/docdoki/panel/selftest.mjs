#!/usr/bin/env node
/* State checks and real-browser journeys against the temporary Python fixture. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url)),
  sandbox = { globalThis: {}, console };
vm.runInNewContext(await readFile(join(here, "state.js"), "utf8"), sandbox);
const { DraftStore, diffOps, unifiedDiff, diffHTML } = sandbox.globalThis.DocDokiState;

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log("PASS", name);
}

const docs = { A: { source: "line1\nline2\nline3", path: "A" }, B: { source: "B0", path: "B" } };

check("A1 → B1 → A2 undo is chronological", () => {
  const s = new DraftStore(docs);
  s.set("A", "A1");
  s.set("B", "B1");
  s.set("A", "A2");
  assert.equal(s.undo(), "A");
  assert.equal(s.source("A"), "A1");
  assert.equal(s.undo(), "B");
  assert.equal(s.source("B"), "B0");
  s.undo();
  assert.equal(s.drafts.size, 0);
});

check("Repeated saves deduplicate into one net session delta per file", () => {
  const s = new DraftStore(docs);
  for (const [path, to] of [
    ["A", "line1\nline2-v1\nline3"],
    ["B", "B1"],
    ["A", "line1\nline2-v2\nline3"],
  ]) {
    s.set(path, to);
    const edits = s.startSave();
    s.finishSave({ ok: true, documents: { [path]: { path, source: to } }, receipt: edits });
  }
  const saved = s.savedEntries();
  assert.equal(saved.length, 2);
  const aEntry = saved.find((e) => e.path === "A");
  assert.equal(aEntry.from, "line1\nline2\nline3");
  assert.equal(aEntry.to, "line1\nline2-v2\nline3");

  // Reverting A back to its initial session baseline removes it from saved deltas
  s.set("A", "line1\nline2\nline3");
  const revertEdits = s.startSave();
  s.finishSave({ ok: true, documents: { A: { path: "A", source: "line1\nline2\nline3" } }, receipt: revertEdits });
  assert.equal(s.savedEntries().length, 1);
  assert.equal(s.savedEntries()[0].path, "B");
});

check("Unified diff emits compact hunks instead of full file dumps", () => {
  const before = Array.from({ length: 40 }, (_, i) => `row ${i + 1}`).join("\n");
  const after = before.replace("row 20", "row 20 updated");
  const patch = unifiedDiff("docdoki/specs/a.md", before, after, 2);
  assert.ok(patch.includes("--- a/docdoki/specs/a.md"));
  assert.ok(patch.includes("+++ b/docdoki/specs/a.md"));
  assert.ok(patch.includes("-row 20"));
  assert.ok(patch.includes("+row 20 updated"));
  assert.ok(!patch.includes("row 1\n"));
  assert.ok(!patch.includes("row 40"));
});

check("Failed saves retain drafts, history and original source", () => {
  const s = new DraftStore(docs);
  s.set("A", "A1");
  s.startSave();
  s.finishSave({ ok: false });
  assert.equal(s.source("A"), "A1");
  assert.equal(s.edits()[0].from, "line1\nline2\nline3");
});

check("Discard clears draft and adopts latest disk baseline", () => {
  const s = new DraftStore(docs);
  s.set("A", "A1");
  assert.equal(s.discard("A", { path: "A", source: "external" }), true);
  assert.equal(s.drafts.has("A"), false);
  assert.equal(s.source("A"), "external");
});

check("Diff HTML is bounded, complete and XSS-safe", () => {
  const a = Array.from({ length: 4000 }, (_, i) => "old " + i).join("\n"),
    b = Array.from({ length: 4000 }, (_, i) => "new " + i).join("\n");
  const html = diffHTML(a, b);
  assert.ok(html.includes("<details open"));
  assert.ok(diffHTML("a\nb", "a\n<script>").includes("&lt;script&gt;"));
  assert.equal(diffOps(["x"], ["x"]).length, 1);
});

const panelSrc = await readFile(join(here, "panel.js"), "utf8");
const stripFnMatch = panelSrc.match(/function stripFrontmatter\([\s\S]*?\n\}/);
const stripBox = {};
vm.runInNewContext(`${stripFnMatch[0]}; this.stripFrontmatter = stripFrontmatter;`, stripBox);

check("stripFrontmatter strips only leading frontmatter, never horizontal rules", () => {
  const { stripFrontmatter } = stripBox;
  const plain = "# Title\n\nIntro\n\n---\n\nMiddle\n\n---\n\nEnd\n";
  assert.equal(stripFrontmatter(plain), plain);
  assert.equal(stripFrontmatter("---\npurpose: ok\n---\n# Title\n"), "# Title\n");
  assert.equal(stripFrontmatter("---\n---\n# Empty\n"), "# Empty\n");
  assert.equal(stripFrontmatter("\uFEFF---\r\na: 1\r\n---\r\nBody"), "Body");
});

const changesSrc = await readFile(join(here, "changes.js"), "utf8");
check("renderChanges disables #source while DraftStore is busy", () => {
  const rendered = new Map();
  const sourceEl = { disabled: false };
  const makeEl = () => ({ hidden: false, disabled: false, textContent: "", title: "", value: "", querySelectorAll: () => [], querySelector: () => null });
  const els = new Map([["source", sourceEl], ["change-list", makeEl()]]);
  const $ = (id) => {
    if (!els.has(id)) els.set(id, makeEl());
    return els.get(id);
  };
  const s = new DraftStore(docs);
  s.set("A", "A1");
  const box = {
    store: s,
    current: "A",
    tr: (en) => en,
    $,
    setHTML: () => {},
    renderedHTML: rendered,
    document: { querySelectorAll: (sel) => (sel.includes("#source") ? [sourceEl] : []) },
    esc: (x) => x,
    privacy: () => "",
    diffHTML,
  };
  vm.runInNewContext(`${changesSrc}; this.renderChanges = renderChanges;`, box);
  s.startSave();
  box.renderChanges(false);
  assert.equal(sourceEl.disabled, true);
  s.finishSave({ ok: true, documents: { A: { path: "A", source: "A1" } }, receipt: [] });
  box.renderChanges(false);
  assert.equal(sourceEl.disabled, false);
});

if (process.argv.includes("--browser")) {
  const { runBrowserChecks } = await import("./tests/browser.mjs");
  checks += await runBrowserChecks();
}
console.log(`\n${checks} checks passed.`);
