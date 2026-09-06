/* DOM views consume parsed previews; only DraftStore owns editable sources. */
const $ = id => document.getElementById(id);
const esc = escapeHTML;
let graph = INITIAL_GRAPH;
let store = new DraftStore(graph.documents);
let lang = "en";
try { lang = localStorage.getItem("ddpanel-lang") === "zh" ? "zh" : "en"; } catch {}
const tr = (en, zh) => lang === "zh" ? zh : en;
let current = "docdoki/spec_abstract.md", view = "doc", editing = false, navigationSequence = 0;
let query = "", previewTimer = null, previewSequence = 0, latestDocument = null, composing = false;
const diffCache = new Map();
let changeTimer = null, pendingCount = 0;
const archiveOpen = new Set();
const renderedHTML = new WeakMap();
let previewPending = false, previewError = null, copySequence = 0;
function setHTML(element, html) {
  if (renderedHTML.get(element) === html) return false;
  element.innerHTML = html; renderedHTML.set(element, html); return true;
}

function localize() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-en]").forEach(el => { el.textContent = el.dataset[lang]; });
  document.querySelectorAll("[data-en-label]").forEach(el => el.setAttribute("aria-label", el.dataset[lang + "Label"]));
  $("language").textContent = lang === "zh" ? "EN" : "中";
  $("search").placeholder = tr("Search documents and drafts", "搜索文档及草稿");
  renderPreviewStatus();
}
function status(message, error = false) {
  if ($("status").textContent !== message) $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function privacy(doc) { return doc?.private ? `<span class="private-tag">${tr("Private", "私有")}</span>` : ""; }
function draftTag(path) { return store.drafts.has(path) ? `<span class="draft-tag">${tr("Draft", "草稿")}</span>` : ""; }
function docButton(doc) {
  return `<button class="doc-link ${doc.path === current && view === "doc" ? "selected" : ""}" ${doc.path === current && view === "doc" ? 'aria-current="page"' : ""} data-doc="${esc(doc.path)}">${esc(doc.title)}${privacy(doc)}${draftTag(doc.path)}<small>${esc(doc.path)}</small></button>`;
}
function matches(doc) {
  const q = query.toLocaleLowerCase();
  return !q || [doc.title, doc.path, store.source(doc.path)].some(value => String(value || "").toLocaleLowerCase().includes(q));
}
function catalogEntry(path) { return graph.catalog.find(d => d.path === path); }
function currentDocument() { return graph.documents[current] || store.base.get(current); }
function syncDrawers() {
  const mobile = window.innerWidth <= 760;
  const library = mobile ? $("app").classList.contains("library-open") : !$("app").classList.contains("library-closed");
  const changes = $("app").classList.contains("changes-open");
  $("library").inert = !library;
  $("changes").inert = !changes;
  $("workspace").inert = (mobile && library) || (window.innerWidth <= 1100 && changes);
  if (!library && $("library").contains(document.activeElement)) $("library-toggle").focus();
  if (!changes && $("changes").contains(document.activeElement)) $("changes-toggle").focus();
  if ($("workspace").inert && $("workspace").contains(document.activeElement)) $(changes ? "changes-close" : "library-close").focus();
  $("library-toggle").setAttribute("aria-expanded", String(library));
  $("changes-toggle").setAttribute("aria-expanded", String(changes));
}
function setChanges(open, focus = false) {
  const restore = !open && $("changes").contains(document.activeElement);
  $("app").classList.toggle("changes-open", open);
  if (open && window.innerWidth <= 760) $("app").classList.remove("library-open");
  syncDrawers();
  if (open && focus) $("changes-close").focus();
  else if (restore) $("changes-toggle").focus();
}
function setLibrary(open, focus = false) {
  const mobile = window.innerWidth <= 760;
  const restore = !open && $("library").contains(document.activeElement);
  $("app").classList.toggle(mobile ? "library-open" : "library-closed", mobile ? open : !open);
  if (mobile && open) $("app").classList.remove("changes-open");
  syncDrawers();
  if (open && focus) $("library").querySelector(mobile ? "#library-close" : "[data-nav]").focus();
  else if (restore) $("library-toggle").focus();
}
function focusDocument(anchor = "") {
  const heading = anchor ? document.getElementById("heading-" + slug(anchor)) :
    $("reading").querySelector("h1") || $("view-title");
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); if (anchor) heading.scrollIntoView(); }
}
function draftSummary() {
  return store.drafts.size ? tr(`${store.drafts.size} document(s) with unsaved changes.`, `${store.drafts.size} 份文档有未保存修改。`) : tr("No unsaved changes.", "没有未保存修改。");
}
function updateMeta() {
  $("project-name").textContent = graph.meta.title;
  $("project-path").textContent = graph.meta.root + (graph.meta.branch ? " · " + graph.meta.branch : "");
  $("snapshot").textContent = tr("Loaded ", "加载于 ") + graph.meta.loadedAt + " · " +
    (graph.meta.includesPrivate ? tr("Includes private documents", "包含私有文档") : tr("Shared documents only", "仅共享文档"));
}
function renderCatalog() {
  $("catalog").querySelectorAll("details").forEach(el => {
    if (el.open) archiveOpen.add(el.dataset.group); else archiveOpen.delete(el.dataset.group);
  });
  const groups = [["spec", tr("Specs", "规格")], ["stage", tr("Active stages", "进行中阶段")], ["note", tr("Notes · load on demand", "笔记 · 按需读取")]];
  let html = "";
  for (const [kind, label] of groups) {
    const docs = graph.catalog.filter(d => d.kind === kind && !d.archived && matches(d));
    if (!docs.length) continue;
    html += `<section class="catalog-group"><h3>${label}</h3>${docs.map(docButton).join("")}</section>`;
  }
  const archived = graph.catalog.filter(d => d.archived && matches(d));
  if (archived.length) html += `<details class="catalog-group" data-group="archive" ${archiveOpen.has("archive") || query ? "open" : ""}><summary>${tr("Archive", "归档")} (${archived.length})</summary>${archived.map(docButton).join("")}</details>`;
  if (query) html = `<p class="notice">${tr("Search covers titles, paths and loaded text, including drafts. Notes and archives load when opened.", "搜索标题、路径和已加载的正文（含草稿）；笔记与归档在打开时加载。")}</p>` + html;
  setHTML($("catalog"), html || `<p class="notice">${tr("No matching documents.", "没有匹配文档。")}</p>`);
}

