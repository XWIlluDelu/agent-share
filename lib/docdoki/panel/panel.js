/* Navigation, unit tree switcher, safe Markdown rendering, plain-Markdown source editing, search, and creation. */
const $ = (id) => document.getElementById(id);
const { DraftStore, diffOps, unifiedDiff, diffHTML, escapeHTML } = globalThis.DocDokiState;
const esc = escapeHTML;

let graph = INITIAL_GRAPH;
let store = new DraftStore(graph.documents);
let lang = "en";
let theme = "light";
let explicitUrlTheme = null;
const THEMES = ["light", "dark"];
function normalizeTheme(raw) {
  if (raw === "notion") return "light";
  if (raw === "linear") return "dark";
  return THEMES.includes(raw) ? raw : null;
}
try {
  lang = localStorage.getItem("ddpanel-lang") === "zh" ? "zh" : "en";
  explicitUrlTheme = normalizeTheme(new URLSearchParams(location.search).get("theme"));
  const savedTheme = normalizeTheme(localStorage.getItem("ddpanel-theme"));
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  theme = explicitUrlTheme || savedTheme || (systemDark ? "dark" : "light");
} catch {}
function unitHref(id) {
  const qs = new URLSearchParams();
  if (id && id !== "main") qs.set("unit", id);
  if (explicitUrlTheme) qs.set("theme", explicitUrlTheme);
  const str = qs.toString();
  return str ? "/?" + str : "/";
}
const tr = (en, zh) => (lang === "zh" ? zh : en);
function applyTheme() {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.dataset.theme = theme;
  void root.offsetHeight;
  root.classList.remove("theme-switching");
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    const active = btn.dataset.themeChoice === theme;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}
applyTheme();

const overviewPath = () => graph.meta?.overviewPath || "docdoki/overview.md";
const northstarPath = () => graph.meta?.northstarPath || "docdoki/northstar.md";
const currentUnitParam = () =>
  graph.meta?.unitId && graph.meta.unitId !== "main" ? "unit=" + encodeURIComponent(graph.meta.unitId) : "";

let current = overviewPath(),
  view = "dashboard", // "dashboard" | "work" | "doc"
  sourceMode = false,
  navigationSequence = 0,
  searchTimer = null,
  searchSequence = 0,
  statusTimer = null;

const archiveOpen = new Set();
const renderedHTML = new WeakMap();

let pathCopySequence = 0,
  pathCopiedTimer = null,
  sourceLineEnding = "\n";

