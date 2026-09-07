/* DOM views consume parsed previews; only DraftStore owns editable sources. */
const $ = id => document.getElementById(id);
const esc = escapeHTML;
let graph = INITIAL_GRAPH;
let store = new DraftStore(graph.documents);
let lang = "en";
try { lang = localStorage.getItem("ddpanel-lang") === "zh" ? "zh" : "en"; } catch {}
const tr = (en, zh) => lang === "zh" ? zh : en;
const OVERVIEW = "docdoki/spec_abstract.md";
let current = OVERVIEW, view = "graph", sourceMode = false, navigationSequence = 0;
let bodyEditor = null, bodySurface = null, bodyPointerDown = false;
let fieldEditor = null, fieldSequence = 0, connectMode = false, connectFrom = null, zoomLocked = false;
let query = "", previewTimer = null, previewSequence = 0, composing = false;
const diffCache = new Map(), conflicts = new Map();
let changeTimer = null, statusTimer = null, syncSequence = 0, saveFailure = null;
const archiveOpen = new Set();
const renderedHTML = new WeakMap();
let previewPending = false, previewError = null, copySequence = 0;
let pathCopySequence = 0, pathCopyNavigation = -1, pathCopiedTimer = null, pathCopyError = "";
function setHTML(element, html) {
  if (renderedHTML.get(element) === html) return false;
  element.innerHTML = html; renderedHTML.set(element, html); return true;
}

