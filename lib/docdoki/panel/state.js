/* Document sources are the only editable state. Parsed previews are disposable views. */
class DraftStore {
  constructor(documents = {}) {
    this.base = new Map(Object.entries(documents));
    this.drafts = new Map();
    this.history = [];
    this.busy = false;
    this.version = 0;
    this.receipt = [];
  }
  source(path) {
    return this.drafts.get(path) ?? this.base.get(path)?.source ?? "";
  }
  addDocument(doc) {
    if (!this.base.has(doc.path)) this.base.set(doc.path, doc);
  }
  set(path, source, remember = true) {
    if (this.busy || !this.base.has(path)) return false;
    const before = this.source(path);
    if (before === source) return false;
    if (source === this.base.get(path).source) this.drafts.delete(path);
    else this.drafts.set(path, source);
    if (remember) this.history.push({ path, before, after: source });
    this.version++;
    return true;
  }
  undo() {
    if (this.busy) return null;
    const operation = this.history.pop();
    if (!operation) return null;
    this.set(operation.path, operation.before, false);
    return operation.path;
  }
  discard(path, latest) {
    if (this.busy || !this.base.has(path)) return false;
    if (latest) this.base.set(path, latest);
    else this.base.delete(path);
    this.drafts.delete(path);
    this.history = this.history.filter((operation) => operation.path !== path);
    // Adopting disk content invalidates pending edits even for equal text.
    this.version++;
    return true;
  }
  edits() {
    return [...this.drafts].map(([path, to]) => ({
      path,
      field: "source",
      from: this.base.get(path).source,
      to,
    }));
  }
  startSave() {
    if (this.busy || !this.drafts.size) return null;
    this.busy = true;
    return this.edits();
  }
  finishSave(result) {
    if (result.ok) {
      for (const [path, doc] of Object.entries(result.documents)) {
        this.base.set(path, doc);
        this.drafts.delete(path);
      }
      this.history = [];
      // Saved history is evidence to follow, never a draft's disk precondition.
      this.receipt.push(...result.receipt);
      this.version++;
    }
    this.busy = false;
  }
}

const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

/* Crop equal ends before a bounded DP. Large changes use complete before/after
   views instead of allocating an unbounded n*m matrix. */
function diffOps(a, b, budget = 250000) {
  let prefix = 0,
    suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;
  const aa = a.slice(prefix, a.length - suffix),
    bb = b.slice(prefix, b.length - suffix);
  if ((aa.length + 1) * (bb.length + 1) > budget) return null;
  const dp = Array.from({ length: aa.length + 1 }, () => new Uint32Array(bb.length + 1));
  for (let i = aa.length - 1; i >= 0; i--)
    for (let j = bb.length - 1; j >= 0; j--)
      dp[i][j] = aa[i] === bb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const result = a.slice(0, prefix).map((s) => ["eq", s]);
  let i = 0,
    j = 0;
  while (i < aa.length || j < bb.length) {
    if (i < aa.length && j < bb.length && aa[i] === bb[j]) {
      result.push(["eq", aa[i++]]);
      j++;
    } else if (i < aa.length && (j === bb.length || dp[i + 1][j] >= dp[i][j + 1]))
      result.push(["del", aa[i++]]);
    else result.push(["add", bb[j++]]);
  }
  return result.concat(a.slice(a.length - suffix).map((s) => ["eq", s]));
}
function wordDiffHTML(a, b) {
  const ops = diffOps(a.split(/(\s+)/), b.split(/(\s+)/), 40000);
  if (!ops) return `<del>${escapeHTML(a)}</del><ins>${escapeHTML(b)}</ins>`;
  return ops
    .map(([kind, text]) =>
      kind === "eq"
        ? escapeHTML(text)
        : `<${kind === "del" ? "del" : "ins"}>${escapeHTML(text)}</${kind === "del" ? "del" : "ins"}>`,
    )
    .join("");
}
function diffHTML(before, after) {
  const full = `<details class="full-diff"><summary data-en="Complete before / after" data-zh="完整修改前后内容">Complete before / after</summary><h4 data-en="Before" data-zh="修改前">Before</h4><pre>${escapeHTML(before)}</pre><h4 data-en="After" data-zh="修改后">After</h4><pre>${escapeHTML(after)}</pre></details>`;
  const ops = diffOps(before.split("\n"), after.split("\n"));
  if (!ops)
    return `<p data-en="View the complete change below." data-zh="请查看下方完整修改。">View the complete change below.</p>${full.replace("<details", "<details open")}`;
  let result = "",
    folded = false;
  for (let i = 0; i < ops.length; i++) {
    const [kind, text] = ops[i];
    if (kind === "eq" && !ops.slice(Math.max(0, i - 2), i + 3).some(([k]) => k !== "eq")) {
      if (!folded) result += '<div class="diff-fold">…</div>';
      folded = true;
      continue;
    }
    folded = false;
    if (kind === "del" && ops[i + 1]?.[0] === "add") {
      result += `<div class="diff-line mod">${wordDiffHTML(text, ops[++i][1])}</div>`;
    } else
      result += `<div class="diff-line ${kind}">${kind === "del" ? "− " : kind === "add" ? "+ " : "  "}${escapeHTML(text)}</div>`;
  }
  return result + full;
}

globalThis.DocDokiState = { DraftStore, diffOps, diffHTML, escapeHTML };