/* Marked handles Markdown structure. HTML is escaped; links are resolved against
   the catalog and image URLs are never fetched implicitly. */
function resolveLink(href, from = current) {
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return { external: href };
  if (href.startsWith("#")) return { path: from, anchor: href.slice(1) };
  let target = href, anchor = "";
  const hash = target.indexOf("#");
  if (hash >= 0) { anchor = target.slice(hash + 1); target = target.slice(0, hash); }
  try { target = decodeURIComponent(target); anchor = decodeURIComponent(anchor); } catch { return null; }
  if (target.startsWith("wiki:")) {
    const stem = target.slice(5).replace(/\.md$/, "");
    const found = graph.catalog.filter(d => d.stem === stem || d.path === stem || d.path === stem + ".md");
    return found.length === 1 ? { path: found[0].path, anchor } : null;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) return null;
  const components = target.startsWith("docdoki/") ? [] : from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") components.pop(); else if (part && part !== ".") components.push(part);
  }
  const path = components.join("/");
  const found = graph.catalog.find(d => d.path === path);
  return found ? { path: found.path, anchor } : null;
}
function linkHTML(href, label) {
  const resolved = resolveLink(href);
  if (!resolved) return `<span class="unresolved" title="${esc(href)}">${label} [${tr("unresolved link", "未解析链接")}]</span>`;
  if (resolved.external) return `<a href="${esc(resolved.external)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  return `<a href="#${encodeURIComponent(resolved.path)}" data-doc="${esc(resolved.path)}" data-anchor="${esc(resolved.anchor)}">${label}</a>`;
}
const mdRenderer = new marked.Renderer();
mdRenderer.html = token => esc(token.text);
mdRenderer.link = function(token) { return linkHTML(token.href, this.parser.parseInline(token.tokens)); };
mdRenderer.image = token => `<span class="source-link">${tr("Image reference", "图片引用")}: ${linkHTML(token.href, esc(token.text || token.href))}</span>`;
const markdown = new marked.Marked({ gfm: true, renderer: mdRenderer });
markdown.use({ extensions: [{
  name: "wikilink", level: "inline", start: src => src.indexOf("[["),
  tokenizer(src) {
    const match = /^\[\[([^\]\n]+)\]\]/.exec(src);
    if (!match) return undefined;
    const [target, label] = match[1].split("|", 2);
    return { type: "wikilink", raw: match[0], target, label: label || target };
  },
  renderer: token => linkHTML("wiki:" + token.target, esc(token.label)),
}] });
function renderMarkdown(body) { return markdown.parse(body); }
function slug(text) { return text.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}_ -]/gu, "").replace(/\s+/g, "-"); }
function headingAnchors() {
  const seen = new Map();
  $("reading").querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(el => {
    const key = slug(el.textContent), index = seen.get(key) || 0;
    seen.set(key, index + 1);
    el.id = "heading-" + key + (index ? "-" + index : "");
  });
}
function renderDiagnostics() {
  const diagnostics = graph.diagnostics || [];
  $("diagnostics").hidden = !diagnostics.length;
  $("diagnostics").innerHTML = `<strong>${tr("Document diagnostics", "文档诊断")}</strong><ul>` + diagnostics.map(d =>
    `<li><button data-doc="${esc(d.path)}">${esc(d.path)}</button>: ${esc(d.message)}</li>`).join("") + "</ul>";
}
function renderRelated(doc) {
  const related = Object.values(graph.documents).filter(d => d.path !== doc.path &&
    (d.source.includes("[[" + doc.stem + "]]") || d.source.includes("[[" + doc.stem + "#") ||
     d.source.includes("[[" + doc.stem + "|") || d.source.includes(doc.path)));
  let content = `<strong>${tr("Documents mentioning this source", "引用此来源的文档")}</strong>` +
    (related.length ? related.map(docButton).join("") : `<p>${tr("None among loaded documents.", "已加载文档中没有找到。")}</p>`);
  const node = graph.nodes.find(n => n.path === doc.path);
  if (node) {
    content += `<p class="manual-label">${planLabel(node.progress)}. ${tr("This is an explicit planning label, not implementation or acceptance evidence.", "这是显式计划标记，不是实现或验收证据。")}</p>`;
    content += `<details class="relation-controls"><summary>${tr("Edit dependencies", "编辑依赖")}</summary><p>${tr("Choose an upstream spec required by this one. Structural validation runs before staging the change.", "选择本规格依赖的上游规格；加入草稿前会进行结构检查。")}</p>`;
    const options = graph.nodes.filter(n => n.path !== doc.path && (!n.private || doc.private));
    content += `<select id="dependency-target" aria-label="${tr("Upstream dependency", "上游依赖")}"><option value="">${tr("Choose dependency…", "选择依赖…")}</option>${options.map(n => `<option value="${esc(n.stem)}">${esc(n.title)}</option>`).join("")}</select><button id="add-dependency">${tr("Add dependency", "添加依赖")}</button>`;
    const after = Array.isArray(node.after) ? node.after : [];
    content += after.map(stem => `<p>${esc(stem)} → ${esc(doc.stem)} <button data-remove-after="${esc(stem)}" data-path="${esc(doc.path)}">${tr("Remove dependency", "删除依赖")}</button></p>`).join("") + "</details>";
  }
  setHTML($("related"), content);
}
function showDocument() {
  const doc = currentDocument();
  $("view-title").textContent = doc?.title || tr("Project overview", "项目总览");
  $("document-path").innerHTML = esc(current) + privacy(doc) + draftTag(current);
  if (!doc) {
    setHTML($("reading"), `<h2>${tr("Overview not recorded", "尚未记录总览")}</h2><p>${tr("Use the document navigation to inspect existing sources. The panel does not infer project status.", "可从文档导航检查现有来源；看板不会推断项目状态。")}</p>`);
    setHTML($("related"), "");
    editing = false;
  } else {
    if (setHTML($("reading"), renderMarkdown(doc.body))) headingAnchors();
    renderRelated(doc);
  }
  // Keep the real Markdown H1 (and its anchors/inline content), not a duplicate.
  $("view-title").hidden = !editing && $("reading").firstElementChild?.tagName === "H1";
  $("reader").hidden = editing;
  $("editor").hidden = !editing;
  $("read-mode").setAttribute("aria-pressed", String(!editing));
  $("edit-mode").setAttribute("aria-pressed", String(editing));
  $("read-mode").classList.toggle("active", !editing);
  $("edit-mode").classList.toggle("active", editing);
  $("edit-mode").disabled = !doc || store.busy;
  $("latest").disabled = !doc || store.busy;
}
function renderWork() {
  $("view-title").textContent = tr("Current work", "当前工作");
  $("document-path").textContent = tr("Facts and next steps are maintained in active stages; open a source for the complete record.", "事实与下一步由进行中的阶段文档维护；打开来源查看完整记录。");
  const docs = Object.values(graph.documents).filter(d => d.kind === "stage" && !d.archived);
  setHTML($("reading"), docs.length ? docs.map(d => `<section><h2>${linkHTML("docdoki/" + d.path.split("docdoki/")[1], esc(d.title))}${privacy(d)}${draftTag(d.path)}</h2><p class="source-link">${esc(d.path)}</p></section>`).join("") : `<p>${tr("No active stages recorded.", "没有记录进行中的阶段。")}</p>`);
  setHTML($("related"), "");
}
function renderMain() {
  $("view-title").hidden = false;
  const active = view === "doc" ? (current === "docdoki/spec_abstract.md" ? "overview" : current === "docdoki/northstar.md" ? "northstar" : null) : view === "work" ? "work" : "specs";
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.classList.toggle("active", el.dataset.nav === active);
    if (el.dataset.nav === active) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
  });
  $("view-actions").hidden = view !== "doc";
  $("spec-actions").hidden = !["list", "graph"].includes(view);
  $("reader").hidden = !["doc", "work"].includes(view) || editing;
  $("editor").hidden = view !== "doc" || !editing;
  $("spec-list").hidden = view !== "list";
  $("graph").hidden = view !== "graph";
  if (view === "doc") showDocument();
  else if (view === "work") renderWork();
  else {
    $("view-title").textContent = tr("Specs", "规格");
    $("document-path").textContent = tr("Decided design contracts; implementation progress comes from the overview and stages.", "已决定的设计契约；实现进度请以总览和阶段文档为依据。");
    $("list-view").classList.toggle("active", view === "list");
    $("graph-view").classList.toggle("active", view === "graph");
    if (view === "list") renderSpecList(); else renderGraph();
  }
  $("workspace").setAttribute("aria-label", $("view-title").textContent);
  localize();
}
async function request(route, payload, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { "X-DocDoki-Token": SAVE_TOKEN };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(route, { method: payload === undefined ? "GET" : "POST", headers,
      body: payload === undefined ? undefined : JSON.stringify(payload), signal: controller.signal });
    const result = await response.json();
    if (!response.ok && !result.error) throw new Error("HTTP " + response.status);
    return result;
  } finally { clearTimeout(timer); }
}
function renderPreviewStatus() {
  $("preview-status").hidden = !previewPending && !previewError;
  $("preview-status").classList.toggle("preview-error", !!previewError);
  $("preview-status").setAttribute("aria-live", previewError ? "polite" : "off");
  const message = previewError ? tr("Preview unavailable; draft retained; showing the last parsed view: ", "预览不可用，草稿已保留，当前显示上次解析结果：") + previewError : tr("Updating preview…", "预览更新中…");
  if ($("preview-status").textContent !== message) $("preview-status").textContent = message;
  $("reading").setAttribute("aria-busy", String(previewPending));
}
function schedulePreview() {
  clearTimeout(previewTimer);
  previewSequence++;
  previewPending = true; previewError = null; renderPreviewStatus();
  previewTimer = setTimeout(updatePreview, 200);
}
async function updatePreview() {
  clearTimeout(previewTimer);
  const sequence = ++previewSequence, version = store.version;
  if (store.busy) return;
  try {
    const result = await request("/preview", { edits: store.edits(), base: Object.fromEntries([...store.base].map(([p, d]) => [p, d.source])), extra: [...store.base.keys()] });
    if (sequence !== previewSequence || version !== store.version || store.busy) return;
    if (!result.ok) throw new Error(result.error);
    graph = result.graph;
    // A preview must never silently replace a baseline or an active textarea.
    previewPending = false; previewError = null; renderPreviewStatus();
    renderDiagnostics(); renderCatalog(); renderMain();
  } catch (error) {
    if (sequence !== previewSequence) return;
    previewPending = false; previewError = error.message; renderPreviewStatus();
  }
}
function finishEditing() { store.end(); renderChanges(false); }
async function openDocument(path, anchor = "") {
  if (store.busy) return;
  const navigation = ++navigationSequence;
  finishEditing();
  if (!store.base.has(path)) {
    try {
      const doc = await request("/document?path=" + encodeURIComponent(path));
      if (doc.error && !doc.source) throw new Error(doc.error);
      if (navigation !== navigationSequence || store.busy) return;
      store.addDocument(doc); graph.documents[path] = doc;
      const entry = catalogEntry(path); if (entry) entry.title = doc.title;
    } catch (error) { status(error.message, true); return; }
  }
  current = path; view = "doc"; editing = false; latestDocument = null;
  $("comparison").hidden = true;
  renderMain(); renderCatalog();
  if (window.innerWidth <= 760) setLibrary(false);
  if (window.innerWidth <= 1100) setChanges(false);
  $("workspace").scrollTop = 0;
  focusDocument(anchor);
}
function navigate(next) {
  if (store.busy) return;
  navigationSequence++;
  finishEditing(); editing = false; $("comparison").hidden = true;
  if (next === "overview") return openDocument("docdoki/spec_abstract.md");
  if (next === "northstar") return openDocument("docdoki/northstar.md");
  view = next === "specs" ? "list" : next;
  renderMain();
  if (window.innerWidth <= 760) setLibrary(false);
  if (window.innerWidth <= 1100) setChanges(false);
  $("view-title").tabIndex = -1; $("view-title").focus({ preventScroll: true });
}

/* Pending changes and receipts are separate, memory-only products. */
function renderChanges(details = true) {
  const edits = store.edits();
  if (edits.length && !pendingCount && window.innerWidth > 1100) setChanges(true);
  $("app").classList.toggle("has-drafts", !!edits.length);
  pendingCount = edits.length;
  $("count").textContent = edits.length;
  $("save").disabled = store.busy || !edits.length;
  $("save").textContent = store.busy ? tr("Saving…", "保存中…") : tr("Save documents", "保存文档");
  $("copy-drafts").disabled = store.busy || !edits.length;
  $("copy-receipt").disabled = store.busy || !store.receipt.length;
  $("export").disabled = !edits.length;
  $("undo").disabled = store.busy || (!store.history.length && !store.session);
  $("source").readOnly = store.busy;
  for (const id of ["refresh", "edit-mode", "latest", "rebase", "read-mode"]) $(id).disabled = store.busy || (["edit-mode", "latest"].includes(id) && !store.base.has(current));
  const paths = new Set(edits.map(e => e.path));
  for (const key of diffCache.keys()) if (!paths.has(key)) diffCache.delete(key);
  if (details) {
    const list = $("change-list");
    const existing = new Map([...list.querySelectorAll(".change")].map(el => [el.dataset.path, el]));
    for (const [path, el] of existing) if (!paths.has(path)) el.remove();
    if (!edits.length) setHTML(list, `<p>${tr("No unsaved changes.", "没有未保存修改。")}</p>`);
    else {
      list.querySelector(":scope > p")?.remove(); renderedHTML.delete(list);
      for (const edit of edits) {
        const cached = diffCache.get(edit.path);
        if (!cached || cached.from !== edit.from || cached.to !== edit.to)
          diffCache.set(edit.path, { from: edit.from, to: edit.to, html: diffHTML(edit.from, edit.to) });
        let el = existing.get(edit.path);
        if (!el) {
          el = document.createElement("section"); el.className = "change"; el.dataset.path = edit.path;
          el.innerHTML = '<header></header><div class="change-diff"></div>'; list.append(el);
        }
        setHTML(el.querySelector("header"), `<button data-restore="${esc(edit.path)}" ${store.busy ? "disabled" : ""}>${tr("Restore file", "恢复文件")}</button>${esc(edit.path)}${privacy(store.base.get(edit.path))}`);
        const diff = el.querySelector(".change-diff"), full = diff.querySelector("details");
        const open = full?.open, focused = document.activeElement === full?.querySelector("summary");
        if (setHTML(diff, diffCache.get(edit.path).html)) {
          if (open) diff.querySelector("details").open = true;
          if (focused) diff.querySelector("summary").focus({ preventScroll: true });
        }
      }
      list.querySelectorAll("[data-en]").forEach(el => { el.textContent = el.dataset[lang]; });
    }
  }
  const hasPrivate = edits.some(e => store.base.get(e.path)?.private) || store.receipt.some(e => e.private);
  $("private-warning").hidden = !hasPrivate;
  $("private-warning").textContent = tr("Private content is included. Copy or export only to a trusted destination.", "包含私有内容。仅复制或导出到可信位置。");
  $("receipt-summary").textContent = store.receipt.length ? tr("Last save: ", "上次保存：") + store.receipt.map(e => e.path).join(", ") + tr(". Documents saved; implementation not aligned by the panel.", "。仅保存了文档，看板未对齐实现。") : "";
}
function changed(action = tr("Draft updated.", "草稿已更新。"), path = current) {
  clearPrompt();
  renderChanges(false); renderCatalog();
  clearTimeout(changeTimer); changeTimer = setTimeout(renderChanges, 150);
  if (view === "doc") $("document-path").innerHTML = esc(current) + privacy(currentDocument()) + draftTag(current);
  status(`${action} ${path} · ${draftSummary()}`);
  schedulePreview();
}
function buildPrompt(saved = false) {
  const edits = saved ? store.receipt : store.edits();
  const intro = saved
    ? tr("These human document edits have already been saved. Read the affected files and follow the changed intent within the authorized scope. Do not apply this patch again. Saving documents is not evidence that implementation is aligned.", "这些人类文档修改已经保存。请读取受影响文件，在授权范围内 follow 变更意图。不要再次应用这些修改；保存文档不表示实现已对齐。")
    : tr("These are UNSAVED human document edits. Check their baseline against the files before applying them; then follow the intent within the authorized scope. Preserve unrelated work and public/private boundaries.", "这些是尚未保存的人类文档修改。请核对文件基线后应用，再在授权范围内 follow 意图。保留无关工作和公私边界。");
  return intro + "\n\n" + tr("Project: ", "项目：") + graph.meta.root + "\n\n" + edits.map(e =>
    e.path + ((e.private || store.base.get(e.path)?.private) ? " [PRIVATE]" : " [SHARED]") +
    "\n--- BEFORE ---\n" + e.from + "\n--- AFTER ---\n" + e.to).join("\n\n");
}
function clearPrompt() {
  copySequence++;
  $("prompt-label").hidden = $("prompt").hidden = true;
  $("prompt").value = "";
}
async function copyPrompt(saved) {
  if (store.busy) return;
  finishEditing();
  const sequence = ++copySequence;
  const text = buildPrompt(saved);
  $("prompt-label").hidden = $("prompt").hidden = false;
  $("prompt").value = text;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    if (sequence !== copySequence) return;
    status(tr("Request copied.", "请求已复制。"));
  } catch (error) {
    if (sequence !== copySequence) return;
    $("prompt").focus(); $("prompt").select();
    status(tr("Copy failed. The complete request is selected for manual copying: ", "复制失败。已选中完整请求，请手动复制：") + error.message, true);
  }
}
async function save() {
  const edits = store.startSave();
  if (!edits) return;
  clearPrompt();
  clearTimeout(previewTimer); previewSequence++;
  previewPending = false; previewError = null; renderPreviewStatus();
  renderChanges(); status(tr("Saving captured draft batch…", "正在保存已捕获的草稿批次…"));
  try {
    const result = await request("/save", { edits });
    store.finishSave(result);
    renderChanges();
    if (!result.ok) {
      status(tr("Save failed; drafts retained. Use Compare latest to resolve conflicts. ", "保存失败，草稿已保留；可比较磁盘最新版本以处理冲突。") + result.error, true);
    } else {
      Object.assign(graph.documents, result.documents);
      if (editing) $("source").value = store.source(current);
      latestDocument = null; $("comparison").hidden = true;
      status(tr("Documents saved. Copy the saved-change follow request to align implementation.", "文档已保存。可复制已保存修改的 follow 请求来对齐实现。"));
      await updatePreview();
    }
  } catch (error) {
    store.finishSave({ ok: false });
    status(tr("Save outcome is unknown; drafts retained. Compare latest before retrying. ", "保存结果未知，草稿已保留；重试前请比较磁盘最新版本。") + error.message, true);
  }
  renderChanges(); renderCatalog();
}
async function compareLatest() {
  if (store.busy) return;
  const path = current;
  finishEditing();
  try {
    const doc = await request("/document?path=" + encodeURIComponent(current));
    if (!doc.source && doc.error) throw new Error(doc.error);
    if (current !== path || store.busy) return;
    latestDocument = doc;
    $("latest-source").textContent = doc.source;
    $("comparison").hidden = false;
    $("rebase").disabled = store.busy;
    status(doc.source === store.base.get(current)?.source ? tr("Disk still matches this baseline.", "磁盘仍与当前基线一致。") : tr("External changes found. Compare and merge before saving.", "发现外部修改。保存前请比较并合并。"));
  } catch (error) { status(error.message, true); }
}
async function refresh() {
  if (store.busy) return;
  finishEditing();
  if (store.drafts.size && !confirm(tr("Refresh will discard all unsaved drafts. Export them first if needed. Continue?", "刷新将丢弃全部未保存草稿；如需保留，请先导出。继续？"))) return;
  const previous = store, version = store.version;
  try {
    const snapshot = await request("/snapshot");
    if (snapshot.error) throw new Error(snapshot.error);
    if (store !== previous || store.version !== version || store.busy) {
      status(tr("Refresh not applied because editing continued; drafts retained.", "刷新期间编辑仍在继续，未应用新快照，草稿已保留。"));
      return;
    }
    const receipt = store.receipt;
    graph = snapshot; store = new DraftStore(snapshot.documents); store.receipt = receipt;
    navigationSequence++;
    editing = false; latestDocument = null; previewSequence++; clearTimeout(previewTimer); diffCache.clear();
    previewPending = false; previewError = null; renderPreviewStatus();
    $("comparison").hidden = true; clearPrompt();
    if (!store.base.has(current)) current = "docdoki/spec_abstract.md";
    updateMeta(); renderMain(); renderCatalog(); renderChanges(); renderDiagnostics();
    status(tr("Fresh snapshot loaded.", "已加载最新快照。"));
  } catch (error) { status(tr("Refresh failed; current drafts retained: ", "刷新失败，当前草稿已保留：") + error.message, true); }
}
async function changeDependency(path, stem, remove) {
  if (store.busy || !stem) return;
  finishEditing();
  const node = graph.nodes.find(n => n.path === path);
  if (!node || !Array.isArray(node.after) && node.after != null) return;
  const after = node.after || [];
  if (!remove && after.includes(stem)) return;
  const items = remove ? after.filter(s => s !== stem) : [...after, stem];
  const version = store.version;
  try {
    const result = await request("/preview", { edits: store.edits(), base: Object.fromEntries([...store.base].map(([p, d]) => [p, d.source])), after: { path, items } });
    if (store.busy || version !== store.version) throw new Error(tr("Draft changed while checking dependencies; retry.", "校验依赖时草稿已变化，请重试。"));
    if (!result.ok) throw new Error(result.error);
    store.set(path, result.graph.documents[path].source);
    graph = result.graph;
    if (editing && current === path) $("source").value = store.source(path);
    $("edge-detail").hidden = true;
    changed(); renderMain();
    status(tr("Dependency change staged, not saved.", "依赖修改已加入草稿，尚未保存。"));
  } catch (error) { status(error.message, true); }
}

/* Canvas layout and geometry do not own document or editing state. */
let scale = 1, pan = { x: 0, y: 0 }, positions = new Map(), offsets = new Map(), edgeViews = [];
let drag = null, frame = null, graphReady = false, zoomLocked = false, selectedNode = null;
let miniBounds = { x: 0, y: 0, w: 1, h: 1 }, miniRects = new Map();
function planLabel(progress) {
  if (!progress) return tr("Plan label: not recorded", "计划标记：未记录");
  const names = { "not-started": tr("not started", "未开始"), "in-progress": tr("in progress", "进行中"), done: tr("done", "完成") };
  return tr("Manual plan: ", "人工计划：") + (names[progress] || progress);
}
function cardHTML(node, graphCard = false) {
  return `<section tabindex="0" aria-label="${esc(node.title)}" class="spec-card plan-${esc(node.progress || "unknown")} ${store.drafts.has(node.path) ? "dirty" : ""}" data-node="${esc(node.path)}"><header ${graphCard ? `data-drag="${esc(node.path)}"` : ""}>${esc(node.title)}${privacy(node)}</header><div class="ribbon">${esc(node.content || tr("No purpose recorded.", "尚未记录用途。"))}</div><div class="card-foot"><span class="manual-label">${esc(planLabel(node.progress))}</span><button data-doc="${esc(node.path)}">${tr("Read full", "阅读全文")}</button></div></section>`;
}
function renderSpecList() { $("spec-list").innerHTML = graph.nodes.filter(matches).map(n => cardHTML(n)).join("") || `<p>${tr("No matching specs.", "没有匹配规格。")}</p>`; }
function layoutNodes(nodes, dragOffsets = new Map()) {
  const columns = new Map();
  for (const node of nodes) {
    if (!columns.has(node.col)) columns.set(node.col, []);
    columns.get(node.col).push(node);
  }
  const result = new Map();
  for (const [col, list] of columns) list.forEach((node, i) => {
    const offset = dragOffsets.get(node.path) || { x: 0, y: 0 };
    result.set(node.path, { x: 36 + (col - 1) * 410 + offset.x, y: 60 + i * 215 + offset.y, w: 280, h: 180 });
  });
  return result;
}
function edgePath(a, b) {
  const right = b.x + b.w / 2 >= a.x + a.w / 2;
  const x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
  const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2, bend = Math.max(35, Math.min(160, Math.abs(x2 - x1) / 2));
  return `M${x1},${y1} C${x1 + (right ? bend : -bend)},${y1} ${x2 - (right ? bend : -bend)},${y2} ${x2},${y2}`;
}
function transform() {
  $("viewport").style.transform = `translate(${pan.x}px,${pan.y}px) scale(${scale})`;
  $("zoom-label").textContent = Math.round(scale * 100) + "%" + (zoomLocked ? " 🔒" : "");
  $("zoom-label").setAttribute("aria-pressed", String(zoomLocked));
  updateMiniView();
}
function renderGraph() {
  positions = layoutNodes(graph.nodes, offsets);
  $("graph-cards").innerHTML = graph.nodes.map(n => cardHTML(n, true)).join("");
  const byPath = new Map(graph.nodes.map(n => [n.path, n]));
  for (const el of $("graph-cards").children) {
    const p = positions.get(el.dataset.node);
    el.style.transform = `translate(${p.x}px,${p.y}px)`;
    el.style.opacity = matches(byPath.get(el.dataset.node)) ? "1" : ".3";
  }
  const byStem = new Map(graph.nodes.map(n => [n.stem, n]));
  edgeViews = [];
  for (const node of graph.nodes) for (const stem of node.validAfter || []) {
    const from = byStem.get(stem); if (from) edgeViews.push({ from: from.path, to: node.path, stem });
  }
  $("edge-lines").innerHTML = edgeViews.map((edge, index) => {
    const d = edgePath(positions.get(edge.from), positions.get(edge.to));
    return `<path class="edge-hit" data-edge="${index}" d="${d}"></path><path class="edge" data-edge="${index}" d="${d}"></path>`;
  }).join("");
  const paths = [...$("edge-lines").children];
  for (let i = 0; i < edgeViews.length; i++) edgeViews[i].elements = paths.slice(i * 2, i * 2 + 2);
  if (!graphReady) { pan = { x: 0, y: 0 }; scale = 1; graphReady = true; }
  renderMinimap(); selectNode(selectedNode); transform();
}
function fitGraph() {
  if (!positions.size || zoomLocked) return;
  const values = [...positions.values()];
  const left = Math.min(...values.map(p => p.x)), top = Math.min(...values.map(p => p.y));
  const right = Math.max(...values.map(p => p.x + p.w)), bottom = Math.max(...values.map(p => p.y + p.h));
  const bounds = $("graph").getBoundingClientRect();
  scale = Math.min(1, Math.max(.25, Math.min((bounds.width - 50) / (right - left), (bounds.height - 110) / (bottom - top))));
  pan = { x: (bounds.width - (right - left) * scale) / 2 - left * scale, y: 50 - top * scale };
  transform();
}
function zoom(factor, focus) {
  if (zoomLocked) return;
  const old = scale, next = Math.max(.25, Math.min(2, old * factor)), box = $("graph").getBoundingClientRect();
  const x = focus?.x ?? box.width / 2, y = focus?.y ?? box.height / 2;
  pan.x = x - (x - pan.x) * next / old;
  pan.y = y - (y - pan.y) * next / old;
  scale = next; transform();
}
function selectNode(path) {
  selectedNode = path;
  const neighbors = new Set([path]);
  for (const edge of edgeViews) if (edge.from === path || edge.to === path) { neighbors.add(edge.from); neighbors.add(edge.to); }
  const matched = new Set(graph.nodes.filter(matches).map(n => n.path));
  for (const el of $("graph-cards").children) {
    el.classList.toggle("selected", el.dataset.node === path);
    el.classList.toggle("search-match", !!query && matched.has(el.dataset.node));
    el.style.opacity = matched.has(el.dataset.node) && (!path || neighbors.has(el.dataset.node)) ? "1" : ".3";
  }
  for (const edge of edgeViews) for (const el of edge.elements) el.classList.toggle("selected", edge.from === path || edge.to === path);
}
function updateMiniView() {
  const box = $("graph").getBoundingClientRect(), rect = $("mini-view");
  rect.setAttribute("x", -pan.x / scale); rect.setAttribute("y", -pan.y / scale);
  rect.setAttribute("width", box.width / scale); rect.setAttribute("height", box.height / scale);
}
function renderMinimap() {
  const values = [...positions.values()];
  if (!values.length) { $("mini-nodes").innerHTML = ""; return; }
  const left = Math.min(...values.map(p => p.x)), top = Math.min(...values.map(p => p.y));
  const right = Math.max(...values.map(p => p.x + p.w)), bottom = Math.max(...values.map(p => p.y + p.h));
  miniBounds = { x: left - 20, y: top - 20, w: right - left + 40, h: bottom - top + 40 };
  $("minimap").setAttribute("viewBox", `${miniBounds.x} ${miniBounds.y} ${miniBounds.w} ${miniBounds.h}`);
  const colors = { done: "#c0d4a7", "in-progress": "#8c9ae0", "not-started": "#a5b8c0" };
  $("mini-nodes").innerHTML = graph.nodes.map(node => {
    const p = positions.get(node.path);
    return `<rect data-mini="${esc(node.path)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${colors[node.progress] || "white"}" stroke="black" stroke-width="1" vector-effect="non-scaling-stroke"></rect>`;
  }).join("");
  miniRects = new Map([...$("mini-nodes").children].map(el => [el.dataset.mini, el]));
  updateMiniView();
}
function panMini(event) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform($("minimap").getScreenCTM().inverse());
  const box = $("graph").getBoundingClientRect();
  pan = { x: box.width / 2 - point.x * scale, y: box.height / 2 - point.y * scale }; transform();
}
$("minimap").addEventListener("pointerdown", event => { $("minimap").setPointerCapture(event.pointerId); panMini(event); event.stopPropagation(); });
$("minimap").addEventListener("pointermove", event => { if ($("minimap").hasPointerCapture(event.pointerId)) panMini(event); });
new ResizeObserver(updateMiniView).observe($("graph"));
const chromeObserver = new ResizeObserver(() => {
  $("app").style.setProperty("--header-height", document.querySelector(".top").getBoundingClientRect().height + "px");
  $("app").style.setProperty("--footer-height", $("status").getBoundingClientRect().height + "px");
});
chromeObserver.observe(document.querySelector(".top")); chromeObserver.observe($("status"));
function drawDrag() {
  frame = null;
  if (!drag) return;
  if (drag.path) {
    const dx = (drag.lastX - drag.startX) / scale, dy = (drag.lastY - drag.startY) / scale;
    const offset = { x: drag.offset.x + dx, y: drag.offset.y + dy };
    offsets.set(drag.path, offset);
    const p = { ...drag.position, x: drag.position.x + dx, y: drag.position.y + dy };
    positions.set(drag.path, p);
    drag.element.style.transform = `translate(${p.x}px,${p.y}px)`;
    miniRects.get(drag.path)?.setAttribute("x", p.x);
    miniRects.get(drag.path)?.setAttribute("y", p.y);
    for (const edge of drag.edges) {
      const d = edgePath(positions.get(edge.from), positions.get(edge.to));
      for (const el of edge.elements) el.setAttribute("d", d);
    }
  } else {
    pan = { x: drag.pan.x + drag.lastX - drag.startX, y: drag.pan.y + drag.lastY - drag.startY }; transform();
  }
}

/* Event handlers never replace the source textarea or intercept IME Enter. */
$("source").addEventListener("focus", () => store.begin(current));
$("source").addEventListener("input", () => {
  if (store.busy) { $("source").value = store.source(current); return; }
  if (!store.session) store.begin(current);
  store.update($("source").value); changed();
});
$("source").addEventListener("blur", finishEditing);
$("source").addEventListener("compositionstart", () => { composing = true; });
$("source").addEventListener("compositionend", () => { composing = false; });
$("source").addEventListener("keydown", event => {
  if (event.isComposing || composing) return;
  if (event.key === "Escape" && !store.busy) {
    event.preventDefault(); event.stopPropagation(); store.end(true); $("source").value = store.source(current); $("source").blur();
    changed(tr("Editing session cancelled.", "本次编辑已取消。")); $("read-mode").focus();
  }
});
$("edit-mode").onclick = () => {
  if (store.busy || !store.base.has(current)) return;
  editing = true; renderMain(); $("source").value = store.source(current); $("source").focus();
};
$("read-mode").onclick = async () => { if (store.busy) return; finishEditing(); editing = false; renderMain(); await updatePreview(); };
$("latest").onclick = compareLatest;
$("rebase").onclick = () => {
  if (!latestDocument || store.busy || latestDocument.path !== current) return;
  finishEditing();
  const draft = store.source(current);
  store.base.set(current, latestDocument); store.drafts.delete(current); store.history = [];
  store.set(current, draft, false); latestDocument = null; $("comparison").hidden = true; changed();
  status(tr("Latest baseline accepted; review your merged draft before saving.", "已接受最新基线；保存前请审阅合并后的草稿。"));
};
$("comparison-close").onclick = () => { $("comparison").hidden = true; };
$("refresh").onclick = refresh;
$("save").onclick = save;
$("copy-drafts").onclick = () => copyPrompt(false);
$("copy-receipt").onclick = () => copyPrompt(true);
$("undo").onclick = () => {
  const path = store.undo();
  if (path) { if (current === path && editing) $("source").value = store.source(path); changed(tr("Undid last edit.", "已撤销上次编辑。"), path); }
};
$("export").onclick = () => {
  finishEditing();
  const blob = new Blob([JSON.stringify({ project: graph.meta.root, edits: store.edits() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = "docdoki-drafts.json"; anchor.click(); URL.revokeObjectURL(url);
  status(tr("Draft export requested; it may contain private content.", "已请求导出草稿，内容可能包含私有信息。"));
};
$("changes-toggle").onclick = () => setChanges(!$("app").classList.contains("changes-open"), true);
$("changes-close").onclick = () => setChanges(false);
$("library-toggle").onclick = () => {
  setLibrary($("library-toggle").getAttribute("aria-expanded") !== "true", true);
};
$("library-close").onclick = () => setLibrary(false);
$("language").onclick = () => {
  lang = lang === "en" ? "zh" : "en";
  try { localStorage.setItem("ddpanel-lang", lang); } catch {}
  localize(); renderMain(); renderCatalog(); renderChanges(); updateMeta(); renderDiagnostics();
  if (!$("status").classList.contains("error") && !store.busy) status(draftSummary());
};
$("search").addEventListener("input", () => {
  query = $("search").value.trim();
  if (query) setLibrary(true);
  renderCatalog(); if (view === "list") renderSpecList(); if (view === "graph") selectNode(selectedNode);
});
$("list-view").onclick = () => navigate("list");
$("graph-view").onclick = () => navigate("graph");
$("fit").onclick = fitGraph;
$("zoom-label").onclick = () => { zoomLocked = !zoomLocked; transform(); };
$("reset-layout").onclick = () => { offsets.clear(); renderGraph(); };
$("zoom-in").onclick = () => zoom(1.2);
$("zoom-out").onclick = () => zoom(1 / 1.2);
document.addEventListener("click", event => {
  const target = event.target;
  const doc = target.closest("[data-doc]");
  if (doc) { event.preventDefault(); openDocument(doc.dataset.doc, doc.dataset.anchor || ""); return; }
  const nav = target.closest("[data-nav]"); if (nav) { navigate(nav.dataset.nav); return; }
  const restore = target.closest("[data-restore]");
  if (restore && !store.busy) {
    const path = restore.dataset.restore; store.restore(path);
    if (current === path && editing) $("source").value = store.source(path);
    changed(tr("Restored file to its baseline.", "文件已恢复到基线。"), path);
    $("undo").focus(); return;
  }
  if (target.id === "add-dependency") return changeDependency(current, $("dependency-target").value, false);
  const remove = target.closest("[data-remove-after]");
  if (remove) return changeDependency(remove.dataset.path, remove.dataset.removeAfter, true);
  const card = target.closest("#graph [data-node]");
  if (card) selectNode(card.dataset.node);
  const edgeEl = target.closest("[data-edge]");
  if (edgeEl) {
    const edge = edgeViews[Number(edgeEl.dataset.edge)];
    if (!edge) return;
    $("edge-detail").hidden = false;
    $("edge-detail").innerHTML = `<p>${esc(catalogEntry(edge.from)?.title)} → ${esc(catalogEntry(edge.to)?.title)}</p><p>${tr("Upstream design dependency. Selecting this edge does not edit it.", "上游设计依赖。选择连线不会修改依赖。")}</p><button data-remove-after="${esc(edge.stem)}" data-path="${esc(edge.to)}">${tr("Remove dependency", "删除依赖")}</button>`;
  }
});
document.addEventListener("keydown", event => {
  if (event.isComposing || composing) return;
  if (event.key === "Escape") {
    if (event.target === $("search") && query) { $("search").value = ""; $("search").dispatchEvent(new Event("input")); }
    else if ($("app").classList.contains("changes-open")) setChanges(false);
    else if (window.innerWidth <= 760 && $("app").classList.contains("library-open")) setLibrary(false);
  }
  if (store.busy || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); $("undo").click(); }
  if (event.key === "/") { event.preventDefault(); $("search").focus(); }
  if (event.target.dataset.node && ["Enter", " "].includes(event.key)) { event.preventDefault(); openDocument(event.target.dataset.node); }
  if (view === "graph" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (event.key === "+" || event.key === "=") zoom(1.2);
    if (event.key === "-") zoom(1 / 1.2);
    if (event.key === "0") fitGraph();
    if (event.key === "r") $("reset-layout").click();
    if (event.key === "Escape") { selectNode(null); $("edge-detail").hidden = true; }
  }
});
window.addEventListener("beforeunload", event => {
  if (store.drafts.size || store.busy) { event.preventDefault(); event.returnValue = ""; }
});
$("graph").addEventListener("pointerdown", event => {
  if (event.target.closest("button,.graph-tools,.edge-detail,[data-edge],#minimap")) return;
  const handle = event.target.closest("[data-node]");
  drag = { startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, pan: { ...pan } };
  if (handle) {
    const path = handle.dataset.node;
    Object.assign(drag, { path, element: handle.closest(".spec-card"), position: { ...positions.get(path) },
      offset: offsets.get(path) || { x: 0, y: 0 }, edges: edgeViews.filter(e => e.from === path || e.to === path) });
  }
  $("graph").setPointerCapture(event.pointerId); event.preventDefault();
});
$("graph").addEventListener("pointermove", event => {
  if (!drag) return;
  drag.lastX = event.clientX; drag.lastY = event.clientY;
  if (!frame) frame = requestAnimationFrame(drawDrag);
});
function endDrag() { if (frame) { cancelAnimationFrame(frame); drawDrag(); } if (drag?.path) renderMinimap(); drag = null; }
$("graph").addEventListener("pointerup", endDrag);
$("graph").addEventListener("pointercancel", endDrag);
$("graph").addEventListener("wheel", event => {
  event.preventDefault();
  if (event.ctrlKey || event.metaKey || event.altKey) {
    const box = $("graph").getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, { x: event.clientX - box.x, y: event.clientY - box.y });
  }
  else { pan.x -= event.shiftKey ? event.deltaY : event.deltaX; pan.y -= event.shiftKey ? 0 : event.deltaY; transform(); }
}, { passive: false });

if (!store.base.has(current) && store.base.has("docdoki/northstar.md")) current = "docdoki/northstar.md";
for (const width of [760, 1100]) matchMedia(`(max-width: ${width}px)`).addEventListener("change", () => {
  if (window.innerWidth <= 1100 && $("workspace").contains(document.activeElement)) setChanges(false);
  if (window.innerWidth <= 760 && $("app").classList.contains("changes-open")) $("app").classList.remove("library-open");
  syncDrawers();
});
localize(); updateMeta(); renderCatalog(); renderMain(); renderChanges(); renderDiagnostics(); syncDrawers();
status(tr("Reading a document snapshot. Refresh for external changes; edit source explicitly.", "当前读取文档快照；可刷新外部修改，编辑需显式进入源码模式。"));