function setHTML(element, html) {
  if (renderedHTML.get(element) === html) return false;
  element.innerHTML = html;
  renderedHTML.set(element, html);
  return true;
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

const CHEV_SVG =
  '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>';
const LOCK_SVG =
  '<svg class="lock-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></svg>';

function docButton(doc, showPrivacy = true) {
  const duplicate = graph.catalog.some(
    (d) => d.path !== doc.path && d.kind === doc.kind && d.archived === doc.archived && d.title === doc.title,
  );
  const selected = doc.path === current && view === "doc";
  return `<button class="doc-link ${selected ? "selected" : ""}" ${selected ? 'aria-current="page"' : ""} data-doc="${esc(doc.path)}" title="${esc(doc.path)}"><span class="doc-link-row"><span class="doc-link-title">${esc(doc.title)}${showPrivacy ? privacy(doc) : ""}</span>${draftTag(doc.path)}</span>${duplicate ? `<small>${esc(doc.path)}</small>` : ""}</button>`;
}

function renderDocList(docs) {
  const pub = docs.filter((d) => !d.private);
  const priv = docs.filter((d) => d.private);
  let out = pub.map((d) => docButton(d, false)).join("");
  if (priv.length) {
    out += `<div class="private-sub"><div class="private-divider">${LOCK_SVG}<span>${tr("Private", "私有")}</span></div>${priv.map((d) => docButton(d, false)).join("")}</div>`;
  }
  return out;
}

function catalogEntry(path) {
  return graph.catalog.find((d) => d.path === path);
}

function currentDocument() {
  return graph.documents[current] || store.base.get(current);
}

function draftOverrides() {
  return Object.fromEntries(store.drafts.entries());
}

function withUnitQuery(route) {
  const u = currentUnitParam();
  if (!u) return route;
  return route + (route.includes("?") ? "&" : "?") + u;
}

async function request(route, payload, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { "X-DocDoki-Token": SAVE_TOKEN };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(withUnitQuery(route), {
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
      throw new Error(response.status === 413 ? tr("Request exceeds 1 MiB limit.", "请求超过 1 MiB 限制。") : "HTTP " + response.status);
    }
    if (!response.ok && !result.error) throw new Error("HTTP " + response.status);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshGraph() {
  try {
    const result = await request("/transform", { overrides: draftOverrides() });
    if (result.ok) {
      graph = result.graph;
      renderDiagnostics();
      renderCatalog();
    }
  } catch {}
}

function stripFrontmatter(source) {
  const match = source.match(/^\uFEFF?---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/);
  return match ? source.slice(match[0].length) : source;
}

function slugHeading(text) {
  return String(text || "")
    .toLocaleLowerCase()
    .trim()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .replace(/\s+/g, "-");
}

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
  const unitLink = (graph.meta.units || []).find((u) => u.href === target || target.endsWith("/" + u.href));
  if (unitLink?.id) return { unitId: unitLink.id };

  const components = target.startsWith("docdoki/") ? [] : from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") components.pop();
    else if (part && part !== ".") components.push(part);
  }
  const path = components.join("/");
  const found = graph.catalog.find((d) => d.path === path);
  if (found) return { path: found.path, anchor };
  if (target && !target.startsWith("/")) return { repoFile: path || target };
  return null;
}

function renderInlineSnippet(text) {
  let out = esc(text || "");
  out = out.replace(/\[\[([^\]#|]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const stem = target.replace(/\.md$/, "").split("/").pop();
    const doc = graph.catalog.find((d) => d.stem === stem);
    const display = label || doc?.title || stem;
    return `<em>${esc(display)}</em>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

function renderMarkdownHTML(source) {
  const body = stripFrontmatter(source);
  const seenHeadings = new Map();
  const instance = new marked.Marked({ gfm: true, breaks: false });
  instance.use({
    extensions: [
      {
        name: "wikilink",
        level: "inline",
        start(src) {
          return src.indexOf("[[");
        },
        tokenizer(src) {
          const match = /^\[\[([^\]\n]+)\]\]/.exec(src);
          if (!match) return;
          const [raw, inner] = match;
          const [target, label] = inner.split("|");
          return { type: "wikilink", raw, target: target.trim(), label: (label || target).trim() };
        },
        renderer(token) {
          const resolved = resolveLink("wiki:" + token.target);
          if (resolved?.path) {
            return `<a class="md-link" href="#doc" data-doc="${esc(resolved.path)}" data-anchor="${esc(resolved.anchor || "")}" title="${esc(resolved.path)}">${esc(token.label)}</a>`;
          }
          return `<span class="unresolved" title="${esc(token.target)}">${esc(token.label)}</span>`;
        },
      },
    ],
    renderer: {
      html(token) {
        return esc(token.text ?? token.raw ?? "");
      },
      image(token) {
        return `<span class="md-image">[image: ${esc(token.text || token.href || "")}]</span>`;
      },
      heading(token) {
        const inner = this.parser.parseInline(token.tokens);
        const key = slugHeading(token.text);
        const count = seenHeadings.get(key) || 0;
        seenHeadings.set(key, count + 1);
        const id = "heading-" + key + (count ? "-" + count : "");
        return `<h${token.depth} id="${esc(id)}" tabindex="-1">${inner}</h${token.depth}>\n`;
      },
      link(token) {
        const label = this.parser.parseInline(token.tokens);
        const resolved = resolveLink(token.href || "");
        if (resolved?.unitId) {
          return `<a class="md-link unit-link" href="${esc(unitHref(resolved.unitId))}" data-unit="${esc(resolved.unitId)}">${label}</a>`;
        }
        if (resolved?.path) {
          return `<a class="md-link" href="#doc" data-doc="${esc(resolved.path)}" data-anchor="${esc(resolved.anchor || "")}" title="${esc(resolved.path)}">${label}</a>`;
        }
        if (resolved?.external) {
          return `<a class="md-link" href="${esc(resolved.external)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }
        if (resolved?.repoFile) {
          return `<span class="repo-ref" title="${esc(resolved.repoFile)}">${label}</span>`;
        }
        return `<span class="unresolved" title="${esc(token.href || "")}">${label}</span>`;
      },
    },
  });
  return instance.parse(body);
}

function renderDocMeta(doc) {
  const fm = doc?.fm || {};
  const pills = [];
  if (fm.area) pills.push(`<span class="meta-pill"><b>${tr("Area", "领域")}:</b> ${esc(fm.area)}</span>`);
  if (fm.status === "proposed")
    pills.push(`<span class="meta-pill is-proposed">${tr("Proposed", "提案")}</span>`);
  if (fm.progress)
    pills.push(`<span class="meta-pill plan-${esc(fm.progress)}">${esc(progressLabel(fm.progress))}</span>`);
  for (const [key, label] of [
    ["after", tr("After", "依赖")],
    ["specs", tr("Specs", "规格")],
    ["relates", tr("Relates", "关联")],
  ]) {
    if (Array.isArray(fm[key]) && fm[key].length) {
      const links = fm[key]
        .map((s) => {
          const t = graph.catalog.find((d) => d.stem === s);
          return t ? `<button class="inline-link" data-doc="${esc(t.path)}">${esc(t.title)}</button>` : esc(s);
        })
        .join(", ");
      pills.push(`<span class="meta-pill"><b>${label}:</b> ${links}</span>`);
    }
  }
  if (Array.isArray(fm.covers) && fm.covers.length) {
    if (fm.covers.length > 3) {
      pills.push(
        `<details class="meta-covers"><summary>${CHEV_SVG}<b>${tr("Covers", "覆盖")}:</b> <span>${fm.covers.length} ${tr("paths", "项")}</span></summary><div class="meta-covers-list">${esc(fm.covers.join(", "))}</div></details>`,
      );
    } else {
      pills.push(`<span class="meta-pill mono"><b>${tr("Covers", "覆盖")}:</b> ${esc(fm.covers.join(", "))}</span>`);
    }
  }
  $("doc-meta").hidden = !pills.length || sourceMode;
  setHTML($("doc-meta"), pills.join(""));
}

function renderRelated(doc) {
  const paths = graph.backlinks?.[doc.path] || [];
  const related = paths.map((p) => catalogEntry(p)).filter(Boolean);
  setHTML(
    $("related"),
    related.length
      ? `<details open><summary>${CHEV_SVG}<span>${tr("Referenced by", "反向引用")} (${related.length})</span></summary><div class="related-links">${related.map(docButton).join("")}</div></details>`
      : "",
  );
}

function renderDocument() {
  const doc = currentDocument();
  $("document-path").innerHTML = esc(current) + privacy(doc) + draftTag(current);
  $("reading").hidden = sourceMode;
  $("editor-wrap").hidden = !sourceMode;
  if (!doc || !store.base.has(current)) {
    $("doc-meta").hidden = true;
    setHTML($("reading"), `<h1>${tr("Document not found", "未找到文档")}</h1>`);
    setHTML($("related"), "");
    return;
  }
  const src = store.source(current);
  renderDocMeta(doc);
  if (sourceMode) {
    sourceLineEnding = src.includes("\r\n") ? "\r\n" : "\n";
    const normalized = src.replace(/\r\n/g, "\n");
    if ($("source").value !== normalized) $("source").value = normalized;
    $("source").disabled = store.busy;
  } else {
    if (setHTML($("reading"), renderMarkdownHTML(src))) {
      $("reading")
        .querySelectorAll("table")
        .forEach((tbl) => {
          if (tbl.parentElement?.classList.contains("table-wrap")) return;
          const wrap = document.createElement("div");
          wrap.className = "table-wrap";
          tbl.replaceWith(wrap);
          wrap.append(tbl);
        });
    }
  }
  renderRelated(doc);
}

function syncSourceEditorInput() {
  if (view !== "doc" || !sourceMode || !store.base.has(current)) return;
  const raw = $("source").value.replace(/\n/g, sourceLineEnding);
  if (store.set(current, raw)) {
    changed();
  }
}

/* Header Unit Tree Switcher (supports both single-project hierarchies and multi-root launches). */
function unitBreadcrumb() {
  const tree = graph.meta.unitTree || [];
  const byId = new Map(tree.map((u) => [u.id, u]));
  const currentId = graph.meta.unitId || "main";
  const chain = [];
  let cur = byId.get(currentId);
  while (cur && chain.length < 6) {
    chain.unshift(cur.name || cur.title);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return chain.length ? chain.join(" / ") : graph.meta.title;
}

function setUnitMenu(open) {
  const tree = graph.meta.unitTree || [];
  if (tree.length <= 1) open = false;
  $("unit-menu").hidden = !open;
  $("unit-toggle").setAttribute("aria-expanded", String(open));
}

function updateMeta() {
  const tree = graph.meta.unitTree || [];
  const currentId = graph.meta.unitId || "main";
  $("project-name").textContent = unitBreadcrumb();
  const multi = tree.length > 1;
  $("unit-caret").hidden = !multi;
  $("unit-toggle").classList.toggle("is-interactive", multi);
  $("unit-toggle").disabled = !multi;

  if (multi) {
    const rows = tree
      .map((u) => {
        const active = u.id === currentId;
        const indent = u.depth * 14;
        const counts = `${u.specs}s · ${u.work}w`;
        const href = unitHref(u.id);
        return `<a class="unit-option ${active ? "active" : ""}" role="menuitem" href="${href}" data-unit="${esc(u.id)}" style="padding-left:${12 + indent}px"><span class="unit-opt-name">${u.depth ? '<span class="tree-branch" aria-hidden="true">└</span> ' : ""}${esc(u.title)}</span><small class="unit-opt-meta">${counts}</small></a>`;
      })
      .join("");
    setHTML(
      $("unit-menu"),
      `<div class="unit-menu-head">${tr("Projects & units", "项目与子单元")} (${tree.length})</div>${rows}`,
    );
  } else {
    setHTML($("unit-menu"), "");
  }

  const workCount = (graph.work || []).length;
  $("work-badge").hidden = !workCount;
  $("work-badge").textContent = workCount;
}

function renderCatalog() {
  $("catalog")
    .querySelectorAll("details")
    .forEach((el) => {
      if (el.open) archiveOpen.add(el.dataset.group);
      else archiveOpen.delete(el.dataset.group);
    });
  let html = "";
  const specs = graph.catalog.filter((d) => d.kind === "spec" && !d.archived);
  if (specs.length) {
    if (specs.length <= 8) {
      html += `<section class="catalog-group"><h3><span>${tr("Specs", "规格")}</span><small>${specs.length}</small></h3>${renderDocList(specs)}</section>`;
    } else {
      const byArea = new Map();
      const fallback = tr("General", "通用");
      for (const d of specs) {
        const key = d.area || fallback;
        if (!byArea.has(key)) byArea.set(key, []);
        byArea.get(key).push(d);
      }
      const keys = [...byArea.keys()].sort((a, b) => (a === fallback ? 1 : b === fallback ? -1 : a.localeCompare(b)));
      const folders = keys
        .map((area) => {
          const list = byArea.get(area);
          const groupKey = "area:" + area;
          const hasSelected = view === "doc" && list.some((d) => d.path === current);
          const isOpen = archiveOpen.has(groupKey) || hasSelected;
          return `<details class="catalog-sub" data-group="${esc(groupKey)}" ${isOpen ? "open" : ""}><summary><span>${CHEV_SVG}<span class="sum-label">${esc(area)}</span></span><small>${list.length}</small></summary><div class="catalog-items">${renderDocList(list)}</div></details>`;
        })
        .join("");
      html += `<section class="catalog-group"><h3><span>${tr("Specs", "规格")}</span><small>${specs.length}</small></h3>${folders}</section>`;
    }
  }

  const work = graph.catalog.filter((d) => d.kind === "work" && !d.archived);
  if (work.length) {
    if (work.length <= 4) {
      html += `<section class="catalog-group"><h3><span>${tr("Active work", "进行中工作")}</span><small>${work.length}</small></h3>${renderDocList(work)}</section>`;
    } else {
      const hasSelected = view === "doc" && work.some((d) => d.path === current);
      const isOpen = archiveOpen.has("work") || hasSelected;
      html += `<details class="catalog-group" data-group="work" ${isOpen ? "open" : ""}><summary><span>${CHEV_SVG}<span class="sum-label">${tr("Active work", "进行中工作")}</span></span><small>${work.length}</small></summary><div class="catalog-items">${renderDocList(work)}</div></details>`;
    }
  }

  const notes = graph.catalog.filter((d) => d.kind === "note" && !d.archived);
  if (notes.length) {
    if (notes.length <= 6) {
      html += `<section class="catalog-group"><h3><span>${tr("Notes", "笔记")}</span><small>${notes.length}</small></h3>${renderDocList(notes)}</section>`;
    } else {
      const hasSelected = view === "doc" && notes.some((d) => d.path === current);
      const isOpen = archiveOpen.has("notes") || hasSelected;
      html += `<details class="catalog-group" data-group="notes" ${isOpen ? "open" : ""}><summary><span>${CHEV_SVG}<span class="sum-label">${tr("Notes", "笔记")}</span></span><small>${notes.length}</small></summary><div class="catalog-items">${renderDocList(notes)}</div></details>`;
    }
  }

  const archived = graph.catalog.filter((d) => d.archived);
  if (archived.length) {
    const hasSelected = view === "doc" && archived.some((d) => d.path === current);
    const isOpen = archiveOpen.has("archive") || hasSelected;
    html += `<details class="catalog-group" data-group="archive" ${isOpen ? "open" : ""}><summary><span>${CHEV_SVG}<span class="sum-label">${tr("Archive", "归档")}</span></span><small>${archived.length}</small></summary><div class="catalog-items">${renderDocList(archived)}</div></details>`;
  }
  setHTML($("catalog"), html || `<p class="notice">${tr("No documents yet.", "暂无文档。")}</p>`);
}

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

function renderMain() {
  const active =
    view === "dashboard"
      ? "dashboard"
      : view === "work"
        ? "work"
        : current === overviewPath()
          ? "overview"
          : current === northstarPath()
            ? "northstar"
            : null;
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === active);
    if (el.dataset.nav === active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });

  $("doc-actions").hidden = view !== "doc";
  $("source-view").disabled = store.busy || !store.base.has(current);
  $("source-view").classList.toggle("active", sourceMode);
  $("source-view").setAttribute("aria-pressed", String(sourceMode));
  $("source-view").textContent = sourceMode ? tr("✓ Preview", "✓ 预览") : tr("</> Edit", "</> 编辑");
  $("source-view").title = sourceMode
    ? tr("Return to rendered preview (Esc)", "返回正文预览（Esc）")
    : tr("Edit Markdown source (E)", "编辑 Markdown 源码（E）");

  $("board-switch").hidden = view !== "dashboard";
  $("board-filters").hidden = view !== "dashboard";
  $("dashboard").hidden = view !== "dashboard";
  $("work-view").hidden = view !== "work";
  $("reader").hidden = view !== "doc";
  $("document-path").classList.toggle("view-name", view !== "doc");

  if (view === "dashboard") {
    $("document-path").textContent = tr("Dashboard", "看板");
    renderDashboard();
  } else if (view === "work") {
    $("document-path").textContent = tr("Active work", "进行中工作");
    renderWorkView();
  } else {
    renderDocument();
  }
  localize();
}

