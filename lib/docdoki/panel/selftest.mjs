#!/usr/bin/env node
// Self-test for the panel's client logic. Loads the real <script> embedded in panel.py
// inside a vm sandbox (Node stdlib only, no deps) and pins the pure functions:
// the diff (lcsOps / line / word), the changeset key, edge routing, the minimap transform.
//   node panel/selftest.mjs [-v]

import { readFileSync } from "node:fs";
import vm from "node:vm";

const VERBOSE = process.argv.includes("-v");
let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(cond, label) {
  if (cond) { pass++; if (VERBOSE) console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label); }
}

// --- a small library the script can render against ---
// b follows a; c and d both follow b → b fans out (slot test), a→b is lone (straight test).
const node = (id, col, after) => ({
  id: "S:" + id, kind: "spec", title: id.toUpperCase(), content: "purpose " + id,
  status: "not-started", path: "docdoki/specs/" + id + ".md", edit: ["content", "title"],
  col, claims: ["claim " + id], after, covers: [],
});
const GRAPH = {
  nodes: [node("a", 1, []), node("b", 2, ["a"]), node("c", 3, ["b"]), node("d", 3, ["b"])],
  docs: { northstar: { id: "northstar", path: "docdoki/northstar.md", title: "NS", sections: [["Mission", "m"]] }, abstract: null, stages: [] },
  meta: { title: "test" },
};

// --- minimal DOM/global stubs: enough for the top-level wiring to run once without throwing ---
function makeEl() {
  return {
    style: {}, dataset: {}, _h: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    closest() { return null; }, focus() {}, blur() {}, click() {}, select() {},
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 }; },
    clientWidth: 184, clientHeight: 120, offsetWidth: 256, offsetHeight: 104, scrollHeight: 80, scrollTop: 0,
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; },
    set textContent(v) {}, get textContent() { return ""; },
    set innerText(v) {}, get innerText() { return ""; },
    set value(v) {}, get value() { return ""; }, set placeholder(v) {}, get placeholder() { return ""; },
    set title(v) {}, get title() { return ""; }, set disabled(v) {}, get disabled() { return false; },
    set onclick(v) {}, get onclick() { return null; }, lang: "",
  };
}
const ids = {};
const document = {
  getElementById(id) { return ids[id] || (ids[id] = makeEl()); },
  querySelector() { return makeEl(); }, querySelectorAll() { return []; },
  addEventListener() {}, createElement() { return makeEl(); }, execCommand() {},
  documentElement: makeEl(),
};
const sandbox = {
  document, console,
  window: { addEventListener() {}, innerWidth: 1920, innerHeight: 1080 },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: { clipboard: null }, getSelection() { return { removeAllRanges() {}, addRange() {} }; },
  requestAnimationFrame() { return 0; }, setTimeout() { return 0; }, Math, JSON, Date,
};

// --- load the real embedded script ---
const py = readFileSync(new URL("./panel.py", import.meta.url), "utf8");
let src = py.slice(py.indexOf("<script>") + "<script>".length, py.indexOf("</script>"));
src = src.replace("__GRAPH_JSON__", () => JSON.stringify(GRAPH));
src += "\n;globalThis.__API={lcsOps,chKey,lineDiff,wordDiffHTML,diffHTML,sidesFor,centerOf,portAt,routeEdges,edgePath,miniRect,miniToWorld,makeMinimapState,boundsOf,layout};";

console.log("load (top-level wiring runs against stubs)");
let API;
try {
  vm.runInNewContext(src, sandbox);
  API = sandbox.__API;
  check(!!API && typeof API.lcsOps === "function", "panel script loads and renders without throwing");
} catch (e) {
  check(false, "panel script loads without throwing — " + e.message);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}

const { lcsOps, chKey, lineDiff, wordDiffHTML, diffHTML, sidesFor, routeEdges, edgePath, miniRect, miniToWorld, makeMinimapState, boundsOf, layout } = API;

console.log("diff — one LCS at line and word level");
check(eq(lcsOps(["a", "b", "c"], ["a", "x", "c"]), [["eq", "a"], ["del", "b"], ["add", "x"], ["eq", "c"]]), "lcsOps marks eq/del/add");
check(eq(lineDiff("a\nb", "a\nc"), [["eq", "a"], ["del", "b"], ["add", "c"]]), "lineDiff splits on newlines");
const wd = wordDiffHTML("the red fox", "the blue fox");
check(/w-del">red</.test(wd) && /w-add">blue</.test(wd) && !/w-(del|add)">the/.test(wd), "wordDiffHTML marks only the changed word");
check(/dl mod/.test(diffHTML("a b c\nz", "a B c\nz")) && /w-del|w-add/.test(diffHTML("a b c\nz", "a B c\nz")), "in-place line edit becomes a word-marked mod row");
const delOnly = diffHTML("l1\nl2\nl3", "l1\nl3");
check(/dl del/.test(delOnly) && !/w-(del|add)/.test(delOnly), "a removed line stays a whole struck line, no word marks");

console.log("changeset key");
check(chKey("S:m", "progress") === "S:m|progress", "scalar field key has no sub");
check(chKey("S:m", "claim", 0) === "S:m|claim|0", "claim key carries the index (0 included)");
check(chKey("id", "section", "Mission") === "id|section|Mission", "section key carries the name");

console.log("edge routing — deterministic, geometry-only");
check(eq(sidesFor({ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 0, w: 100, h: 100 }), ["right", "left"]), "horizontal neighbours route right→left");
check(eq(sidesFor({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 300, w: 100, h: 100 }), ["bottom", "top"]), "vertical neighbours route bottom→top");
const L = layout(), R = routeEdges(L);
check(R.length === 3, "three edges routed (a→b, b→c, b→d)");
const ab = R.find(x => x.from === "S:a" && x.to === "S:b");
check(ab && ab.os === 0 && ab.ot === 0, "lone edge keeps the center slot (straight)");
const outB = R.filter(x => x.from === "S:b");
check(outB.length === 2 && outB[0].os !== outB[1].os, "fan-out siblings get distinct slots");
check(R.every(x => !/NaN|undefined/.test(edgePath(x))), "every edge path is finite");

console.log("minimap transform — exact inverse");
const m = makeMinimapState(L), p0 = { x: 137, y: 88 };
const rr = miniRect({ x: p0.x, y: p0.y, w: 0, h: 0 }, m), back = miniToWorld(rr.x, rr.y, m);
check(Math.abs(back.x - p0.x) + Math.abs(back.y - p0.y) < 1e-6, "world → minimap → world round-trips");
const b = boundsOf(["S:a", "S:b"], L.pos);
check(Number.isFinite(b.w) && Number.isFinite(b.h) && b.w > 0, "boundsOf returns a finite rect");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
