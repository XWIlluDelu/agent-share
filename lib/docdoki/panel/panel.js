/* DOM views consume parsed previews; only DraftStore owns editable sources. */
const $ = (id) => document.getElementById(id);

const esc = escapeHTML;

let graph = INITIAL_GRAPH;

let store = new DraftStore(graph.documents);

let lang = "en";

try {
  lang = localStorage.getItem("ddpanel-lang") === "zh" ? "zh" : "en";
} catch {}

const tr = (en, zh) => (lang === "zh" ? zh : en);

const OVERVIEW = "docdoki/spec_abstract.md";

let current = OVERVIEW,
  view = "graph",
  sourceMode = false,
  navigationSequence = 0;

let query = "",
  previewTimer = null,
  previewSequence = 0;

let statusTimer = null;

const archiveOpen = new Set();

const renderedHTML = new WeakMap();

let previewPending = false,
  previewError = null;

let pathCopySequence = 0,
  pathCopyNavigation = -1,
  pathCopiedTimer = null,
  pathCopyError = "";

function setHTML(element, html) {
  if (renderedHTML.get(element) === html) return false;
  element.innerHTML = html;
  renderedHTML.set(element, html);
  return true;
}

function localize() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-en]").forEach((el) => {
    el.textContent = el.dataset[lang];
  });
  document.querySelectorAll("[data-en-label]").forEach((el) => {
    el.setAttribute("aria-label", el.dataset[lang + "Label"]);
    if (el.matches(".graph-tools button")) el.title = el.dataset[lang + "Label"];
  });
  $("language").textContent = lang === "zh" ? "EN" : "中";
  $("search").placeholder = tr("Search", "搜索");
  bodySurface?.model.localize();
  if (fieldEditor) {
    // Translate labels without rebuilding the card that owns native input.
    fieldEditor.input.setAttribute("aria-label", fieldLabel(fieldEditor.field));
    for (const button of $("graph-cards").querySelectorAll("[data-field]"))
      button.setAttribute("aria-label", tr("Edit ", "修改") + fieldLabel(button.dataset.field));
    for (const button of $("graph-cards").querySelectorAll("[data-doc]"))
      button.textContent = tr("Open", "打开");
    for (const button of $("graph-cards").querySelectorAll('[data-field="progress"]'))
      button.textContent = progressLabel(graph.nodes.find((n) => n.path === button.dataset.path)?.progress);
    for (const option of fieldEditor.input.options || [])
      if (["", "not-started", "in-progress", "done"].includes(option.value))
        option.textContent = progressLabel(option.value);
  }
  if (pathCopyNavigation !== navigationSequence) {
    resetPathCopyFeedback();
    pathCopyNavigation = navigationSequence;
  }
  if (view === "doc" && current) {
    $("document-path").title = tr("Click to copy path", "点击复制路径");
    $("document-path").tabIndex = 0;
    $("document-path").setAttribute("role", "button");
    $("document-path").setAttribute(
      "aria-label",
      tr("Document path: ", "文档路径：") + current + tr(". Click to copy", "。点击复制"),
    );
  } else {
    $("document-path").title = "";
    $("document-path").removeAttribute("tabindex");
    $("document-path").removeAttribute("role");
    $("document-path").removeAttribute("aria-label");
  }
  renderPreviewStatus();
  updateTools();
}

function status(message = "", error = false) {
  clearTimeout(statusTimer);
  if ($("status").textContent !== message) $("status").textContent = message;
  $("status").classList.toggle("error", error);
  if (message)
    statusTimer = setTimeout(
      () => {
        $("status").textContent = "";
      },
      error ? 8000 : 3500,
    );
}

function privacy(doc) {
  return doc?.private ? `<span class="private-tag">${tr("Private", "私有")}</span>` : "";
}

function draftTag(path) {
  return store.drafts.has(path) ? `<span class="draft-tag">${tr("Draft", "草稿")}</span>` : "";
}

function docButton(doc) {
  const duplicate = graph.catalog.some((d) => d.path !== doc.path && d.title === doc.title);
  return `<button class="doc-link ${doc.path === current && view === "doc" ? "selected" : ""}" ${doc.path === current && view === "doc" ? 'aria-current="page"' : ""} data-doc="${esc(doc.path)}" title="${esc(doc.path)}">${esc(doc.title)}${privacy(doc)}${draftTag(doc.path)}${duplicate ? `<small>${esc(doc.path)}</small>` : ""}</button>`;
}