function localize() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-en]").forEach((el) => {
    el.textContent = el.dataset[lang];
  });
  document.querySelectorAll("[data-en-label]").forEach((el) => {
    el.setAttribute("aria-label", el.dataset[lang + "Label"]);
    if (el.matches(".graph-tools button, #settings-fab")) el.title = el.dataset[lang + "Label"];
  });
  document.querySelectorAll("[data-lang-choice]").forEach((btn) => {
    const active = btn.dataset.langChoice === lang;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  applyTheme();
  $("search").placeholder = tr("Search all docs… (/)", "搜索全部文档… (/)");
  if (view === "doc" && current) {
    $("document-path").title = tr("Click to copy path", "点击复制路径");
    $("document-path").tabIndex = 0;
    $("document-path").setAttribute("role", "button");
  } else {
    $("document-path").title = "";
    $("document-path").removeAttribute("tabindex");
    $("document-path").removeAttribute("role");
  }
  updateTools();
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
  $("library-toggle").setAttribute("aria-expanded", String(library));
  $("changes-toggle").setAttribute("aria-expanded", String(changes));
}

function setChanges(open, focus = false) {
  $("app").classList.toggle("changes-open", open);
  if (open) renderChanges();
  if (open && window.innerWidth <= 760) $("app").classList.remove("library-open");
  syncDrawers();
  if (open && focus) $("changes-close").focus();
}

function setLibrary(open) {
  const mobile = window.innerWidth <= 760;
  $("app").classList.toggle(mobile ? "library-open" : "library-closed", mobile ? open : !open);
  if (mobile && open) $("app").classList.remove("changes-open");
  syncDrawers();
}

function jumpToAnchor(anchor) {
  if (!anchor) return false;
  const id = "heading-" + slugHeading(anchor);
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "auto", block: "start" });
  el.focus({ preventScroll: true });
  return true;
}