function localize() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-en]").forEach(el => { el.textContent = el.dataset[lang]; });
  document.querySelectorAll("[data-en-label]").forEach(el => {
    el.setAttribute("aria-label", el.dataset[lang + "Label"]);
    if (el.matches(".graph-tools button")) el.title = el.dataset[lang + "Label"];
  });
  $("language").textContent = lang === "zh" ? "EN" : "中";
  $("search").placeholder = tr("Search", "搜索");
  bodySurface?.model.localize();
  if (fieldEditor) {
    // Translate labels without rebuilding the card that owns native input.
    fieldEditor.input.setAttribute("aria-label", fieldLabel(fieldEditor.field));
    for (const button of $("graph-cards").querySelectorAll("[data-field]")) button.setAttribute("aria-label", tr("Edit ", "修改") + fieldLabel(button.dataset.field));
    for (const button of $("graph-cards").querySelectorAll("[data-doc]")) button.textContent = tr("Open", "打开");
    for (const button of $("graph-cards").querySelectorAll('[data-field="progress"]')) button.textContent = progressLabel(graph.nodes.find(n => n.path === button.dataset.path)?.progress);
    for (const option of fieldEditor.input.options || []) if (["", "not-started", "in-progress", "done"].includes(option.value)) option.textContent = progressLabel(option.value);
  }
  if (pathCopyNavigation !== navigationSequence) {
    resetPathCopyFeedback(); pathCopyNavigation = navigationSequence;
  }
  if (view === "doc" && current) {
    $("document-path").title = tr("Click to copy path", "点击复制路径");
    $("document-path").tabIndex = 0;
    $("document-path").setAttribute("role", "button");
    $("document-path").setAttribute("aria-label", tr("Document path: ", "文档路径：") + current + tr(". Click to copy", "。点击复制"));
  } else {
    $("document-path").title = "";
    $("document-path").removeAttribute("tabindex");
    $("document-path").removeAttribute("role");
    $("document-path").removeAttribute("aria-label");
  }
  renderPreviewStatus(); updateTools();
}
function status(message = "", error = false) {
  clearTimeout(statusTimer);
  if ($("status").textContent !== message) $("status").textContent = message;
  $("status").classList.toggle("error", error);
  if (message) statusTimer = setTimeout(() => { $("status").textContent = ""; }, error ? 8000 : 3500);
}
function privacy(doc) { return doc?.private ? `<span class="private-tag">${tr("Private", "私有")}</span>` : ""; }
function draftTag(path) { return store.drafts.has(path) ? `<span class="draft-tag">${tr("Draft", "草稿")}</span>` : ""; }
function docButton(doc) {
  const duplicate = graph.catalog.some(d => d.path !== doc.path && d.title === doc.title);
  return `<button class="doc-link ${doc.path === current && view === "doc" ? "selected" : ""}" ${doc.path === current && view === "doc" ? 'aria-current="page"' : ""} data-doc="${esc(doc.path)}" title="${esc(doc.path)}">${esc(doc.title)}${privacy(doc)}${draftTag(doc.path)}${duplicate ? `<small>${esc(doc.path)}</small>` : ""}</button>`;
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
  $("workspace").inert = (mobile && library) || changes;
  if (!library && $("library").contains(document.activeElement)) $("library-toggle").focus();
  if (!changes && $("changes").contains(document.activeElement)) $("changes-toggle").focus();
  if ($("workspace").inert && $("workspace").contains(document.activeElement)) $(changes ? "changes-close" : "library-close").focus();
  $("library-toggle").setAttribute("aria-expanded", String(library));
  $("library-toggle").title = library ? tr("Collapse navigation", "收起导航") : tr("Expand navigation", "展开导航");
  $("library-toggle").setAttribute("aria-label", $("library-toggle").title);
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
  if (anchor && bodySurface?.model.jump(anchor)) return;
  const heading = $("reading").querySelector('[role="heading"],h1') || $("workspace");
  heading.tabIndex = -1; heading.focus({ preventScroll: true });
}
function updateMeta() { $("project-name").textContent = graph.meta.title; }
function renderCatalog() {
  $("catalog").querySelectorAll("details").forEach(el => {
    if (el.open) archiveOpen.add(el.dataset.group); else archiveOpen.delete(el.dataset.group);
  });
  const groups = [["spec", tr("Specs", "规格")], ["stage", tr("Active stages", "进行中阶段")], ["note", tr("Notes", "笔记")]];
  let html = "";
  for (const [kind, label] of groups) {
    const docs = graph.catalog.filter(d => d.kind === kind && !d.archived && matches(d));
    if (!docs.length) continue;
    html += `<section class="catalog-group"><h3>${label}</h3>${docs.map(docButton).join("")}</section>`;
  }
  const archived = graph.catalog.filter(d => d.archived && matches(d));
  if (archived.length) html += `<details class="catalog-group" data-group="archive" ${archiveOpen.has("archive") || query ? "open" : ""}><summary>${tr("Archive", "归档")} (${archived.length})</summary>${archived.map(docButton).join("")}</details>`;
  const focused = $('catalog').contains(document.activeElement) ? document.activeElement.dataset.doc : null;
  if (setHTML($("catalog"), html || `<p class="notice">${tr("No matching documents.", "没有匹配文档。")}</p>`) && focused)
    $('catalog').querySelector(`[data-doc="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
}

/* Resolve links without fetching images or rendering source HTML. */
function resolveLink(href, from = current) {
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return { external: href };
  if (href.startsWith("#")) {
    try { return { path: from, anchor: decodeURIComponent(href.slice(1)) }; } catch { return null; }
  }
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
// The live editor uses only the lexer for reference definitions.
const markdown = new marked.Marked({ gfm: true });
function renderDiagnostics() {
  const diagnostics = graph.diagnostics || [];
  $("diagnostics").hidden = !diagnostics.length;
  $("diagnostic-list").innerHTML = diagnostics.map(d =>
    `<li><button data-doc="${esc(d.path)}">${esc(catalogEntry(d.path)?.title || d.path)}</button>: ${esc(d.message)}</li>`).join("");
}
function renderRelated(doc) {
  const related = Object.values(graph.documents).filter(d => d.path !== doc.path &&
    (d.source.includes("[[" + doc.stem + "]]") || d.source.includes("[[" + doc.stem + "#") ||
     d.source.includes("[[" + doc.stem + "|") || d.source.includes(doc.path)));
  setHTML($("related"), related.length ? `<details><summary>${tr("Related documents", "相关文档")}<span class="related-kind">${tr("Navigation", "文档导航")}</span></summary><div class="related-links">${related.map(docButton).join("")}</div></details>` : "");
}
function renderMain() {
  const active = view === "graph" ? "dashboard" : view === "work" ? "work" : current === OVERVIEW ? "overview" : current === "docdoki/northstar.md" ? "northstar" : null;
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.classList.toggle("active", el.dataset.nav === active);
    if (el.dataset.nav === active) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
  });
  $("source-view").hidden = view !== "doc";
  $("source-view").disabled = store.busy || !store.base.has(current);
  $("source-view").classList.toggle("active", sourceMode);
  $("source-view").setAttribute("aria-pressed", String(sourceMode));
  $("source-view").setAttribute("aria-label", tr("Source view", "源码视图"));
  $("source-view").title = sourceMode ? tr("Show rendered document", "显示正文预览") : tr("Show source", "显示源码");
  $("reader").hidden = view === "graph";
  $("graph").hidden = view !== "graph";
  if (view !== "doc" && bodySurface) { bodySurface.model.destroy(); bodySurface = null; renderedHTML.delete($("reading")); }
  $("reading").classList.toggle("is-source", view === "doc" && sourceMode);
  $("document-path").classList.toggle("view-name", view !== "doc");
  if (view === "graph") {
    $("document-path").textContent = tr("Dashboard", "看板");
    renderGraph();
  } else if (view === "work") {
    $("document-path").textContent = tr("Current work", "当前工作");
    const docs = Object.values(graph.documents).filter(d => d.kind === "stage" && !d.archived);
    setHTML($("reading"), `<h1>${tr("Current work", "当前工作")}</h1>` + (docs.length ? docs.map(docButton).join("") : `<p>${tr("No active work.", "没有进行中的工作。")}</p>`));
    setHTML($("related"), "");
  } else {
    const doc = currentDocument();
    $("document-path").innerHTML = esc(current) + privacy(doc) + draftTag(current);
    if (!bodyEditor) renderBody(doc);
    if (doc) renderRelated(doc); else setHTML($("related"), "");
  }
  $("workspace").setAttribute("aria-label", view === "doc" ? currentDocument()?.title || current : $("document-path").textContent);
  localize();
}
async function request(route, payload, timeout = 15000) {
  const controller = new AbortController();
  const captured = route === "/preview" ? new Map(store.base) : null;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { "X-DocDoki-Token": SAVE_TOKEN };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(route, { method: payload === undefined ? "GET" : "POST", headers,
      body: payload === undefined ? undefined : JSON.stringify(payload), signal: controller.signal });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch { throw new Error(response.status === 413 ? tr("Request exceeds capacity. Your edits are kept; reduce the edit batch.", "请求超出容量，修改已保留；请缩小修改批次。") : "HTTP " + response.status + ": " + text.replace(/<[^>]*>/g, " ").trim().slice(0, 160)); }
    if (!response.ok && !result.error) throw new Error("HTTP " + response.status);
    if (result.ok && result.graph?.documentRefs) {
      for (const [path, revision] of Object.entries(result.graph.documentRefs)) {
        const doc = captured?.get(path);
        if (!doc || doc.revision !== revision) throw new Error("Preview reference does not match its captured source: " + path);
        result.graph.documents[path] = doc;
      }
      delete result.graph.documentRefs;
    }
    return result;
  } finally { clearTimeout(timer); }
}
function renderPreviewStatus() {
  $("preview-status").hidden = !previewError;
  const message = previewError ? tr("Preview could not update. Your edits are kept.", "预览未能更新，修改已保留。") : "";
  $("preview-status").title = previewError || "";
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
  const sequence = ++previewSequence, previous = store, version = store.version;
  if (store.busy) return;
  try {
    const result = await request("/preview", capturedSources());
    if (sequence !== previewSequence || store !== previous || version !== store.version || store.busy) return;
    if (!result.ok) throw new Error(result.error);
    graph = result.graph;
    // A preview must never silently replace a baseline or an active textarea.
    previewPending = false; previewError = null; renderPreviewStatus();
    renderDiagnostics(); renderCatalog(); renderMain();
  } catch (error) {
    if (sequence !== previewSequence || store !== previous || version !== store.version) return;
    previewPending = false; previewError = error.message; renderPreviewStatus();
  }
}
async function finishEditing() {
  fieldSequence++; // Cancel an outstanding local-editor open request on another view.
  if (bodyEditor && !await commitBody()) return false;
  if (fieldEditor && !await commitField()) return false;
  renderChanges(false); return true;
}
async function openDocument(path, anchor = "") {
  if (store.busy) return;
  const navigation = ++navigationSequence, previous = store;
  if (!await finishEditing() || navigation !== navigationSequence) return;
  if (!store.base.has(path)) {
    try {
      const doc = await request("/document?path=" + encodeURIComponent(path));
      if (doc.error && !doc.source) throw new Error(doc.error);
      if (navigation !== navigationSequence || store.busy) return;
      if (store !== previous) return openDocument(path, anchor);
      store.addDocument(doc); graph.documents[path] = doc;
      const entry = catalogEntry(path); if (entry) entry.title = doc.title;
    } catch (error) { status(error.message, true); return; }
  }
  current = path; view = "doc"; sourceMode = false; setConnect(false);
  renderMain(); renderCatalog();
  if (window.innerWidth <= 760) setLibrary(false);
  setChanges(false);
  $("workspace").scrollTop = 0;
  focusDocument(anchor);
}
async function navigate(next) {
  if (store.busy) return;
  if (next === "northstar") return openDocument("docdoki/northstar.md");
  if (next === "overview") return openDocument(OVERVIEW);
  const navigation = ++navigationSequence;
  if (!await finishEditing() || navigation !== navigationSequence) return;
  sourceMode = false; setConnect(false);
  view = next === "work" ? "work" : "graph";
  if (view === "graph") current = OVERVIEW;
  renderMain(); renderCatalog();
  if (window.innerWidth <= 760) setLibrary(false);
  setChanges(false);
  $("workspace").focus({ preventScroll: true });
}

/* Pending changes and receipts are separate, memory-only products. */
function renderChanges(details = true) {
  const edits = store.edits(), paths = new Set(edits.map(e => e.path));
  for (const cache of [diffCache, conflicts]) for (const path of cache.keys()) if (!paths.has(path)) cache.delete(path);
  if (bodyDirty()) paths.add(bodyEditor.path);
  if (fieldDirty()) paths.add(fieldEditor.path);
  $("count").hidden = !paths.size; $("count").textContent = paths.size;
  $("save-controls").hidden = !edits.length && !store.receipt.length;
  $("save").hidden = !edits.length;
  $("save").disabled = store.busy || !!conflicts.size;
  $("save").textContent = store.busy ? tr("Saving…", "保存中…") : tr("Save", "保存");
  $("copy-agent").disabled = store.busy;
  $("export").hidden = !saveFailure || !edits.length;
  $("save-error").hidden = !saveFailure || !edits.length;
  $("save-error").textContent = saveFailure ? (saveFailure.unknown ? tr("Save could not be confirmed. Your edits are kept.", "无法确认保存结果，修改已保留。") : tr("Save failed. Your edits are kept.", "保存失败，修改已保留。")) : "";
  $("save-error").title = saveFailure?.message || "";
  bodySurface?.model.setReadOnly();
  $("source-view").disabled = store.busy || !store.base.has(current);
  document.querySelectorAll("[data-field],[data-remove-after],[data-discard],#connect").forEach(el => { el.disabled = store.busy; });
  if (!details) return;
  const list = $("change-list"), existing = new Map([...list.querySelectorAll(".change")].map(el => [el.dataset.path, el]));
  for (const [path, el] of existing) if (!paths.has(path)) el.remove();
  if (!edits.length) {
    const savedCount = new Set(store.receipt.map(e => e.path)).size;
    setHTML(list, `<p>${savedCount ? tr(`Saved changes in ${savedCount} document(s) retained for handoff.`, `已保留 ${savedCount} 份文档的已保存修改，供交接。`) : tr("No unsaved changes.", "没有待保存的修改。")}</p>`);
    return;
  }
  list.querySelector(":scope > p")?.remove(); renderedHTML.delete(list);
  for (const edit of edits) {
    const cached = diffCache.get(edit.path);
    if (!cached || cached.from !== edit.from || cached.to !== edit.to)
      diffCache.set(edit.path, { from: edit.from, to: edit.to, html: diffHTML(edit.from, edit.to) });
    let el = existing.get(edit.path);
    if (!el) {
      el = document.createElement("section"); el.className = "change"; el.dataset.path = edit.path;
      el.innerHTML = '<header></header><p class="summary"></p><details class="change-details"><summary data-en="View changes" data-zh="查看差异">View changes</summary><div class="change-diff"></div></details><div class="conflict" hidden></div>';
      list.append(el);
    }
    const doc = store.base.get(edit.path);
    setHTML(el.querySelector("header"), `<button data-doc="${esc(edit.path)}" title="${esc(edit.path)}">${esc(doc?.title || edit.path)}${privacy(doc)}</button><button data-discard="${esc(edit.path)}" ${store.busy ? "disabled" : ""}>${tr("Discard changes", "撤回修改")}</button>`);
    const before = edit.from.split("\n"), after = edit.to.split("\n");
    let first = 0; while (first < Math.min(before.length, after.length) && before[first] === after[first]) first++;
    el.querySelector(".summary").textContent = (before[first] || "∅").slice(0, 80) + " → " + (after[first] || "∅").slice(0, 80);
    const diff = el.querySelector(".change-diff"), full = diff.querySelector("details");
    const open = full?.open, focused = document.activeElement === full?.querySelector("summary");
    if (setHTML(diff, diffCache.get(edit.path).html)) {
      if (open) diff.querySelector("details").open = true;
      if (focused) diff.querySelector("summary").focus({ preventScroll: true });
    }
    const conflict = conflicts.get(edit.path), surface = el.querySelector(".conflict");
    surface.hidden = !conflict;
    if (conflict) setHTML(surface, `<p>${tr("This document changed elsewhere. Your edits are kept.", "此文档有外部修改。你的修改已保留。")}</p><details><summary>${tr("View external version", "查看外部版本")}</summary><pre class="external-source">${esc(conflict.source ?? tr("File unavailable: ", "文件不可用：") + conflict.error)}</pre></details>`);
  }
  list.querySelectorAll("[data-en]").forEach(el => { el.textContent = el.dataset[lang]; });
}
function changed(message = "") {
  clearPrompt(); renderChanges(false); renderCatalog();
  clearTimeout(changeTimer); changeTimer = setTimeout(renderChanges, 150);
  if (view === "doc") $("document-path").innerHTML = esc(current) + privacy(currentDocument()) + draftTag(current);
  status(message);
  schedulePreview();
}
function buildPrompt() {
  const uncertainty = store.drafts.size && saveFailure ? tr("A save attempt failed or was not confirmed; some edits may already be on disk. Check actual files before applying anything.\n\n", "一次保存失败或结果未确认，部分修改可能已在磁盘上。应用前必须核对实际文件。\n\n") : "";
  const sections = [];
  const describe = (e, saved, i) => {
    const external = !saved && conflicts.get(e.path);
    return (saved ? `${i + 1}. ` : "") + e.path + ((e.private || store.base.get(e.path)?.private) ? " [PRIVATE]" : " [SHARED]") +
      (saved ? "\n--- HISTORICAL BEFORE (NOT A WRITE PRECONDITION) ---\n" : "\n--- CAPTURED DISK BASELINE (CHECK BEFORE WRITING) ---\n") + e.from + "\n--- AFTER ---\n" + e.to +
      (external ? "\n--- EXTERNAL VERSION (CHECK AGAIN BEFORE WRITING) ---\n" + (external.source ?? external.error) : "");
  };
  if (store.receipt.length) sections.push(tr("SAVED — chronological changes from this tab, including earlier saves. Read current files and follow the changed intent within the authorized scope. Do not apply these historical patches again. Later entries may supersede earlier ones; saving or copying is not evidence that implementation is aligned.", "已保存——本标签页累计的修改，按保存顺序排列。读取当前文件，在授权范围内 follow 变更意图；不要再次应用历史补丁。后续记录可能取代先前内容；保存或复制不表示实现已对齐。") + "\n\n" + store.receipt.map((e, i) => describe(e, true, i)).join("\n\n"));
  if (store.drafts.size) sections.push(tr("UNSAVED — check each captured disk baseline against the current file before applying, then follow the intent within the authorized scope. Historical saved versions above are NOT these write preconditions. Preserve unrelated work and public/private boundaries.", "尚未保存——逐份核对捕获的磁盘基线后再应用，并在授权范围内 follow 意图。上方历史保存版本不是这些修改的写入前置条件。保留无关工作和公私边界。") + "\n\n" + store.edits().map(e => describe(e, false)).join("\n\n"));
  return uncertainty + tr("Coordinate other writers before writing these files.\nProject: ", "写入这些文件前请协调其他写者。\n项目：") + graph.meta.root + "\n\n" + sections.join("\n\n");
}
function clearPrompt() {
  copySequence++;
  $("prompt-label").hidden = $("prompt").hidden = true;
  $("prompt").value = ""; $("private-warning").hidden = true;
}
function warnPrivate() {
  const edits = [...store.receipt, ...store.edits()];
  $("private-warning").hidden = !edits.some(e => e.private || store.base.get(e.path)?.private);
  $("private-warning").textContent = tr("Contains private edits. Share only with a trusted agent.", "包含私有修改，请只交给可信的 Agent。");
}
async function copyPrompt() {
  if (store.busy) return;
  if (!await finishEditing()) return;
  clearPrompt(); warnPrivate();
  const sequence = ++copySequence;
  const text = buildPrompt();
  $("prompt").value = text;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    if (sequence !== copySequence) return;
    status(tr("Request copied.", "请求已复制。"));
  } catch (error) {
    if (sequence !== copySequence) return;
    $("prompt-label").hidden = $("prompt").hidden = false;
    $("prompt").focus(); $("prompt").select();
    status(tr("Copy failed. Select and copy the request below.", "复制失败，请手动复制下方请求。"), true);
  }
}
async function save() {
  if (store.busy || !await finishEditing()) return;
  if (conflicts.size) { setChanges(true, true); return; }
  const edits = store.startSave();
  if (!edits) return;
  clearPrompt(); clearTimeout(previewTimer); previewSequence++;
  previewPending = false; previewError = null; renderPreviewStatus(); renderChanges();
  try {
    const result = await request("/save", { edits });
    store.finishSave(result);
    if (!result.ok) saveFailure = { message: result.error };
    else {
      saveFailure = null; conflicts.clear(); Object.assign(graph.documents, result.documents);
      status(tr(`Saved ${result.receipt.length} document(s).`, `已保存 ${result.receipt.length} 份文档。`));
      renderChanges();
      await updatePreview();
    }
  } catch (error) {
    store.finishSave({ ok: false }); saveFailure = { message: error.message, unknown: true };
  }
  if (saveFailure) { renderChanges(); setChanges(true); await syncDocuments(); }
  renderChanges(); renderCatalog();
}
async function syncDocuments() {
  if (store.busy || fieldEditor || bodyEditor) return;
  const previous = store, version = store.version, navigation = navigationSequence, fields = fieldSequence, sequence = ++syncSequence;
  const edits = store.edits(), path = current;
  try {
    const snapshot = await request("/snapshot");
    if (snapshot.error) throw new Error(snapshot.error);
    const latest = new Map();
    for (const edit of edits) {
      const doc = snapshot.documents[edit.path] || await request("/document?path=" + encodeURIComponent(edit.path));
      if (doc.source !== edit.from) latest.set(edit.path, doc);
    }
    if (!edits.length && view === "doc" && !snapshot.documents[path] && snapshot.catalog.some(d => d.path === path)) {
      const doc = await request("/document?path=" + encodeURIComponent(path));
      if (typeof doc.source !== "string") throw new Error(doc.error);
      snapshot.documents[path] = doc;
    }
    if (store !== previous || store.version !== version || store.busy || fieldEditor || bodyEditor || fields !== fieldSequence || sequence !== syncSequence || navigation !== navigationSequence) return;
    if (JSON.stringify([...conflicts].map(([p, d]) => [p, d.source, d.error])) !== JSON.stringify([...latest].map(([p, d]) => [p, d.source, d.error]))) clearPrompt();
    conflicts.clear(); for (const [p, doc] of latest) conflicts.set(p, doc);
    if (edits.length) { renderChanges(); return; }
    const receipt = store.receipt, scroll = $("workspace").scrollTop;
    const bookmark = bodySurface?.model.bookmark();
    graph = snapshot; store = new DraftStore(snapshot.documents); store.receipt = receipt;
    previewSequence++; clearTimeout(previewTimer); diffCache.clear(); saveFailure = null;
    previewPending = false; previewError = null; renderPreviewStatus();
    if (view === "doc" && !store.base.has(current)) { current = OVERVIEW; view = "graph"; sourceMode = false; }
    updateMeta(); renderMain(); renderCatalog(); renderChanges(); renderDiagnostics();
    $("workspace").scrollTop = scroll;
    if (bookmark && bodySurface) bodySurface.model.restore(bookmark);
  } catch (error) {
    if (store === previous && store.version === version && sequence === syncSequence)
      status(tr("Could not check for updates. Your edits are kept.", "暂时无法检查更新，修改已保留。"), true);
  }
}
async function discardChanges(path) {
  if (store.busy || !store.drafts.has(path)) return;
  if (!await finishEditing()) return;
  const previous = store, version = store.version, fields = fieldSequence;
  try {
    const doc = await request("/document?path=" + encodeURIComponent(path));
    const missing = typeof doc.source !== "string" && doc.error?.startsWith("missing or unsupported document path:");
    if (typeof doc.source !== "string" && !missing) throw new Error(doc.error);
    if (store !== previous || store.version !== version || store.busy || fields !== fieldSequence) {
      status(tr("Editing continued; nothing was discarded.", "编辑仍在继续，未撤回修改。")); return;
    }
    store.discard(path, missing ? null : doc); conflicts.delete(path);
    if (missing) {
      delete graph.documents[path]; graph.catalog = graph.catalog.filter(d => d.path !== path);
      if (current === path) { current = OVERVIEW; view = "graph"; sourceMode = false; }
    } else graph.documents[path] = doc;
    if (!store.drafts.size) saveFailure = null;
    changed(tr("Changes discarded.", "修改已撤回。")); renderChanges(); renderMain();
    if (!store.drafts.size) await syncDocuments();
    $("changes-close").focus();
  } catch (error) { status(tr("Could not discard changes; your edits are kept. ", "无法撤回，修改已保留。") + error.message, true); }
}
function capturedSources() {
  return { compact: true, edits: store.edits(), baseRefs: Object.fromEntries([...store.base].map(([p, d]) => [p, d.revision])), extra: [...store.base.keys()] };
}
async function changeDependency(path, stem, remove) {
  if (store.busy || !stem || !await finishEditing()) return;
  if (store.base.get(path)?.kind !== "spec") return;
  const previous = store, version = store.version;
  try {
    // Add is idempotent. Connect never infers a toggle from a stale preview.
    const result = await request("/preview", { ...capturedSources(), after: { path, op: remove ? "remove" : "add", stem } });
    if (store !== previous || store.busy || version !== store.version || fieldEditor || bodyEditor) throw new Error(tr("The source changed while checking dependencies; change not applied. Retry.", "校验依赖时源码或编辑状态已变化，未应用修改，请重试。"));
    if (!result.ok) throw new Error(result.error);
    const restoreFocus = $("edge-detail").contains(document.activeElement);
    const staged = store.set(path, result.graph.documents[path].source);
    graph = result.graph;
    $("edge-detail").hidden = true;
    if (staged) changed();
    renderMain();
    if (restoreFocus) $("graph-cards").querySelector(`[data-node="${CSS.escape(path)}"]`)?.focus({ preventScroll: true });
    status(staged ? tr("Dependency updated.", "依赖已修改。") : tr("Dependency already matches.", "依赖关系已是此状态。"));
    return true;
  } catch (error) { status(error.message, true); return false; }
}

/* One continuous source-backed editor serves live Markdown and full source.
   Local transactions stay in memory; previews validate the complete captured source. */
function bodyDirty() { return !!bodyEditor && bodyEditor.model.source !== bodyEditor.before; }
function renderBody(doc) {
  if (bodySurface?.owner === store && bodySurface.version === store.version && bodySurface.path === current &&
      bodySurface.model.source === store.source(current)) return;
  const bookmark = bodySurface?.path === current ? bodySurface.model.bookmark() : null;
  bodySurface?.model.destroy(); bodySurface = null;
  $("reading").replaceChildren(); renderedHTML.delete($("reading"));
  if (!doc || !store.base.has(current)) { setHTML($("reading"), `<h1>${tr('Document not found', '未找到文档')}</h1>`); return; }
  const surface = bodySurface = { path: current, owner: store, version: store.version, model: null };
  surface.model = DocDokiBody.create({
    parent: $("reading"), source: store.source(current), markdown, resolveLink,
    label: () => sourceMode ? tr('Document source', '文档源码') : tr('Document', '文档'),
    canEdit: () => !store.busy && surface.owner === store && surface.version === store.version && surface === bodySurface,
    onFocus: beginBody,
    onBlur: scheduleBodyBlur,
    onChange: () => {
      beginBody();
      if (bodyEditor) bodyEditor.generation++;
      $("reading").removeAttribute("aria-invalid"); clearPrompt();
      queueMicrotask(() => { renderChanges(false); if (!bodyFocused()) scheduleBodyBlur(); });
    },
    onComposition: active => { composing = active; if (!active) scheduleBodyBlur(); },
    onFinish: () => { $("workspace").focus({ preventScroll: true }); scheduleBodyBlur(); },
    onSave: save,
    onEscape: () => {
      if (!sourceMode || !bodyEditor || composing) return false;
      surface.model.replace(bodyEditor.before);
      $("source-view").focus({ preventScroll: true }); scheduleBodyBlur(); return true;
    },
    onLink: link => {
      if (link.path === current && !bodyDirty()) { surface.model.jump(link.anchor); return; }
      if (link.path) openDocument(link.path, link.anchor);
      else if (resolveLink(link.href)?.external) { window.open(link.href, '_blank', 'noopener,noreferrer'); commitBody(); }
    },
  });
  surface.model.setMode(sourceMode);
  if (bookmark) surface.model.restore(bookmark);
}
function beginBody() {
  if (store.busy || view !== 'doc' || !bodySurface) return;
  if (bodySurface.owner !== store || bodySurface.version !== store.version || bodySurface.path !== current) return;
  if (!bodyEditor) {
    fieldSequence++;
    bodyEditor = { ...bodySurface, before: store.source(current), generation: 0, pending: null };
  }
  bodyEditor.generation++;
}
function closeBody(editor) {
  if (bodyEditor !== editor) return;
  bodyEditor = null; fieldSequence++; composing = false;
  if (bodySurface?.model === editor.model) bodySurface.version = store.version;
  $("reading").removeAttribute("aria-invalid");
  renderMain();
}
async function commitBody() {
  const editor = bodyEditor;
  if (!editor) return true;
  if (editor.pending) return editor.pending;
  if (composing || editor.model.composing || store.busy) return false;
  try {
    if (store !== editor.owner || store.version !== editor.version) throw new Error(tr("The source changed. Your text is kept; copy it before reloading.", "源码已变化，文本已保留；请复制文本后再重新加载。"));
    const source = editor.model.source;
    if (source === editor.before) { closeBody(editor); return true; }
    const generation = editor.generation, payload = capturedSources();
    payload.edits = payload.edits.filter(e => e.path !== editor.path);
    payload.edits.push({ path: editor.path, field: "source", from: store.base.get(editor.path).source, to: source });
    editor.pending = (async () => {
      try {
        const result = await request("/preview", payload);
        if (bodyEditor !== editor || generation !== editor.generation) return false;
        if (store !== editor.owner || store.version !== editor.version || store.busy)
          throw new Error(tr("The source changed. Your text is kept.", "源码已变化，文本已保留。"));
        if (!result.ok) throw new Error(result.error);
        if (result.graph.documents[editor.path].source !== source) throw new Error("Preview did not preserve the proposed source.");
        const staged = store.set(editor.path, source); graph = result.graph;
        closeBody(editor); if (staged) changed(); return true;
      } catch (error) {
        if (bodyEditor === editor) { $("reading").setAttribute("aria-invalid", "true"); status(error.message, true); }
        return false;
      } finally {
        editor.pending = null;
        if (bodyEditor === editor && generation !== editor.generation) scheduleBodyBlur();
      }
    })();
    return editor.pending;
  } catch (error) { status(error.message, true); return false; }
}
function bodyFocused() { return document.hasFocus() && !!bodySurface?.model.focused; }
function scheduleBodyBlur() {
  setTimeout(() => { if (bodyEditor && !bodyPointerDown && !composing && !bodyFocused()) commitBody(); }, 0);
}
document.addEventListener('pointerdown', () => { bodyPointerDown = true; }, true);
for (const name of ['pointerup', 'pointercancel']) document.addEventListener(name, () => {
  setTimeout(() => { bodyPointerDown = false; scheduleBodyBlur(); scheduleFieldBlur(); }, 0);
}, true);
window.addEventListener('blur', () => { bodyPointerDown = false; scheduleBodyBlur(); scheduleFieldBlur(); });

/* A native field buffer is local, uncommitted input. Apply transforms the captured
   complete source; it never patches a rendered heading or an old graph summary. */
function fieldDirty() { return !!fieldEditor && fieldEditor.input.value !== fieldEditor.before; }
function cardElement(path) { return [...$("graph-cards").children].find(el => el.dataset.node === path); }
function fieldLabel(field) {
  return { title: tr("Title", "标题"), purpose: tr("Summary", "摘要"), progress: tr("Progress", "进度") }[field];
}
async function beginField(path, field, event) {
  if (store.busy || view !== "graph") return;
  let caretOffset = null, displayed = null;
  if (event?.detail && field !== "progress") {
    const button = event.target.closest('[data-field]');
    const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const hit = !caret && document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const node = caret?.offsetNode || hit?.startContainer, offset = caret?.offset ?? hit?.startOffset;
    if (button && node && button.contains(node)) {
      const range = document.createRange(); range.selectNodeContents(button); range.setEnd(node, offset);
      caretOffset = range.toString().length; displayed = button.textContent;
    }
  }
  if (connectMode) return activateCard(path);
  if (fieldEditor?.path === path && fieldEditor.field === field) { fieldEditor.input.focus(); return; }
  if (!await finishEditing()) return;
  const previous = store, version = store.version, sequence = ++fieldSequence;
  try {
    let doc = graph.documents[path];
    if (!doc || doc.source !== store.source(path)) {
      const result = await request("/preview", capturedSources());
      if (!result.ok) throw new Error(result.error);
      doc = result.graph.documents[path];
    }
    if (sequence !== fieldSequence || previous !== store || version !== store.version || store.busy || view !== "graph") return;
    if (!doc || doc.error) throw new Error(doc?.error || "Document unavailable");
    const value = field === "title" ? doc.title : doc.fm[field] ?? "";
    if (typeof value !== "string") throw new Error(tr("Open the source to edit this field's format.", "请打开源码修改此字段格式。"));
    const card = cardElement(path), button = card?.querySelector(`[data-field="${field}"]`);
    if (!button) return;
    const form = document.createElement("form"); form.id = "card-field-form"; form.className = "field-editor field-" + field;
    const input = document.createElement(field === "purpose" ? "textarea" : field === "progress" ? "select" : "input");
    input.name = "value"; input.setAttribute("aria-label", fieldLabel(field)); input.spellcheck = false;
    if (field === "progress") {
      for (const state of ["", "not-started", "in-progress", "done"]) input.add(new Option(progressLabel(state), state));
      if (![...input.options].some(option => option.value === value)) input.add(new Option(value, value));
    }
    input.value = value; form.append(input); button.replaceWith(form);
    const editor = fieldEditor = { path, field, input, card, owner: store, version, before: input.value, generation: 0, pending: null };
    card.classList.add("field-active");
    input.addEventListener("input", () => { editor.generation++; input.removeAttribute("aria-invalid"); clearPrompt(); renderChanges(false); });
    input.addEventListener("focus", () => { editor.generation++; });
    input.addEventListener("blur", scheduleFieldBlur);
    if (field === "progress") input.addEventListener("change", () => { if (!composing) commitField(); });
    form.addEventListener("submit", event => { event.preventDefault(); if (!composing) commitField(); });
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => { composing = false; scheduleFieldBlur(); });
    input.addEventListener("keydown", event => {
      if (event.isComposing || composing) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelField(); }
      else if (event.key === "Enter" && (field !== "purpose" || event.ctrlKey || event.metaKey)) {
        event.preventDefault(); event.stopPropagation(); commitField();
      }
    });
    status(); input.focus();
    if (field !== "progress") {
      const position = displayed === value && caretOffset != null ? Math.min(caretOffset, value.length) : value.length;
      input.setSelectionRange(position, position);
    }
  } catch (error) {
    if (sequence === fieldSequence) status(error.message, true);
  }
}
function scheduleFieldBlur() {
  setTimeout(() => {
    if (fieldEditor && !bodyPointerDown && !composing &&
        (!document.hasFocus() || document.activeElement !== fieldEditor.input)) commitField();
  }, 0);
}
function closeField(editor) {
  if (fieldEditor !== editor) return;
  const focused = document.activeElement === editor.input;
  fieldEditor = null; fieldSequence++; composing = false;
  renderMain(); renderChanges(false);
  if (focused) cardElement(editor.path)?.querySelector(`[data-field="${editor.field}"]`)?.focus({ preventScroll: true });
}
function cancelField() {
  if (!fieldEditor || store.busy) return;
  closeField(fieldEditor); status(tr("Field edit cancelled.", "字段修改已取消。"));
}
async function commitField() {
  const editor = fieldEditor;
  if (!editor) return true;
  if (editor.pending) return editor.pending;
  if (composing || store.busy) return false;
  if (!fieldDirty()) { closeField(editor); return true; }
  const value = editor.input.value, generation = editor.generation;
  editor.pending = (async () => {
    try {
      if (store !== editor.owner || store.version !== editor.version) throw new Error(tr("The source changed. Your field text is kept; copy it before cancelling and reopening.", "源码已变化，字段文本已保留；请复制文本后取消并重新打开字段。"));
      const result = await request("/preview", { ...capturedSources(), card: { path: editor.path, field: editor.field, value: editor.field === "progress" && !value ? null : value } });
      if (fieldEditor !== editor) return false;
      if (store !== editor.owner || store.version !== editor.version || store.busy || generation !== editor.generation)
        throw new Error(tr("Editing continued. Your text is kept.", "编辑仍在继续，文本已保留。"));
      if (!result.ok) throw new Error(result.error);
      const staged = store.set(editor.path, result.graph.documents[editor.path].source);
      graph = result.graph;
      closeField(editor);
      if (staged) changed();
      return true;
    } catch (error) {
      if (fieldEditor === editor) { editor.input.setAttribute("aria-invalid", "true"); status(error.message, true); }
      return false;
    } finally {
      editor.pending = null;
      if (fieldEditor === editor && generation !== editor.generation) scheduleFieldBlur();
    }
  })();
  return editor.pending;
}
function setConnect(on) {
  connectMode = on; connectFrom = null;
  $("edge-detail").hidden = true;
  updateTools(); if (view === "graph") selectNode(null);
}
async function toggleConnect() {
  if (store.busy || !await finishEditing()) return;
  setConnect(!connectMode);
}
async function activateCard(path) {
  if (!await finishEditing() || view !== "graph") return;
  selectNode(path); cardElement(path)?.focus({ preventScroll: true });
  if (!connectMode || !path || store.busy) return;
  if (!connectFrom) { connectFrom = path; updateTools(); selectNode(path); return; }
  if (connectFrom === path) { connectFrom = null; updateTools(); selectNode(null); return; }
  const upstream = graph.nodes.find(n => n.path === connectFrom);
  connectFrom = null; updateTools();
  if (upstream) await changeDependency(path, upstream.stem, false);
}
function updateTools() {
  $("graph").classList.toggle("connecting", connectMode);
  $("connect").classList.toggle("active", connectMode); $("connect").setAttribute("aria-pressed", String(connectMode));
  $("connect").disabled = store.busy;
  $("connect").title = connectMode ? tr("Exit Connect (Esc)", "退出连线（Esc）") : tr("Connect dependencies (C)", "连接依赖（C）");
  $("connect").setAttribute("aria-label", $("connect").title);
  $("connect-hint").hidden = !connectMode;
  const from = graph.nodes.find(n => n.path === connectFrom);
  if (!from) connectFrom = null;
  $("connect-hint").textContent = from ? tr(`From ${from.title} → choose the dependent card`, `从 ${from.title} → 选择依赖它的卡片`) : tr("Choose an upstream card, then its dependent. Esc exits.", "先选上游，再选依赖它的卡片。Esc 退出。");
  $("zoom-label").textContent = Math.round(scale * 100) + "%";
  $("zoom-label").classList.toggle("active", zoomLocked); $("zoom-label").setAttribute("aria-pressed", String(zoomLocked));
  $("zoom-label").title = zoomLocked ? tr("Unlock zoom", "解锁缩放") : tr("Lock zoom", "锁定缩放");
  $("zoom-label").setAttribute("aria-label", $("zoom-label").textContent + " · " + $("zoom-label").title);
  $("zoom-out").disabled = $("zoom-in").disabled = $("fit").disabled = zoomLocked;
  $("reset-layout").title = tr("Restore automatic layout (R)", "恢复自动布局（R）");
}
async function resetLayout() {
  if (!await finishEditing()) return;
  offsets.clear(); renderGraph();
}

/* Canvas layout and geometry do not own document or editing state. */
let scale = 1, pan = { x: 0, y: 0 }, positions = new Map(), offsets = new Map(), edgeViews = [];
let drag = null, frame = null, graphReady = false, selectedNode = null, graphRenderPending = false;
let miniBounds = { x: 0, y: 0, w: 1, h: 1 }, miniRects = new Map(), miniDragId = null;
function progressLabel(progress) {
  return { "not-started": tr("Not started", "未开始"), "in-progress": tr("In progress", "进行中"), done: tr("Done", "已完成") }[progress] || tr("Not recorded", "未记录");
}
const CARD = { width: 300, height: 180, columnGap: 140, rowGap: 30 };
function cardHTML(node) {
  const field = (name, label) => `data-field="${name}" data-path="${esc(node.path)}" aria-label="${tr("Edit ", "修改") + fieldLabel(name)}" title="${esc(label)}" ${store.busy ? "disabled" : ""}`;
  return `<section tabindex="0" aria-label="${esc(node.title)}" class="spec-card plan-${esc(node.progress || "unknown")} ${store.drafts.has(node.path) ? "dirty" : ""}" data-node="${esc(node.path)}"><header><button class="card-title field-button" ${field("title", node.title)}>${esc(node.title)}</button>${privacy(node)}</header><div class="ribbon"><button class="field-button card-purpose ${node.content ? "" : "is-empty"}" ${field("purpose", node.content || tr("Add a purpose", "填写摘要"))}><span>${esc(node.content) || tr("Add a purpose…", "填写摘要…")}</span></button></div><div class="card-foot"><button data-doc="${esc(node.path)}">${tr("Open", "打开")}</button><button class="progress-label" ${field("progress", progressLabel(node.progress))}>${esc(progressLabel(node.progress))}</button></div></section>`;
}
function layoutNodes(nodes, dragOffsets = new Map()) {
  const columns = new Map();
  for (const node of nodes) {
    if (!columns.has(node.col)) columns.set(node.col, []);
    columns.get(node.col).push(node);
  }
  const result = new Map(), rows = Math.max(0, ...[...columns.values()].map(list => list.length));
  for (const [col, list] of columns) list.forEach((node, i) => {
    const offset = dragOffsets.get(node.path) || { x: 0, y: 0 };
    result.set(node.path, { x: 48 + (col - 1) * (CARD.width + CARD.columnGap) + offset.x,
      y: 46 + ((rows - list.length) / 2 + i) * (CARD.height + CARD.rowGap) + offset.y, w: CARD.width, h: CARD.height });
  });
  return result;
}
const PORT_SIDES = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
function centerOf(p) { return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; }
function portAt(p, side, offset) {
  const c = centerOf(p), [dx, dy] = PORT_SIDES[side];
  return { x: c.x + dx * (p.w / 2 + 10) + (dy ? offset : 0),
    y: c.y + dy * (p.h / 2 + 10) + (dx ? offset : 0) };
}
// Directional ports and stable sibling fan-out, not an obstacle-avoidance router.
function routeEdges(edges, layout) {
  const groups = new Map();
  const routed = edges.map(edge => {
    const a = layout.get(edge.from), b = layout.get(edge.to), ac = centerOf(a), bc = centerOf(b);
    const dx = bc.x - ac.x, dy = bc.y - ac.y;
    const sides = Math.abs(dx) >= Math.abs(dy) * .85 ? (dx >= 0 ? ["right", "left"] : ["left", "right"]) : (dy >= 0 ? ["bottom", "top"] : ["top", "bottom"]);
    const item = { ...edge, a, b, fromSide: sides[0], toSide: sides[1], fromOffset: 0, toOffset: 0 };
    for (const end of ["from", "to"]) {
      const key = edge[end] + "\0" + item[end + "Side"];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ item, end, far: centerOf(end === "from" ? b : a) });
    }
    return item;
  });
  for (const group of groups.values()) {
    const { item, end } = group[0], host = end === "from" ? item.a : item.b;
    const horizontal = ["left", "right"].includes(item[end + "Side"]), axis = horizontal ? "y" : "x";
    group.sort((a, b) => a.far[axis] - b.far[axis] || a.item.from.localeCompare(b.item.from) || a.item.to.localeCompare(b.item.to));
    const mid = group.findIndex(port => Math.abs(port.far[axis] - centerOf(host)[axis]) <= 6);
    const origin = mid >= 0 ? mid : (group.length - 1) / 2;
    const distance = Math.max(origin, group.length - 1 - origin, 1);
    const step = Math.min(18, (horizontal ? host.h : host.w) * .275 / distance);
    group.forEach((port, i) => { port.item[port.end + "Offset"] = (i - origin) * step; });
  }
  return routed;
}
function edgePath(edge) {
  const s = portAt(edge.a, edge.fromSide, edge.fromOffset), t = portAt(edge.b, edge.toSide, edge.toOffset);
  const sv = PORT_SIDES[edge.fromSide], tv = PORT_SIDES[edge.toSide];
  const bend = Math.max(28, Math.min(150, Math.hypot(t.x - s.x, t.y - s.y) * .42));
  return `M${s.x},${s.y} C${s.x + sv[0] * bend},${s.y + sv[1] * bend} ${t.x + tv[0] * bend},${t.y + tv[1] * bend} ${t.x},${t.y}`;
}
function transform() {
  $("viewport").style.transform = `translate(${pan.x}px,${pan.y}px) scale(${scale})`;
  updateTools();
  $("graph").style.backgroundPosition = `${pan.x}px ${pan.y}px`;
  $("graph").style.backgroundSize = `${34 * scale}px ${34 * scale}px`;
  updateMiniView();
}
function renderGraph() {
  if (fieldEditor) { updateTools(); return; } // Never replace a native input during previews.
  if (drag) { graphRenderPending = true; updateTools(); return; }
  graphRenderPending = false;
  const focusEdge = document.activeElement.matches('.edge-hit') ? edgeViews[Number(document.activeElement.dataset.edge)] : null;
  const focused = $("graph-cards").contains(document.activeElement) ? document.activeElement : null;
  const focusPath = focused?.closest('[data-node]')?.dataset.node;
  const focusControl = focused?.dataset.field ? `[data-field="${CSS.escape(focused.dataset.field)}"]` : focused?.hasAttribute('data-doc') ? '[data-doc]' : null;
  $("graph").style.setProperty("--card-width", CARD.width + "px");
  $("graph").style.setProperty("--card-height", CARD.height + "px");
  positions = layoutNodes(graph.nodes, offsets);
  $("graph-cards").innerHTML = graph.nodes.map(cardHTML).join("");
  $("graph-empty").hidden = !!graph.nodes.length;
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
  edgeViews = routeEdges(edgeViews, positions);
  $("edge-lines").innerHTML = edgeViews.map((edge, index) => {
    const d = edgePath(edge);
    const label = esc((catalogEntry(edge.from)?.title || edge.from) + " → " + (catalogEntry(edge.to)?.title || edge.to) + tr(". Open dependency actions", "。打开依赖操作"));
    return `<path class="edge-hit" data-edge="${index}" d="${d}" tabindex="0" role="button" aria-label="${label}" aria-controls="edge-detail"></path><path class="edge" data-edge="${index}" d="${d}" aria-hidden="true"></path>`;
  }).join("");
  const paths = [...$("edge-lines").children];
  for (let i = 0; i < edgeViews.length; i++) edgeViews[i].elements = paths.slice(i * 2, i * 2 + 2);
  renderMinimap(); selectNode(selectedNode);
  // Fit once, synchronously against the first visible, populated board. Never
  // leave a delayed camera reset that could overwrite the user's next gesture.
  if (!graphReady && positions.size && $("graph").clientWidth && $("graph").clientHeight) {
    graphReady = true; fitGraph();
  } else transform();
  if (focusPath) {
    const card = cardElement(focusPath);
    (focusControl ? card?.querySelector(focusControl) : card)?.focus({ preventScroll: true });
    if (!card) $("workspace").focus({ preventScroll: true });
  } else if (focusEdge) {
    const index = edgeViews.findIndex(e => e.from === focusEdge.from && e.to === focusEdge.to);
    ($("edge-lines").querySelector(`.edge-hit[data-edge="${index}"]`) || $("workspace")).focus({ preventScroll: true });
  }
}
function fitGraph() {
  if (zoomLocked || !positions.size) return;
  const values = [...positions.values()];
  const left = Math.min(...values.map(p => p.x)), top = Math.min(...values.map(p => p.y));
  const right = Math.max(...values.map(p => p.x + p.w)), bottom = Math.max(...values.map(p => p.y + p.h));
  const bounds = $("graph").getBoundingClientRect();
  const topSpace = $("minimap").getBoundingClientRect().height + 36, bottomSpace = 70;
  scale = Math.min(1, Math.max(.25, Math.min((bounds.width - 50) / (right - left), (bounds.height - topSpace - bottomSpace) / (bottom - top))));
  pan = { x: (bounds.width - (right - left) * scale) / 2 - left * scale, y: topSpace - top * scale };
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
  if (path && !positions.has(path)) path = null;
  selectedNode = path;
  const neighbors = new Set([path]);
  for (const edge of edgeViews) if (edge.from === path || edge.to === path) { neighbors.add(edge.from); neighbors.add(edge.to); }
  const matched = new Set(graph.nodes.filter(matches).map(n => n.path));
  for (const el of $("graph-cards").children) {
    el.classList.toggle("selected", el.dataset.node === path);
    el.classList.toggle("search-match", !!query && matched.has(el.dataset.node));
    el.classList.toggle("connect-origin", el.dataset.node === connectFrom);
    el.style.opacity = matched.has(el.dataset.node) && (connectMode || !path || neighbors.has(el.dataset.node)) ? "1" : ".3";
  }
  for (const edge of edgeViews) for (const el of edge.elements) {
    const active = edge.from === path || edge.to === path;
    el.classList.toggle("selected", active);
    el.classList.toggle("dim", !!path && !active);
  }
  $("edge-detail").hidden = true;
}
function updateMiniView() {
  const box = $("graph").getBoundingClientRect(), rect = $("mini-view");
  if (!box.width || !box.height) return;
  const view = { x: -pan.x / scale, y: -pan.y / scale, w: box.width / scale, h: box.height / scale };
  rect.setAttribute("x", view.x); rect.setAttribute("y", view.y);
  rect.setAttribute("width", view.w); rect.setAttribute("height", view.h);
  if (miniDragId === null) {
    // Show the whole viewport frame, even when the graph is smaller than it.
    // Keep this coordinate system fixed during a minimap drag.
    const x = Math.min(miniBounds.x, view.x) - 20, y = Math.min(miniBounds.y, view.y) - 20;
    const right = Math.max(miniBounds.x + miniBounds.w, view.x + view.w) + 20;
    const bottom = Math.max(miniBounds.y + miniBounds.h, view.y + view.h) + 20;
    $("minimap").setAttribute("viewBox", `${x} ${y} ${right - x} ${bottom - y}`);
  }
}
function renderMinimap() {
  const values = [...positions.values()];
  if (!values.length) { $("mini-nodes").innerHTML = ""; return; }
  const left = Math.min(...values.map(p => p.x)), top = Math.min(...values.map(p => p.y));
  const right = Math.max(...values.map(p => p.x + p.w)), bottom = Math.max(...values.map(p => p.y + p.h));
  miniBounds = { x: left - 20, y: top - 20, w: right - left + 40, h: bottom - top + 40 };
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
$("minimap").addEventListener("pointerdown", event => {
  if (event.button !== 0 || miniDragId !== null) return;
  miniDragId = event.pointerId; $("minimap").setPointerCapture(event.pointerId); panMini(event); event.stopPropagation();
});
$("minimap").addEventListener("pointermove", event => { if ($("minimap").hasPointerCapture(event.pointerId)) panMini(event); });
$("minimap").addEventListener("lostpointercapture", () => { miniDragId = null; updateMiniView(); });
new ResizeObserver(updateMiniView).observe($("graph"));
const chromeObserver = new ResizeObserver(() => {
  $("app").style.setProperty("--header-height", document.querySelector(".top").getBoundingClientRect().height + "px");
  $("app").style.setProperty("--footer-height", $("status").getBoundingClientRect().height + "px");
  $("workspace").style.setProperty("--source-bar-height", document.querySelector(".source-bar").getBoundingClientRect().height + "px");
});
chromeObserver.observe(document.querySelector(".top")); chromeObserver.observe($("status"));
chromeObserver.observe(document.querySelector(".source-bar"));
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
    edgeViews = routeEdges(edgeViews, positions);
    for (const edge of edgeViews) {
      const d = edgePath(edge);
      // Shared-port siblings may move too; preserve all card and edge DOM nodes.
      if (edge.elements[0].getAttribute("d") !== d) for (const el of edge.elements) el.setAttribute("d", d);
    }
  } else {
    pan = { x: drag.pan.x + drag.lastX - drag.startX, y: drag.pan.y + drag.lastY - drag.startY }; transform();
  }
}

/* Presentation changes keep the same editor, history, source selection and page. */
async function setSourceMode(on) {
  if (store.busy || view !== "doc" || !store.base.has(current)) return;
  const navigation = ++navigationSequence, owner = store, path = current;
  if (!await finishEditing() || navigation !== navigationSequence || store !== owner || current !== path || view !== "doc") return;
  sourceMode = on;
  bodySurface?.model.setMode(on); renderMain(); renderChanges(false);
}
$("source-view").onclick = () => setSourceMode(!sourceMode);
$("save").onclick = save;
$("copy-agent").onclick = copyPrompt;
async function undoEdit() {
  if (store.busy || !await finishEditing()) return;
  const path = store.undo();
  if (path) { changed(tr("Edit undone.", "已撤销修改。")); renderMain(); }
}
$("export").onclick = async () => {
  if (!saveFailure || !store.drafts.size || !await finishEditing()) return;
  warnPrivate();
  const blob = new Blob([JSON.stringify({ project: graph.meta.root, edits: store.edits(), external: Object.fromEntries(conflicts), saveError: saveFailure }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = "docdoki-drafts.json"; anchor.click(); URL.revokeObjectURL(url);
  status(tr("Recovery copy downloaded.", "已下载恢复副本。"));
};
$("changes-toggle").onclick = async () => {
  if (await finishEditing()) setChanges(!$("app").classList.contains("changes-open"), true);
};
$("changes-close").onclick = () => setChanges(false);
$("library-toggle").onclick = () => {
  setLibrary($("library-toggle").getAttribute("aria-expanded") !== "true", true);
};
$("library-close").onclick = () => setLibrary(false);
$("language").onclick = () => {
  lang = lang === "en" ? "zh" : "en";
  try { localStorage.setItem("ddpanel-lang", lang); } catch {}
  localize(); renderMain(); renderCatalog(); renderChanges(); updateMeta(); renderDiagnostics(); syncDrawers();
  if (!$("status").classList.contains("error") && !store.busy) status();
};
function resetPathCopyFeedback() {
  pathCopySequence++; clearTimeout(pathCopiedTimer);
  if (pathCopyError && $("status").textContent === pathCopyError) status();
  pathCopyError = "";
  $("document-path").classList.remove("copied");
  $("document-path").removeAttribute("data-copied-label");
  $("path-copy-status").textContent = "";
}
async function copyDocumentPath(event) {
  if (view !== "doc" || !current) return;
  const el = $("document-path"), selection = window.getSelection();
  // Selecting the path is not a copy click; explicit keyboard activation still is.
  if (event?.type === "click" && selection && !selection.isCollapsed && selection.rangeCount &&
      selection.getRangeAt(0).intersectsNode(el)) return;
  resetPathCopyFeedback();
  const sequence = pathCopySequence, path = current, navigation = navigationSequence;
  const relevant = () => sequence === pathCopySequence && navigation === navigationSequence && view === "doc" && path === current;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(path);
    if (!relevant()) return;
    el.setAttribute("data-copied-label", tr("✓ Copied!", "✓ 已复制！"));
    el.classList.add("copied");
    $("path-copy-status").textContent = tr("Document path copied.", "文档路径已复制。");
    pathCopiedTimer = setTimeout(resetPathCopyFeedback, 1500);
  } catch {
    if (relevant()) {
      pathCopyError = tr("Could not copy. Select the document path and copy it manually.", "复制失败，请选中文档路径后手动复制。");
      status(pathCopyError, true);
    }
  }
}
$("document-path").onclick = copyDocumentPath;
$("document-path").onkeydown = event => {
  if (!event.isComposing && !event.repeat && view === "doc" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    copyDocumentPath();
  }
};
$("search").addEventListener("input", () => {
  query = $("search").value.trim();
  if (query) setLibrary(true);
  renderCatalog(); if (view === "graph") selectNode(selectedNode);
});
$("fit").onclick = fitGraph;
$("zoom-in").onclick = () => zoom(1.2);
$("zoom-out").onclick = () => zoom(1 / 1.2);
$("zoom-label").onclick = () => { zoomLocked = !zoomLocked; updateTools(); };
$("reset-layout").onclick = resetLayout;
$("connect").onclick = toggleConnect;
document.addEventListener("click", async event => {
  const target = event.target;
  if (target.closest('.cm-editor')) return;
  if (target.closest(".field-editor")) return;
  const field = target.closest("[data-field]");
  if (field) return beginField(field.dataset.path, field.dataset.field, event);
  const doc = target.closest("[data-doc]");
  if (doc) { event.preventDefault(); openDocument(doc.dataset.doc, doc.dataset.anchor || ""); return; }
  const nav = target.closest("[data-nav]"); if (nav) { navigate(nav.dataset.nav); return; }
  const discard = target.closest("[data-discard]");
  if (discard) return discardChanges(discard.dataset.discard);
  if (target.closest("[data-close-edge]")) { closeEdge(); return; }
  const remove = target.closest("[data-remove-after]");
  if (remove) return changeDependency(remove.dataset.path, remove.dataset.removeAfter, true);
  const card = target.closest("#graph [data-node]");
  if (card) return activateCard(card.dataset.node);
  const edgeEl = target.closest("[data-edge]");
  if (edgeEl) {
    const edge = edgeViews[Number(edgeEl.dataset.edge)];
    if (!edge || !await finishEditing()) return;
    $("edge-detail").hidden = false;
    $("edge-detail").dataset.edge = edgeEl.dataset.edge;
    setHTML($("edge-detail"), `<button data-close-edge aria-label="${tr("Close", "关闭")}">×</button><p>${esc(catalogEntry(edge.from)?.title || edge.from)} → ${esc(catalogEntry(edge.to)?.title || edge.to)}</p><button data-remove-after="${esc(edge.stem)}" data-path="${esc(edge.to)}" ${store.busy ? "disabled" : ""}>${tr("Remove dependency", "移除依赖")}</button>`);
    if (!event.detail) $("edge-detail").querySelector("[data-remove-after]")?.focus();
  }
});
function closeEdge() {
  const index = $("edge-detail").dataset.edge;
  const restore = $("edge-detail").contains(document.activeElement);
  selectNode(null);
  if (restore) $("edge-lines").querySelector(`.edge-hit[data-edge="${index}"]`)?.focus();
}
document.addEventListener("keydown", event => {
  if (event.isComposing || composing) return;
  if (event.key === "Escape" && !$("edge-detail").hidden) { event.preventDefault(); closeEdge(); return; }
  if (event.target.matches(".edge-hit") && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return;
  }
  if (event.key === "Escape") {
    if (event.target === $("search") && query) { $("search").value = ""; $("search").dispatchEvent(new Event("input")); }
    else if ($("app").classList.contains("changes-open")) setChanges(false);
    else if (window.innerWidth <= 760 && $("app").classList.contains("library-open")) setLibrary(false);
    else if (fieldEditor) { event.preventDefault(); cancelField(); return; }
  }
  if (store.busy || event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undoEdit(); }
  if (event.key === "/") { event.preventDefault(); $("search").focus(); }
  if (event.target.dataset.node && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    activateCard(event.target.dataset.node);
  }
  if (view === "graph" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (event.key === "+" || event.key === "=") zoom(1.2);
    if (event.key === "-") zoom(1 / 1.2);
    if (event.key === "0") fitGraph();
    if (event.key.toLowerCase() === "r") resetLayout();
    if (event.key.toLowerCase() === "c") toggleConnect();
    if (event.key === "Escape") { if (connectMode) setConnect(false); else selectNode(null); }
  }
});
window.addEventListener("beforeunload", event => {
  if (store.drafts.size || store.busy || fieldDirty() || bodyDirty()) { event.preventDefault(); event.returnValue = ""; }
});
$("graph").addEventListener("pointerdown", event => {
  if (event.button !== 0 || event.target.closest("button,input,textarea,select,.field-editor,.graph-tools,.edge-detail,[data-edge],#minimap")) return;
  const handle = event.target.closest("[data-node]");
  drag = { startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, pan: { ...pan } };
  if (handle) {
    const path = handle.dataset.node;
    Object.assign(drag, { path, element: handle.closest(".spec-card"), position: { ...positions.get(path) },
      offset: offsets.get(path) || { x: 0, y: 0 } });
  }
  $("graph").setPointerCapture(event.pointerId); event.preventDefault();
});
$("graph").addEventListener("pointermove", event => {
  if (!drag) return;
  drag.lastX = event.clientX; drag.lastY = event.clientY;
  if (!frame) frame = requestAnimationFrame(drawDrag);
});
function endDrag(event) {
  if (frame) { cancelAnimationFrame(frame); drawDrag(); }
  const clicked = drag && Math.hypot(drag.lastX - drag.startX, drag.lastY - drag.startY) < 4;
  const path = drag?.path;
  if (path) renderMinimap(); drag = null;
  if (graphRenderPending && view === "graph") renderGraph();
  if (clicked && event.type === "pointerup") activateCard(path || null);
}
$("graph").addEventListener("pointerup", endDrag);
$("graph").addEventListener("pointercancel", endDrag);
$("graph").addEventListener("lostpointercapture", endDrag);
$("graph").addEventListener("wheel", event => {
  if (event.target.closest("textarea,input,select,.edge-detail")) return;
  event.preventDefault();
  if (event.ctrlKey || event.metaKey || event.altKey) {
    const box = $("graph").getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, { x: event.clientX - box.x, y: event.clientY - box.y });
  }
  else { pan.x -= event.shiftKey ? event.deltaY : event.deltaX; pan.y -= event.shiftKey ? 0 : event.deltaY; transform(); }
}, { passive: false });

for (const width of [760, 1100]) matchMedia(`(max-width: ${width}px)`).addEventListener("change", () => {
  if (window.innerWidth <= 1100 && $("workspace").contains(document.activeElement)) setChanges(false);
  if (window.innerWidth <= 760 && $("app").classList.contains("changes-open")) $("app").classList.remove("library-open");
  syncDrawers();
});
localize(); updateMeta(); renderCatalog(); renderMain(); renderChanges(); renderDiagnostics(); syncDrawers();
window.addEventListener("focus", syncDocuments);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncDocuments(); });