function matches(doc) {
  const q = query.toLocaleLowerCase();
  return (
    !q ||
    [doc.title, doc.path, store.source(doc.path)].some((value) =>
      String(value || "")
        .toLocaleLowerCase()
        .includes(q),
    )
  );
}

function catalogEntry(path) {
  return graph.catalog.find((d) => d.path === path);
}

function currentDocument() {
  return graph.documents[current] || store.base.get(current);
}

function syncDrawers() {
  const mobile = window.innerWidth <= 760;
  const library = mobile
    ? $("app").classList.contains("library-open")
    : !$("app").classList.contains("library-closed");
  const changes = $("app").classList.contains("changes-open");
  $("library").inert = !library;
  $("changes").inert = !changes;
  $("workspace").inert = (mobile && library) || changes;
  if (!library && $("library").contains(document.activeElement)) $("library-toggle").focus();
  if (!changes && $("changes").contains(document.activeElement)) $("changes-toggle").focus();
  if ($("workspace").inert && $("workspace").contains(document.activeElement))
    $(changes ? "changes-close" : "library-close").focus();
  $("library-toggle").setAttribute("aria-expanded", String(library));
  $("library-toggle").title = library
    ? tr("Collapse navigation", "收起导航")
    : tr("Expand navigation", "展开导航");
  $("library-toggle").setAttribute("aria-label", $("library-toggle").title);
  $("changes-toggle").setAttribute("aria-expanded", String(changes));
}

function setChanges(open, focus = false) {
  const restore = !open && $("changes").contains(document.activeElement);
  $("app").classList.toggle("changes-open", open);
  if (open) renderChanges();
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
  if (open && focus)
    $("library")
      .querySelector(mobile ? "#library-close" : "[data-nav]")
      .focus();
  else if (restore) $("library-toggle").focus();
}

function focusDocument(anchor = "") {
  if (anchor && bodySurface?.model.jump(anchor)) return;
  const heading = $("reading").querySelector('[role="heading"],h1') || $("workspace");
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

function updateMeta() {
  $("project-name").textContent = graph.meta.title;
}

function renderCatalog() {
  $("catalog")
    .querySelectorAll("details")
    .forEach((el) => {
      if (el.open) archiveOpen.add(el.dataset.group);
      else archiveOpen.delete(el.dataset.group);
    });
  const groups = [
    ["spec", tr("Specs", "规格")],
    ["stage", tr("Active stages", "进行中阶段")],
    ["note", tr("Notes", "笔记")],
  ];
  let html = "";
  for (const [kind, label] of groups) {
    const docs = graph.catalog.filter((d) => d.kind === kind && !d.archived && matches(d));
    if (!docs.length) continue;
    html += `<section class="catalog-group"><h3>${label}</h3>${docs.map(docButton).join("")}</section>`;
  }
  const archived = graph.catalog.filter((d) => d.archived && matches(d));
  if (archived.length)
    html += `<details class="catalog-group" data-group="archive" ${archiveOpen.has("archive") || query ? "open" : ""}><summary>${tr("Archive", "归档")} (${archived.length})</summary>${archived.map(docButton).join("")}</details>`;
  const focused = $("catalog").contains(document.activeElement) ? document.activeElement.dataset.doc : null;
  if (
    setHTML(
      $("catalog"),
      html || `<p class="notice">${tr("No matching documents.", "没有匹配文档。")}</p>`,
    ) &&
    focused
  )
    $("catalog")
      .querySelector(`[data-doc="${CSS.escape(focused)}"]`)
      ?.focus({ preventScroll: true });
}

/* Resolve links without fetching images or rendering source HTML. */
function resolveLink(href, from = current) {
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return { external: href };
  if (href.startsWith("#")) {
    try {
      return { path: from, anchor: decodeURIComponent(href.slice(1)) };
    } catch {
      return null;
    }
  }
  let target = href,
    anchor = "";
  const hash = target.indexOf("#");
  if (hash >= 0) {
    anchor = target.slice(hash + 1);
    target = target.slice(0, hash);
  }
  try {
    target = decodeURIComponent(target);
    anchor = decodeURIComponent(anchor);
  } catch {
    return null;
  }
  if (target.startsWith("wiki:")) {
    const stem = target.slice(5).replace(/\.md$/, "");
    const found = graph.catalog.filter((d) => d.stem === stem || d.path === stem || d.path === stem + ".md");
    return found.length === 1 ? { path: found[0].path, anchor } : null;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) return null;
  const components = target.startsWith("docdoki/") ? [] : from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") components.pop();
    else if (part && part !== ".") components.push(part);
  }
  const path = components.join("/");
  const found = graph.catalog.find((d) => d.path === path);
  return found ? { path: found.path, anchor } : null;
}