async function openDocument(path, anchor = "") {
  if (store.busy) return;
  if (!(await finishFieldEdit())) return;
  setUnitMenu(false);
  const navigation = ++navigationSequence;
  if (!store.base.has(path)) {
    try {
      const doc = await request("/document?path=" + encodeURIComponent(path));
      if (doc.error && !doc.source) throw new Error(doc.error);
      if (navigation !== navigationSequence || store.busy) return;
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
  $("search-panel").hidden = true;
  renderMain();
  renderCatalog();
  if (window.innerWidth <= 760) setLibrary(false);
  setChanges(false);
  $("workspace-body").scrollTop = 0;
  if (anchor) jumpToAnchor(anchor);
}

async function navigate(next) {
  if (store.busy) return;
  setUnitMenu(false);
  if (next === "northstar") return openDocument(northstarPath());
  if (next === "overview") return openDocument(overviewPath());
  if (!(await finishFieldEdit())) return;
  navigationSequence++;
  sourceMode = false;
  setConnect(false);
  $("search-panel").hidden = true;
  view = next === "work" ? "work" : "dashboard";
  renderMain();
  renderCatalog();
  if (window.innerWidth <= 760) setLibrary(false);
  setChanges(false);
}

async function toggleSourceMode() {
  if (store.busy || view !== "doc" || !store.base.has(current)) return;
  sourceMode = !sourceMode;
  if (!sourceMode) await refreshGraph();
  renderMain();
  if (sourceMode) $("source").focus();
}

async function runSearch() {
  const q = $("search").value.trim();
  const seq = ++searchSequence;
  if (!q) {
    $("search-panel").hidden = true;
    return;
  }
  try {
    const res = await request("/search", { q, overrides: draftOverrides() });
    if (seq !== searchSequence || !res.ok) return;
    const rows = res.results || [];
    const header = `<header><strong>${tr(`Search results for "${q}" (${rows.length})`, `“${q}” 的搜索结果（${rows.length}）`)}</strong><button id="search-close">×</button></header>`;
    const body = rows.length
      ? `<ul>${rows
          .map(
            (r) =>
              `<li><button data-doc="${esc(r.path)}"><strong>${esc(r.title)}</strong> <small>${esc(r.path)}</small>${r.snippet ? `<p>${esc(r.snippet)}</p>` : ""}</button></li>`,
          )
          .join("")}</ul>`
      : `<p class="notice">${tr("No matching documents.", "没有匹配的文档。")}</p>`;
    setHTML($("search-panel"), header + body);
    $("search-panel").hidden = false;
  } catch {}
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function openCreateModal() {
  setUnitMenu(false);
  $("create-form").reset();
  $("create-error").hidden = true;
  $("create-slug").dataset.touched = "";
  updateCreateFields();
  $("create-modal").hidden = false;
  $("create-title").focus();
}

function closeCreateModal() {
  $("create-modal").hidden = true;
}

function updateCreateFields() {
  const kind = $("create-kind").value;
  $("create-area-row").hidden = kind !== "spec";
  $("create-purpose-row").hidden = kind === "work";
}

async function submitCreate(event) {
  event.preventDefault();
  $("create-error").hidden = true;
  const payload = {
    kind: $("create-kind").value,
    title: $("create-title").value.trim(),
    slug: $("create-slug").value.trim(),
    area: $("create-area").value.trim(),
    purpose: $("create-purpose").value.trim(),
    private: $("create-private").checked,
  };
  try {
    const res = await request("/create", payload);
    if (!res.ok) throw new Error(res.error);
    graph = res.graph;
    store.addDocument(res.document);
    closeCreateModal();
    updateMeta();
    renderCatalog();
    await openDocument(res.path);
    sourceMode = true;
    renderMain();
    $("source").focus();
    status(tr("Document created: ", "已创建文档：") + res.path);
  } catch (error) {
    $("create-error").textContent = error.message;
    $("create-error").hidden = false;
  }
}

async function copyDocumentPath() {
  if (view !== "doc" || !current) return;
  const seq = ++pathCopySequence;
  clearTimeout(pathCopiedTimer);
  try {
    await navigator.clipboard.writeText(current);
    if (seq !== pathCopySequence) return;
    $("document-path").setAttribute("data-copied-label", tr("✓ Copied!", "✓ 已复制！"));
    $("document-path").classList.add("copied");
    pathCopiedTimer = setTimeout(() => $("document-path").classList.remove("copied"), 1500);
  } catch {
    status(tr("Could not copy path.", "无法复制路径。"), true);
  }
}

/* Bindings */
const chromeObserver = new ResizeObserver(() => {
  $("app").style.setProperty("--header-height", document.querySelector(".top").getBoundingClientRect().height + "px");
  $("app").style.setProperty("--footer-height", $("status").getBoundingClientRect().height + "px");
});
chromeObserver.observe(document.querySelector(".top"));
chromeObserver.observe($("status"));

$("unit-toggle").onclick = (event) => {
  event.stopPropagation();
  setUnitMenu($("unit-menu").hidden);
};

$("source-view").onclick = toggleSourceMode;
$("handoff-note-btn").onclick = () => {
  setChanges(true);
  $("steering-note").focus();
};
$("source").addEventListener("input", syncSourceEditorInput);
$("source").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    save();
  } else if (event.key === "Escape") {
    event.preventDefault();
    toggleSourceMode();
  }
});