// The live editor uses only the lexer for reference definitions.
const markdown = new marked.Marked({ gfm: true });

function renderDiagnostics() {
  const diagnostics = graph.diagnostics || [];
  $("diagnostics").hidden = !diagnostics.length;
  $("diagnostic-list").innerHTML = diagnostics
    .map(
      (d) =>
        `<li><button data-doc="${esc(d.path)}">${esc(catalogEntry(d.path)?.title || d.path)}</button>: ${esc(d.message)}</li>`,
    )
    .join("");
}

function renderRelated(doc) {
  const related = Object.values(graph.documents).filter(
    (d) =>
      d.path !== doc.path &&
      (d.source.includes("[[" + doc.stem + "]]") ||
        d.source.includes("[[" + doc.stem + "#") ||
        d.source.includes("[[" + doc.stem + "|") ||
        d.source.includes(doc.path)),
  );
  setHTML(
    $("related"),
    related.length
      ? `<details><summary>${tr("Related documents", "相关文档")}<span class="related-kind">${tr("Navigation", "文档导航")}</span></summary><div class="related-links">${related.map(docButton).join("")}</div></details>`
      : "",
  );
}

function renderMain() {
  const active =
    view === "graph"
      ? "dashboard"
      : view === "work"
        ? "work"
        : current === OVERVIEW
          ? "overview"
          : current === "docdoki/northstar.md"
            ? "northstar"
            : null;
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === active);
    if (el.dataset.nav === active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  $("source-view").hidden = view !== "doc";
  $("source-view").disabled = store.busy || !store.base.has(current);
  $("source-view").classList.toggle("active", sourceMode);
  $("source-view").setAttribute("aria-pressed", String(sourceMode));
  $("source-view").setAttribute("aria-label", tr("Source view", "源码视图"));
  $("source-view").title = sourceMode
    ? tr("Show rendered document", "显示正文预览")
    : tr("Show source", "显示源码");
  $("reader").hidden = view === "graph";
  $("graph").hidden = view !== "graph";
  if (view !== "doc" && bodySurface) {
    bodySurface.model.destroy();
    bodySurface = null;
    renderedHTML.delete($("reading"));
  }
  $("reading").classList.toggle("is-source", view === "doc" && sourceMode);
  $("document-path").classList.toggle("view-name", view !== "doc");
  if (view === "graph") {
    $("document-path").textContent = tr("Dashboard", "看板");
    renderGraph();
  } else if (view === "work") {
    $("document-path").textContent = tr("Current work", "当前工作");
    const docs = Object.values(graph.documents).filter((d) => d.kind === "stage" && !d.archived);
    setHTML(
      $("reading"),
      `<h1>${tr("Current work", "当前工作")}</h1>` +
        (docs.length
          ? docs.map(docButton).join("")
          : `<p>${tr("No active work.", "没有进行中的工作。")}</p>`),
    );
    setHTML($("related"), "");
  } else {
    const doc = currentDocument();
    $("document-path").innerHTML = esc(current) + privacy(doc) + draftTag(current);
    if (!bodyEditor) renderBody(doc);
    if (doc) renderRelated(doc);
    else setHTML($("related"), "");
  }
  $("workspace").setAttribute(
    "aria-label",
    view === "doc" ? currentDocument()?.title || current : $("document-path").textContent,
  );
  localize();
}