$("save").onclick = save;
$("copy-agent").onclick = copyPrompt;
$("steering-note").addEventListener("input", () => {
  clearPrompt();
  renderChanges(false);
});
$("export").onclick = () => {
  if (!saveFailure || !store.drafts.size) return;
  warnPrivate();
  const blob = new Blob(
    [JSON.stringify({ project: graph.meta.root, edits: store.edits(), saveError: saveFailure }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "docdoki-drafts.json";
  a.click();
  URL.revokeObjectURL(url);
  status(tr("Recovery copy downloaded.", "已下载恢复副本。"));
};

$("changes-toggle").onclick = async () => {
  setUnitMenu(false);
  if (await finishFieldEdit()) setChanges(!$("app").classList.contains("changes-open"), true);
};
$("changes-close").onclick = () => setChanges(false);
$("library-toggle").onclick = () => setLibrary($("library-toggle").getAttribute("aria-expanded") !== "true");
$("library-close").onclick = () => setLibrary(false);
$("new-doc").onclick = openCreateModal;
$("create-close").onclick = closeCreateModal;
$("create-cancel").onclick = closeCreateModal;
$("create-kind").onchange = updateCreateFields;
$("create-title").addEventListener("input", () => {
  if (!$("create-slug").dataset.touched) $("create-slug").value = slugify($("create-title").value);
});
$("create-slug").addEventListener("input", () => {
  $("create-slug").dataset.touched = "1";
});
$("create-form").addEventListener("submit", submitCreate);

function setSettings(open) {
  $("settings-popover").hidden = !open;
  $("settings-fab").setAttribute("aria-expanded", String(open));
  $("settings-fab").classList.toggle("open", open);
}

$("settings-fab").onclick = (event) => {
  event.stopPropagation();
  setUnitMenu(false);
  setSettings($("settings-popover").hidden);
};
$("settings-close").onclick = () => setSettings(false);

document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
  btn.onclick = () => {
    theme = btn.dataset.themeChoice;
    explicitUrlTheme = null;
    try {
      localStorage.setItem("ddpanel-theme", theme);
    } catch {}
    applyTheme();
    updateMeta();
  };
});

document.querySelectorAll("[data-lang-choice]").forEach((btn) => {
  btn.onclick = () => {
    const next = btn.dataset.langChoice;
    if (next === lang) return;
    lang = next;
    try {
      localStorage.setItem("ddpanel-lang", lang);
    } catch {}
    renderMain();
    renderCatalog();
    renderChanges();
    renderDiagnostics();
    updateMeta();
  };
});

$("document-path").onclick = copyDocumentPath;
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 140);
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!target.closest("#unit-switcher")) setUnitMenu(false);
  if (!target.closest("#settings-root")) setSettings(false);
  if (target.closest(".field-editor")) return;
  if (target.id === "empty-new-spec") {
    openCreateModal();
    $("create-kind").value = "spec";
    updateCreateFields();
    return;
  }
  if (target.id === "search-close") {
    $("search").value = "";
    $("search-panel").hidden = true;
    return;
  }
  const filterBtn = target.closest("[data-filter]");
  if (filterBtn) {
    if (!(await finishFieldEdit())) return;
    statusFilter = filterBtn.dataset.filter;
    graphReady = false;
    renderDashboard();
    return;
  }
  const modeBtn = target.closest("[data-board-mode]");
  if (modeBtn) {
    if (!(await finishFieldEdit())) return;
    boardMode = modeBtn.dataset.boardMode;
    if (boardMode === "dag") {
      document.querySelector(".decisions-box")?.removeAttribute("open");
      graphReady = false;
    }
    renderDashboard();
    return;
  }
  const field = target.closest("[data-field]");
  if (field) return beginField(field.dataset.path, field.dataset.field);
  const doc = target.closest("[data-doc]");
  if (doc) {
    event.preventDefault();
    return openDocument(doc.dataset.doc, doc.dataset.anchor || "");
  }
  const nav = target.closest("[data-nav]");
  if (nav) return navigate(nav.dataset.nav);
  const discard = target.closest("[data-discard]");
  if (discard) return discardChanges(discard.dataset.discard);
  if (target.closest("[data-close-edge]")) return closeEdge();
  const remove = target.closest("[data-remove-after]");
  if (remove) return changeDependency(remove.dataset.path, remove.dataset.removeAfter, true);
  const card = target.closest("#graph [data-node]");
  if (card) return activateCard(card.dataset.node);
  const edgeEl = target.closest("[data-edge]");
  if (edgeEl) return openEdge(edgeEl, !event.detail);
});