async function request(route, payload, timeout = 15000) {
  const controller = new AbortController();
  const captured = route === "/preview" ? new Map(store.base) : null;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { "X-DocDoki-Token": SAVE_TOKEN };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(route, {
      method: payload === undefined ? "GET" : "POST",
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        response.status === 413
          ? tr(
              "Request exceeds capacity. Your edits are kept; reduce the edit batch.",
              "请求超出容量，修改已保留；请缩小修改批次。",
            )
          : "HTTP " +
            response.status +
            ": " +
            text
              .replace(/<[^>]*>/g, " ")
              .trim()
              .slice(0, 160),
      );
    }
    if (!response.ok && !result.error) throw new Error("HTTP " + response.status);
    if (result.ok && result.graph?.documentRefs) {
      for (const [path, revision] of Object.entries(result.graph.documentRefs)) {
        const doc = captured?.get(path);
        if (!doc || doc.revision !== revision)
          throw new Error("Preview reference does not match its captured source: " + path);
        result.graph.documents[path] = doc;
      }
      delete result.graph.documentRefs;
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function renderPreviewStatus() {
  $("preview-status").hidden = !previewError;
  const message = previewError
    ? tr("Preview could not update. Your edits are kept.", "预览未能更新，修改已保留。")
    : "";
  $("preview-status").title = previewError || "";
  if ($("preview-status").textContent !== message) $("preview-status").textContent = message;
  $("reading").setAttribute("aria-busy", String(previewPending));
}

function invalidatePreview() {
  clearTimeout(previewTimer);
  previewSequence++;
  previewPending = false;
  previewError = null;
  renderPreviewStatus();
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewSequence++;
  previewPending = true;
  previewError = null;
  renderPreviewStatus();
  previewTimer = setTimeout(updatePreview, 200);
}

async function updatePreview() {
  clearTimeout(previewTimer);
  const sequence = ++previewSequence,
    previous = store,
    version = store.version;
  if (store.busy) return;
  try {
    const result = await request("/preview", capturedSources());
    if (sequence !== previewSequence || store !== previous || version !== store.version || store.busy) return;
    if (!result.ok) throw new Error(result.error);
    graph = result.graph;
    // A preview must never silently replace a baseline or an active textarea.
    previewPending = false;
    previewError = null;
    renderPreviewStatus();
    renderDiagnostics();
    renderCatalog();
    renderMain();
  } catch (error) {
    if (sequence !== previewSequence || store !== previous || version !== store.version) return;
    previewPending = false;
    previewError = error.message;
    renderPreviewStatus();
  }
}

async function openDocument(path, anchor = "") {
  if (store.busy) return;
  const navigation = ++navigationSequence,
    previous = store;
  if (!(await finishEditing()) || navigation !== navigationSequence) return;
  if (!store.base.has(path)) {
    try {
      const doc = await request("/document?path=" + encodeURIComponent(path));
      if (doc.error && !doc.source) throw new Error(doc.error);
      if (navigation !== navigationSequence || store.busy) return;
      if (store !== previous) return openDocument(path, anchor);
      store.addDocument(doc);
      graph.documents[path] = doc;
      const entry = catalogEntry(path);
      if (entry) entry.title = doc.title;
    } catch (error) {
      status(error.message, true);
      return;
    }
  }
  current = path;
  view = "doc";
  sourceMode = false;
  setConnect(false);
  renderMain();
  renderCatalog();
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
  if (!(await finishEditing()) || navigation !== navigationSequence) return;
  sourceMode = false;
  setConnect(false);
  view = next === "work" ? "work" : "graph";
  if (view === "graph") current = OVERVIEW;
  renderMain();
  renderCatalog();
  if (window.innerWidth <= 760) setLibrary(false);
  setChanges(false);
  $("workspace").focus({ preventScroll: true });
}

function capturedSources() {
  return {
    edits: store.edits(),
    baseRefs: Object.fromEntries([...store.base].map(([p, d]) => [p, d.revision])),
  };
}

const chromeObserver = new ResizeObserver(() => {
  $("app").style.setProperty(
    "--header-height",
    document.querySelector(".top").getBoundingClientRect().height + "px",
  );
  $("app").style.setProperty("--footer-height", $("status").getBoundingClientRect().height + "px");
  $("workspace").style.setProperty(
    "--source-bar-height",
    document.querySelector(".source-bar").getBoundingClientRect().height + "px",
  );
});

chromeObserver.observe(document.querySelector(".top"));

chromeObserver.observe($("status"));

chromeObserver.observe(document.querySelector(".source-bar"));

$("source-view").onclick = () => setSourceMode(!sourceMode);

$("save").onclick = save;

$("copy-agent").onclick = copyPrompt;

async function undoEdit() {
  if (store.busy || !(await finishEditing())) return;
  const path = store.undo();
  if (path) {
    changed(tr("Edit undone.", "已撤销修改。"));
    schedulePreview();
    renderMain();
  }
}

$("export").onclick = async () => {
  if (!saveFailure || !store.drafts.size || !(await finishEditing())) return;
  warnPrivate();
  const blob = new Blob(
    [
      JSON.stringify(
        {
          project: graph.meta.root,
          edits: store.edits(),
          external: Object.fromEntries(conflicts),
          saveError: saveFailure,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "docdoki-drafts.json";
  anchor.click();
  URL.revokeObjectURL(url);
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
  try {
    localStorage.setItem("ddpanel-lang", lang);
  } catch {}
  renderMain();
  renderCatalog();
  renderChanges();
  renderDiagnostics();
  syncDrawers();
  if (!$("status").classList.contains("error") && !store.busy) status();
};

function resetPathCopyFeedback() {
  pathCopySequence++;
  clearTimeout(pathCopiedTimer);
  if (pathCopyError && $("status").textContent === pathCopyError) status();
  pathCopyError = "";
  $("document-path").classList.remove("copied");
  $("document-path").removeAttribute("data-copied-label");
  $("path-copy-status").textContent = "";
}

async function copyDocumentPath(event) {
  if (view !== "doc" || !current) return;
  const el = $("document-path"),
    selection = window.getSelection();
  // Selecting the path is not a copy click; explicit keyboard activation still is.
  if (
    event?.type === "click" &&
    selection &&
    !selection.isCollapsed &&
    selection.rangeCount &&
    selection.getRangeAt(0).intersectsNode(el)
  )
    return;
  resetPathCopyFeedback();
  const sequence = pathCopySequence,
    path = current,
    navigation = navigationSequence;
  const relevant = () =>
    sequence === pathCopySequence && navigation === navigationSequence && view === "doc" && path === current;
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
      pathCopyError = tr(
        "Could not copy. Select the document path and copy it manually.",
        "复制失败，请选中文档路径后手动复制。",
      );
      status(pathCopyError, true);
    }
  }
}

$("document-path").onclick = copyDocumentPath;

$("document-path").onkeydown = (event) => {
  if (!event.isComposing && !event.repeat && view === "doc" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    copyDocumentPath();
  }
};

$("search").addEventListener("input", () => {
  query = $("search").value.trim();
  if (query) setLibrary(true);
  renderCatalog();
  if (view === "graph") selectNode(selectedNode);
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (target.closest(".cm-editor")) return;
  if (target.closest(".field-editor")) return;
  const field = target.closest("[data-field]");
  if (field) return beginField(field.dataset.path, field.dataset.field, event);
  const doc = target.closest("[data-doc]");
  if (doc) {
    event.preventDefault();
    openDocument(doc.dataset.doc, doc.dataset.anchor || "");
    return;
  }
  const nav = target.closest("[data-nav]");
  if (nav) {
    navigate(nav.dataset.nav);
    return;
  }
  const discard = target.closest("[data-discard]");
  if (discard) return discardChanges(discard.dataset.discard);
  if (target.closest("[data-close-edge]")) {
    closeEdge();
    return;
  }
  const remove = target.closest("[data-remove-after]");
  if (remove) return changeDependency(remove.dataset.path, remove.dataset.removeAfter, true);
  const card = target.closest("#graph [data-node]");
  if (card) return activateCard(card.dataset.node);
  const edgeEl = target.closest("[data-edge]");
  if (edgeEl) openEdge(edgeEl, !event.detail);
});

document.addEventListener("keydown", (event) => {
  if (event.isComposing || composing) return;
  if (event.key === "Escape" && !$("edge-detail").hidden) {
    event.preventDefault();
    closeEdge();
    return;
  }
  if (event.target.matches(".edge-hit") && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return;
  }
  if (event.key === "Escape") {
    if (event.target === $("search") && query) {
      $("search").value = "";
      $("search").dispatchEvent(new Event("input"));
    } else if ($("app").classList.contains("changes-open")) setChanges(false);
    else if (window.innerWidth <= 760 && $("app").classList.contains("library-open")) setLibrary(false);
    else if (fieldEditor) {
      event.preventDefault();
      cancelField();
      return;
    }
  }
  if (
    store.busy ||
    event.target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
  )
    return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoEdit();
  }
  if (event.key === "/") {
    event.preventDefault();
    $("search").focus();
  }
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
    if (event.key === "Escape") {
      if (connectMode) setConnect(false);
      else selectNode(null);
    }
  }
});

window.addEventListener("beforeunload", (event) => {
  if (store.drafts.size || store.busy || fieldDirty() || bodyDirty()) {
    event.preventDefault();
    event.returnValue = "";
  }
});

matchMedia("(max-width: 760px)").addEventListener("change", () => {
  if (window.innerWidth <= 760 && $("app").classList.contains("changes-open"))
    $("app").classList.remove("library-open");
  syncDrawers();
});

bindEditing();
bindBoard();
updateMeta();
renderCatalog();
renderMain();
renderChanges();
renderDiagnostics();
syncDrawers();

window.addEventListener("focus", syncDocuments);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncDocuments();
});