document.addEventListener("keydown", async (event) => {
  if (event.isComposing) return;
  if (event.key === "Escape") {
    if (!$("settings-popover").hidden) return setSettings(false);
    if (!$("unit-menu").hidden) return setUnitMenu(false);
    if (!$("create-modal").hidden) return closeCreateModal();
    if (!$("search-panel").hidden) {
      $("search").value = "";
      $("search-panel").hidden = true;
      return;
    }
    if (!$("edge-detail").hidden) return closeEdge();
    if ($("app").classList.contains("changes-open")) return setChanges(false);
    if (fieldEditor) return cancelField();
    if (connectMode) return setConnect(false);
  }
  if (store.busy || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    const undone = store.undo();
    if (undone) {
      changed(tr("Edit undone.", "已撤销修改。"));
      await refreshGraph();
      renderMain();
    }
  } else if (event.key === "/") {
    event.preventDefault();
    $("search").focus();
  } else if (event.key.toLowerCase() === "e" && view === "doc") {
    event.preventDefault();
    toggleSourceMode();
  } else if (view === "dashboard" && effectiveBoardMode() === "dag" && !event.ctrlKey && !event.metaKey) {
    if (event.key === "+" || event.key === "=") zoom(1.2);
    if (event.key === "-") zoom(1 / 1.2);
    if (event.key === "0") fitGraph();
    if (event.key.toLowerCase() === "r") resetLayout();
    if (event.key.toLowerCase() === "c") toggleConnect();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (store.drafts.size || store.busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});

bindBoard();
updateMeta();
renderCatalog();
renderMain();
renderChanges();
renderDiagnostics();
syncDrawers();

window.addEventListener("focus", syncDocuments);
window.addEventListener("resize", syncDrawers);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncDocuments();
});
