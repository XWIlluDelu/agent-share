/* Project steering board: Pulse, Open Decisions, Status Filters, Area groups, DAG canvas, and inline edits. */

let boardMode = "auto", // "auto" | "areas" | "dag"
  statusFilter = "all", // "all" | "in-progress" | "blocked" | "proposed" | "not-started" | "done" | "unrecorded"
  connectMode = false,
  connectFrom = null,
  zoomLocked = false,
  fieldEditor = null;

let scale = 1,
  pan = { x: 0, y: 0 },
  positions = new Map(),
  offsets = new Map(),
  edgeViews = [];

let drag = null,
  frame = null,
  graphReady = false,
  selectedNode = null,
  graphRenderPending = false;

let miniBounds = { x: 0, y: 0, w: 1, h: 1 },
  miniRects = new Map(),
  miniDragId = null;

const CARD = { width: 312, height: 216, columnGap: 140, rowGap: 28 };
const PORT_SIDES = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

function effectiveBoardMode() {
  if (boardMode !== "auto") return boardMode;
  const hasEdges = graph.nodes.some((n) => (n.validAfter || []).length > 0);
  const hasAreas = graph.nodes.some((n) => (n.area || "").trim().length > 0);
  return hasAreas || !hasEdges ? "areas" : "dag";
}

function progressLabel(progress) {
  return (
    {
      "not-started": tr("Not started", "未开始"),
      "in-progress": tr("In progress", "进行中"),
      blocked: tr("Blocked", "已阻塞"),
      done: tr("Done", "已完成"),
    }[progress] || tr("Not recorded", "未记录")
  );
}

function fieldLabel(field) {
  return {
    title: tr("Title", "标题"),
    purpose: tr("Purpose", "摘要"),
    progress: tr("Progress", "进度"),
    status: tr("Authority", "状态"),
  }[field];
}

function matchesStatusFilter(node) {
  if (statusFilter === "all") return true;
  if (statusFilter === "proposed") return node.status === "proposed";
  if (statusFilter === "unrecorded") return !node.progress;
  return node.progress === statusFilter;
}

function visibleNodes() {
  return graph.nodes.filter(matchesStatusFilter);
}

function renderBoardFilters() {
  const nodes = graph.nodes;
  if (!nodes.length) {
    $("board-filters").hidden = true;
    return;
  }
  const counts = {
    all: nodes.length,
    blocked: nodes.filter((n) => n.progress === "blocked").length,
    proposed: nodes.filter((n) => n.status === "proposed").length,
    "in-progress": nodes.filter((n) => n.progress === "in-progress").length,
    "not-started": nodes.filter((n) => n.progress === "not-started").length,
    done: nodes.filter((n) => n.progress === "done").length,
    unrecorded: nodes.filter((n) => !n.progress).length,
  };
  if (statusFilter !== "all" && !counts[statusFilter]) statusFilter = "all";
  const defs = [
    ["all", tr("All", "全部")],
    ["blocked", tr("Blocked", "阻塞")],
    ["proposed", tr("Proposed", "提案")],
    ["in-progress", tr("In progress", "进行中")],
    ["not-started", tr("Not started", "未开始")],
    ["done", tr("Done", "已完成")],
    ["unrecorded", tr("Unrecorded", "未记录")],
  ];
  const pills = defs
    .filter(([key]) => key === "all" || counts[key] > 0)
    .map(
      ([key, label]) =>
        `<button class="filter-pill ${statusFilter === key ? "active" : ""}" data-filter="${key}" aria-pressed="${statusFilter === key}">${label} <span>${counts[key]}</span></button>`,
    )
    .join("");
  $("board-filters").hidden = false;
  setHTML($("board-filters"), pills);
}

function cardHTML(node, layout = "area") {
  const field = (name, label) =>
    `data-field="${name}" data-path="${esc(node.path)}" aria-label="${tr("Edit ", "修改") + fieldLabel(name)}" title="${esc(label)}" ${store.busy ? "disabled" : ""}`;
  const proposedBadge =
    node.status === "proposed"
      ? `<button class="status-pill is-proposed" ${field("status", tr("Proposed — click to mark decided", "提案中——点击切换"))}>${tr("Proposed", "提案")}</button>`
      : "";
  const allWork = node.activeWork || [];
  const chipLimit = layout === "dag" ? 1 : 3;
  const shownWork = allWork.slice(0, chipLimit);
  const extraWork = allWork.length - shownWork.length;
  const workChips =
    shownWork
      .map(
        (w) =>
          `<button class="work-chip ${w.status === "blocked" ? "is-blocked" : ""}" data-doc="${esc(w.path)}" title="${esc(w.path)}">⚡ ${esc(w.title)}</button>`,
      )
      .join("") +
    (extraWork > 0
      ? `<button class="work-chip work-chip-more" data-nav="work" title="${tr("View all active work", "查看全部进行中工作")}">+${extraWork}</button>`
      : "");
  const workRow = workChips ? `<div class="card-work">${workChips}</div>` : "";
  const cls = `spec-card ${layout === "dag" ? "is-dag" : "is-grid"} plan-${esc(node.progress || "unknown")} ${node.status === "proposed" ? "is-proposed-card" : ""} ${store.drafts.has(node.path) ? "dirty" : ""}`;
  return `<section tabindex="0" aria-label="${esc(node.title)}" class="${cls}" data-node="${esc(node.path)}"><header><button class="card-title field-button" ${field("title", tr("Click to edit title", "点击修改标题"))}>${esc(node.title)}</button>${proposedBadge}${privacy(node)}</header><div class="ribbon"><button class="field-button card-purpose ${node.content ? "" : "is-empty"}" ${field("purpose", tr("Click to edit purpose", "点击修改摘要"))}><span>${esc(node.content) || tr("Add a purpose…", "填写摘要…")}</span></button>${workRow}</div><div class="card-foot"><button class="card-open" data-doc="${esc(node.path)}">${tr("Open", "打开")}</button><button class="progress-label" ${field("progress", tr("Change progress", "修改进度"))}><span>${esc(progressLabel(node.progress))}</span><svg class="chev caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg></button></div></section>`;
}

function renderPulse() {
  const decisions = graph.decisions || [];
  const mission = graph.meta.mission
    ? `<button class="pulse-mission" data-nav="northstar" title="${tr("Open Northstar", "打开北极星")}"><strong>${tr("Mission", "使命")}:</strong> ${esc(graph.meta.mission)}</button>`
    : `<button class="pulse-mission" data-nav="northstar">${tr("Set project mission in Northstar →", "在北极星中设定项目使命 →")}</button>`;

  const decisionItems = decisions
    .map((d) => {
      const tag =
        d.kind === "proposed"
          ? tr("Proposed", "提案")
          : d.kind === "blocked"
            ? tr("Blocked", "阻塞")
            : tr("Decision", "待决策");
      return `<li><button data-doc="${esc(d.path)}"><span class="decision-tag kind-${esc(d.kind)}">${tag}</span><span class="decision-text">${renderInlineSnippet(d.title)}</span></button></li>`;
    })
    .join("");

  const openAttr = effectiveBoardMode() === "dag" || decisions.length > 3 ? "" : "open";
  const decisionsBlock = decisions.length
    ? `<details class="decisions-box" ${openAttr}><summary>${CHEV_SVG}<span class="decisions-count">${decisions.length}</span><span>${tr("Needs attention (decisions, proposals, blockers)", "待关注事项（决策、提案、阻塞）")}</span></summary><ul>${decisionItems}</ul></details>`
    : "";

  setHTML($("pulse"), `<div class="pulse-top">${mission}</div>${decisionsBlock}`);
}

function directChildUnits() {
  const tree = graph.meta.unitTree || [];
  const currentId = graph.meta.unitId || "main";
  return tree.filter((u) => u.parentId === currentId);
}

function renderAreaBoard() {
  const nodes = visibleNodes();
  const children = directChildUnits();
  const sections = [];

  if (children.length && statusFilter === "all") {
    const childCards = children
      .map((u) => {
        const href = unitHref(u.id);
        return `<a class="unit-card" href="${esc(href)}" data-unit="${esc(u.id)}"><header><span>${esc(u.title)}</span><small>${esc(u.name)}</small></header><div class="unit-card-body"><span><b>${u.specs}</b> ${tr("specs", "规格")}</span><span><b>${u.work}</b> ${tr("active work", "进行中工作")}</span></div><footer><span>${tr("Open unit", "进入子单元")}</span><span aria-hidden="true">→</span></footer></a>`;
      })
      .join("");
    sections.push(
      `<section class="area-group"><header class="area-header"><h3>${tr("Child units", "子单元")}</h3><span>${children.length}</span></header><div class="area-grid">${childCards}</div></section>`,
    );
  }

  if (nodes.length) {
    const groups = new Map();
    for (const node of nodes) {
      const key = (node.area || "").trim() || tr("General", "通用");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(node);
    }
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      const fallback = tr("General", "通用");
      if (a === fallback) return 1;
      if (b === fallback) return -1;
      return a.localeCompare(b);
    });
    for (const area of sortedKeys) {
      const list = groups.get(area);
      const done = list.filter((n) => n.progress === "done").length;
      sections.push(
        `<section class="area-group"><header class="area-header"><h3>${esc(area)}</h3><span>${done}/${list.length} ${tr("done", "已完成")}</span></header><div class="area-grid">${list.map((n) => cardHTML(n, "area")).join("")}</div></section>`,
      );
    }
  } else if (!children.length || statusFilter !== "all") {
    const msg = graph.nodes.length
      ? tr("No specs match the current filter.", "当前筛选条件下没有匹配的规格。")
      : tr("No specs in this unit yet.", "当前单元还没有规格。");
    const cta = graph.nodes.length
      ? `<button data-filter="all">${tr("Show all specs", "显示全部规格")}</button>`
      : `<button class="primary" id="empty-new-spec">${tr("+ New spec", "+ 新建规格")}</button>`;
    sections.push(`<div class="empty-box"><p>${msg}</p>${cta}</div>`);
  }

  setHTML($("area-board"), sections.join(""));
}

function renderWorkView() {
  const items = graph.work || [];
  if (!items.length) {
    setHTML(
      $("work-view"),
      `<div class="work-head"><h1>${tr("Active work", "进行中工作")}</h1></div><p class="empty">${tr("No active work streams.", "当前没有进行中的工作流。")}</p>`,
    );
    return;
  }
  const cards = items
    .map((w) => {
      const specs = (w.specs || [])
        .map((stem) => {
          const target = graph.catalog.find((d) => d.stem === stem);
          return target
            ? `<button class="meta-pill" data-doc="${esc(target.path)}">${esc(target.title)}</button>`
            : `<span class="meta-pill">${esc(stem)}</span>`;
        })
        .join("");
      const tasks =
        w.tasks && w.tasks.total
          ? `<span class="task-progress">${tr("Tasks", "任务")}: <b>${w.tasks.done}/${w.tasks.total}</b></span>`
          : "";
      const stateList = (w.state || []).length
        ? `<ul class="work-state">${w.state.map((line) => `<li>${renderInlineSnippet(line)}</li>`).join("")}</ul>`
        : "";
      const statusBadge = `<span class="work-status status-${esc(w.status || "active")}">${esc(w.status || "active")}</span>`;
      return `<article class="work-card ${store.drafts.has(w.path) ? "dirty" : ""}"><header><button class="work-title" data-doc="${esc(w.path)}">${esc(w.title)}${privacy(w)}</button>${statusBadge}</header>${w.objective ? `<p class="work-objective">${renderInlineSnippet(w.objective)}</p>` : ""}${stateList}<footer><div class="work-meta">${specs}${tasks}</div><button data-doc="${esc(w.path)}">${tr("Open", "打开")}</button></footer></article>`;
    })
    .join("");
  setHTML($("work-view"), `<div class="work-head"><h1>${tr("Active work", "进行中工作")} (${items.length})</h1></div><div class="work-list">${cards}</div>`);
}

function renderDashboard() {
  const hasSpecs = graph.nodes.length > 0;
  const mode = hasSpecs ? effectiveBoardMode() : "areas";
  $("board-switch").hidden = !hasSpecs;
  document.querySelectorAll("[data-board-mode]").forEach((btn) => {
    const active = btn.dataset.boardMode === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  renderBoardFilters();
  renderPulse();
  $("area-board").hidden = mode !== "areas";
  $("graph").hidden = mode !== "dag";
  if (mode === "areas") {
    if (!fieldEditor) renderAreaBoard();
  } else {
    renderGraph();
  }
}

/* Inline card field editing (works in both Area and DAG views). */
async function finishFieldEdit() {
  if (!fieldEditor) return true;
  return commitField();
}

function cardElement(path) {
  const scope = effectiveBoardMode() === "dag" ? $("graph-cards") : $("area-board");
  return scope.querySelector(`[data-node="${CSS.escape(path)}"]`);
}

async function beginField(path, field) {
  if (store.busy || view !== "dashboard") return;
  if (connectMode && effectiveBoardMode() === "dag") return activateCard(path);
  if (fieldEditor?.path === path && fieldEditor.field === field) {
    fieldEditor.input.focus();
    return;
  }
  if (!(await finishFieldEdit())) return;
  const doc = graph.documents[path];
  if (!doc || doc.error) {
    status(doc?.error || tr("Open source to edit this document.", "请打开源码修改此文档。"), true);
    return;
  }
  const value =
    field === "title"
      ? doc.title
      : field === "status"
        ? doc.fm.status || "decided"
        : (doc.fm[field] ?? "");
  if (typeof value !== "string") {
    status(tr("Open source to edit this field's format.", "请打开源码修改此字段格式。"), true);
    return;
  }
  if (field === "status") {
    const next = value === "proposed" ? "decided" : "proposed";
    await applyCardTransform(path, "status", next);
    return;
  }
  const card = cardElement(path),
    button = card?.querySelector(`[data-field="${field}"]`);
  if (!button) return;

  const form = document.createElement("form");
  form.id = "card-field-form";
  form.className = "field-editor field-" + field;
  const input = document.createElement(
    field === "purpose" ? "textarea" : field === "progress" ? "select" : "input",
  );
  input.name = "value";
  input.setAttribute("aria-label", fieldLabel(field));
  input.spellcheck = false;
  if (field === "progress") {
    for (const state of ["", "not-started", "in-progress", "blocked", "done"])
      input.add(new Option(progressLabel(state), state));
  }
  input.value = value;
  form.append(input);
  button.replaceWith(form);
  renderedHTML.delete($("area-board"));
  renderedHTML.delete($("graph-cards"));

  const editor = (fieldEditor = { path, field, input, card, before: input.value, pending: null });
  card.classList.add("field-active");

  if (field === "progress") input.addEventListener("change", () => commitField());
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (fieldEditor === editor && document.activeElement !== editor.input) commitField();
    }, 0);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    commitField();
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelField();
    } else if (event.key === "Enter" && (field !== "purpose" || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      commitField();
    }
  });
  input.focus();
  if (field !== "progress") input.setSelectionRange(input.value.length, input.value.length);
}

function cancelField() {
  if (!fieldEditor) return;
  fieldEditor = null;
  renderMain();
  status(tr("Field edit cancelled.", "字段修改已取消。"));
}

async function applyCardTransform(path, field, value) {
  try {
    const result = await request("/transform", {
      overrides: draftOverrides(),
      card: { path, field, value },
    });
    if (!result.ok) throw new Error(result.error);
    const staged = store.set(path, result.source);
    graph = result.graph;
    if (staged) changed();
    renderMain();
    return true;
  } catch (error) {
    status(error.message, true);
    return false;
  }
}

async function commitField() {
  const editor = fieldEditor;
  if (!editor) return true;
  if (editor.pending) return editor.pending;
  if (editor.input.value === editor.before) {
    fieldEditor = null;
    renderMain();
    return true;
  }
  const value = editor.field === "progress" && !editor.input.value ? null : editor.input.value;
  editor.pending = (async () => {
    const ok = await applyCardTransform(editor.path, editor.field, value);
    if (ok && fieldEditor === editor) {
      fieldEditor = null;
      renderMain();
    } else if (!ok && fieldEditor === editor) {
      editor.input.setAttribute("aria-invalid", "true");
    }
    editor.pending = null;
    return ok;
  })();
  return editor.pending;
}

/* Dependency DAG interactions */
async function changeDependency(path, stem, remove) {
  if (store.busy || !stem || !(await finishFieldEdit())) return;
  if (store.base.get(path)?.kind !== "spec") return;
  try {
    const result = await request("/transform", {
      overrides: draftOverrides(),
      after: { path, op: remove ? "remove" : "add", stem },
    });
    if (!result.ok) throw new Error(result.error);
    const staged = store.set(path, result.source);
    graph = result.graph;
    $("edge-detail").hidden = true;
    if (staged) changed();
    renderMain();
    status(
      staged
        ? tr("Dependency updated.", "依赖已修改。")
        : tr("Dependency already matches.", "依赖关系已是此状态。"),
    );
    return true;
  } catch (error) {
    status(error.message, true);
    return false;
  }
}

function setConnect(on) {
  connectMode = on;
  connectFrom = null;
  $("edge-detail").hidden = true;
  updateTools();
  if (view === "dashboard" && effectiveBoardMode() === "dag") selectNode(null);
}

async function toggleConnect() {
  if (store.busy || !(await finishFieldEdit())) return;
  setConnect(!connectMode);
}

async function activateCard(path) {
  if (!(await finishFieldEdit()) || view !== "dashboard" || effectiveBoardMode() !== "dag") return;
  selectNode(path);
  cardElement(path)?.focus({ preventScroll: true });
  if (!connectMode || !path || store.busy) return;
  if (!connectFrom) {
    connectFrom = path;
    updateTools();
    selectNode(path);
    return;
  }
  if (connectFrom === path) {
    connectFrom = null;
    updateTools();
    selectNode(null);
    return;
  }
  const upstream = graph.nodes.find((n) => n.path === connectFrom);
  connectFrom = null;
  updateTools();
  if (upstream) await changeDependency(path, upstream.stem, false);
}

function updateTools() {
  $("graph").classList.toggle("connecting", connectMode);
  $("connect").classList.toggle("active", connectMode);
  $("connect").setAttribute("aria-pressed", String(connectMode));
  $("connect").disabled = store.busy;
  $("connect").title = connectMode
    ? tr("Exit Connect (Esc)", "退出连线（Esc）")
    : tr("Connect dependencies (C)", "连接依赖（C）");
  $("connect").setAttribute("aria-label", $("connect").title);
  $("connect-hint").hidden = !connectMode;
  const from = graph.nodes.find((n) => n.path === connectFrom);
  if (!from) connectFrom = null;
  $("connect-hint").textContent = from
    ? tr(`From ${from.title} → choose the dependent card`, `从 ${from.title} → 选择依赖它的卡片`)
    : tr("Choose an upstream card, then its dependent. Esc exits.", "先选上游，再选依赖它的卡片。Esc 退出。");
  $("zoom-label").textContent = Math.round(scale * 100) + "%";
  $("zoom-label").classList.toggle("active", zoomLocked);
  $("zoom-label").setAttribute("aria-pressed", String(zoomLocked));
  $("zoom-out").disabled = $("zoom-in").disabled = $("fit").disabled = zoomLocked;
}

async function resetLayout() {
  if (!(await finishFieldEdit())) return;
  offsets.clear();
  renderGraph();
}

function layoutNodes(nodes, dragOffsets = new Map()) {
  const columns = new Map();
  for (const node of nodes) {
    if (!columns.has(node.col)) columns.set(node.col, []);
    columns.get(node.col).push(node);
  }
  const result = new Map(),
    rows = Math.max(0, ...[...columns.values()].map((list) => list.length));
  for (const [col, list] of columns)
    list.forEach((node, i) => {
      const offset = dragOffsets.get(node.path) || { x: 0, y: 0 };
      result.set(node.path, {
        x: 48 + (col - 1) * (CARD.width + CARD.columnGap) + offset.x,
        y: 46 + ((rows - list.length) / 2 + i) * (CARD.height + CARD.rowGap) + offset.y,
        w: CARD.width,
        h: CARD.height,
      });
    });
  return result;
}

function centerOf(p) {
  return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
}

function portAt(p, side, offset) {
  const c = centerOf(p),
    [dx, dy] = PORT_SIDES[side];
  return {
    x: c.x + dx * (p.w / 2 + 10) + (dy ? offset : 0),
    y: c.y + dy * (p.h / 2 + 10) + (dx ? offset : 0),
  };
}

function routeEdges(edges, layout) {
  const groups = new Map();
  const routed = edges.map((edge) => {
    const a = layout.get(edge.from),
      b = layout.get(edge.to),
      ac = centerOf(a),
      bc = centerOf(b);
    const dx = bc.x - ac.x,
      dy = bc.y - ac.y;
    const sides =
      Math.abs(dx) >= Math.abs(dy) * 0.85
        ? dx >= 0
          ? ["right", "left"]
          : ["left", "right"]
        : dy >= 0
          ? ["bottom", "top"]
          : ["top", "bottom"];
    const item = { ...edge, a, b, fromSide: sides[0], toSide: sides[1], fromOffset: 0, toOffset: 0 };
    for (const end of ["from", "to"]) {
      const key = edge[end] + "\0" + item[end + "Side"];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ item, end, far: centerOf(end === "from" ? b : a) });
    }
    return item;
  });
  for (const group of groups.values()) {
    const { item, end } = group[0],
      host = end === "from" ? item.a : item.b;
    const horizontal = ["left", "right"].includes(item[end + "Side"]),
      axis = horizontal ? "y" : "x";
    group.sort(
      (a, b) =>
        a.far[axis] - b.far[axis] ||
        a.item.from.localeCompare(b.item.from) ||
        a.item.to.localeCompare(b.item.to),
    );
    const mid = group.findIndex((port) => Math.abs(port.far[axis] - centerOf(host)[axis]) <= 6);
    const origin = mid >= 0 ? mid : (group.length - 1) / 2;
    const distance = Math.max(origin, group.length - 1 - origin, 1);
    const step = Math.min(18, ((horizontal ? host.h : host.w) * 0.275) / distance);
    group.forEach((port, i) => {
      port.item[port.end + "Offset"] = (i - origin) * step;
    });
  }
  return routed;
}

function edgePath(edge) {
  const s = portAt(edge.a, edge.fromSide, edge.fromOffset),
    t = portAt(edge.b, edge.toSide, edge.toOffset);
  const sv = PORT_SIDES[edge.fromSide],
    tv = PORT_SIDES[edge.toSide];
  const bend = Math.max(28, Math.min(150, Math.hypot(t.x - s.x, t.y - s.y) * 0.42));
  return `M${s.x},${s.y} C${s.x + sv[0] * bend},${s.y + sv[1] * bend} ${t.x + tv[0] * bend},${t.y + tv[1] * bend} ${t.x},${t.y}`;
}

function transformCanvas() {
  $("viewport").style.transform = `translate(${pan.x}px,${pan.y}px) scale(${scale})`;
  updateTools();
  $("graph").style.backgroundPosition = `${pan.x}px ${pan.y}px`;
  $("graph").style.backgroundSize = `${34 * scale}px ${34 * scale}px`;
  updateMiniView();
}

function renderGraph() {
  if (fieldEditor) {
    updateTools();
    return;
  }
  if (drag) {
    graphRenderPending = true;
    updateTools();
    return;
  }
  graphRenderPending = false;
  const shown = visibleNodes();
  $("graph").style.setProperty("--card-width", CARD.width + "px");
  $("graph").style.setProperty("--card-height", CARD.height + "px");
  positions = layoutNodes(shown, offsets);
  $("graph-cards").innerHTML = shown.map((n) => cardHTML(n, "dag")).join("");
  $("graph-empty").hidden = !!shown.length;
  for (const el of $("graph-cards").children) {
    const p = positions.get(el.dataset.node);
    el.style.transform = `translate(${p.x}px,${p.y}px)`;
  }
  const byStem = new Map(shown.map((n) => [n.stem, n]));
  edgeViews = [];
  for (const node of shown)
    for (const stem of node.validAfter || []) {
      const from = byStem.get(stem);
      if (from) edgeViews.push({ from: from.path, to: node.path, stem });
    }
  edgeViews = routeEdges(edgeViews, positions);
  $("edge-lines").innerHTML = edgeViews
    .map((edge, index) => {
      const d = edgePath(edge);
      const label = esc(
        (catalogEntry(edge.from)?.title || edge.from) +
          " → " +
          (catalogEntry(edge.to)?.title || edge.to) +
          tr(". Open dependency actions", "。打开依赖操作"),
      );
      return `<path class="edge-hit" data-edge="${index}" d="${d}" tabindex="0" role="button" aria-label="${label}" aria-controls="edge-detail"></path><path class="edge" data-edge="${index}" d="${d}" aria-hidden="true"></path>`;
    })
    .join("");
  const paths = [...$("edge-lines").children];
  for (let i = 0; i < edgeViews.length; i++) edgeViews[i].elements = paths.slice(i * 2, i * 2 + 2);
  renderMinimap(shown);
  selectNode(selectedNode);
  if (!graphReady && positions.size && $("graph").clientWidth && $("graph").clientHeight) {
    graphReady = true;
    fitGraph();
  } else transformCanvas();
}

function layoutBounds() {
  if (!positions.size) return { left: 0, top: 0, right: 0, bottom: 0 };
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const p of positions.values()) {
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    right = Math.max(right, p.x + p.w);
    bottom = Math.max(bottom, p.y + p.h);
  }
  return { left, top, right, bottom };
}

function fitGraph() {
  if (zoomLocked || !positions.size) return;
  const { left, top, right, bottom } = layoutBounds();
  const bounds = $("graph").getBoundingClientRect();
  const topSpace = $("minimap").getBoundingClientRect().height + 36,
    bottomSpace = 70;
  scale = Math.min(
    1,
    Math.max(
      0.25,
      Math.min(
        (bounds.width - 50) / Math.max(1, right - left),
        (bounds.height - topSpace - bottomSpace) / Math.max(1, bottom - top),
      ),
    ),
  );
  pan = { x: (bounds.width - (right - left) * scale) / 2 - left * scale, y: topSpace - top * scale };
  transformCanvas();
}

function zoom(factor, focus) {
  if (zoomLocked) return;
  const old = scale,
    next = Math.max(0.25, Math.min(2, old * factor)),
    box = $("graph").getBoundingClientRect();
  const x = focus?.x ?? box.width / 2,
    y = focus?.y ?? box.height / 2;
  pan.x = x - ((x - pan.x) * next) / old;
  pan.y = y - ((y - pan.y) * next) / old;
  scale = next;
  transformCanvas();
}

function selectNode(path) {
  if (path && !positions.has(path)) path = null;
  selectedNode = path;
  const neighbors = new Set([path]);
  for (const edge of edgeViews)
    if (edge.from === path || edge.to === path) {
      neighbors.add(edge.from);
      neighbors.add(edge.to);
    }
  for (const el of $("graph-cards").children) {
    el.classList.toggle("selected", el.dataset.node === path);
    el.classList.toggle("connect-origin", el.dataset.node === connectFrom);
    el.style.opacity = connectMode || !path || neighbors.has(el.dataset.node) ? "1" : ".3";
  }
  for (const edge of edgeViews)
    for (const el of edge.elements) {
      const active = edge.from === path || edge.to === path;
      el.classList.toggle("selected", active);
      el.classList.toggle("dim", !!path && !active);
    }
  $("edge-detail").hidden = true;
}

function updateMiniView() {
  const box = $("graph").getBoundingClientRect(),
    rect = $("mini-view");
  if (!box.width || !box.height) return;
  const v = { x: -pan.x / scale, y: -pan.y / scale, w: box.width / scale, h: box.height / scale };
  rect.setAttribute("x", v.x);
  rect.setAttribute("y", v.y);
  rect.setAttribute("width", v.w);
  rect.setAttribute("height", v.h);
  if (miniDragId === null) {
    const x = Math.min(miniBounds.x, v.x) - 20,
      y = Math.min(miniBounds.y, v.y) - 20;
    const right = Math.max(miniBounds.x + miniBounds.w, v.x + v.w) + 20;
    const bottom = Math.max(miniBounds.y + miniBounds.h, v.y + v.h) + 20;
    $("minimap").setAttribute("viewBox", `${x} ${y} ${right - x} ${bottom - y}`);
  }
}

function renderMinimap(shown = visibleNodes()) {
  const { left, top, right, bottom } = layoutBounds();
  miniBounds = { x: left - 20, y: top - 20, w: right - left + 40, h: bottom - top + 40 };
  $("mini-nodes").innerHTML = shown
    .map((node) => {
      const p = positions.get(node.path);
      return `<rect class="mini-node plan-${esc(node.progress || "unknown")}" data-mini="${esc(node.path)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" stroke-width="1" vector-effect="non-scaling-stroke"></rect>`;
    })
    .join("");
  miniRects = new Map([...$("mini-nodes").children].map((el) => [el.dataset.mini, el]));
  updateMiniView();
}

function panMini(event) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    $("minimap").getScreenCTM().inverse(),
  );
  const box = $("graph").getBoundingClientRect();
  pan = { x: box.width / 2 - point.x * scale, y: box.height / 2 - point.y * scale };
  transformCanvas();
}

function drawDrag() {
  frame = null;
  if (!drag) return;
  if (drag.path) {
    const dx = (drag.lastX - drag.startX) / scale,
      dy = (drag.lastY - drag.startY) / scale;
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
      if (edge.elements[0].getAttribute("d") !== d) for (const el of edge.elements) el.setAttribute("d", d);
    }
  } else {
    pan = { x: drag.pan.x + drag.lastX - drag.startX, y: drag.pan.y + drag.lastY - drag.startY };
    transformCanvas();
  }
}

async function openEdge(element, keyboard) {
  const edge = edgeViews[Number(element.dataset.edge)];
  if (!edge || !(await finishFieldEdit())) return;
  $("edge-detail").hidden = false;
  $("edge-detail").dataset.edge = element.dataset.edge;
  setHTML(
    $("edge-detail"),
    `<button data-close-edge aria-label="${tr("Close", "关闭")}">×</button><p>${esc(catalogEntry(edge.from)?.title || edge.from)} → ${esc(catalogEntry(edge.to)?.title || edge.to)}</p><button data-remove-after="${esc(edge.stem)}" data-path="${esc(edge.to)}" ${store.busy ? "disabled" : ""}>${tr("Remove dependency", "移除依赖")}</button>`,
  );
  if (keyboard) $("edge-detail").querySelector("[data-remove-after]")?.focus();
}

function closeEdge() {
  const index = $("edge-detail").dataset.edge;
  const restore = $("edge-detail").contains(document.activeElement);
  selectNode(null);
  if (restore) $("edge-lines").querySelector(`.edge-hit[data-edge="${index}"]`)?.focus();
}

function endDrag(event) {
  if (frame) {
    cancelAnimationFrame(frame);
    drawDrag();
  }
  const clicked = drag && Math.hypot(drag.lastX - drag.startX, drag.lastY - drag.startY) < 4;
  const path = drag?.path;
  if (path) renderMinimap();
  drag = null;
  if (graphRenderPending && view === "dashboard" && effectiveBoardMode() === "dag") renderGraph();
  if (clicked && event.type === "pointerup") activateCard(path || null);
}

function bindBoard() {
  $("minimap").addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || miniDragId !== null) return;
    miniDragId = event.pointerId;
    $("minimap").setPointerCapture(event.pointerId);
    panMini(event);
    event.stopPropagation();
  });
  $("minimap").addEventListener("pointermove", (event) => {
    if ($("minimap").hasPointerCapture(event.pointerId)) panMini(event);
  });
  $("minimap").addEventListener("lostpointercapture", () => {
    miniDragId = null;
    updateMiniView();
  });
  new ResizeObserver(updateMiniView).observe($("graph"));
  $("fit").onclick = fitGraph;
  $("zoom-in").onclick = () => zoom(1.2);
  $("zoom-out").onclick = () => zoom(1 / 1.2);
  $("zoom-label").onclick = () => {
    zoomLocked = !zoomLocked;
    updateTools();
  };
  $("reset-layout").onclick = resetLayout;
  $("connect").onclick = toggleConnect;
  $("graph").addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      event.target.closest("button,input,textarea,select,.field-editor,.graph-tools,.edge-detail,[data-edge],#minimap")
    )
      return;
    const handle = event.target.closest("[data-node]");
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      pan: { ...pan },
    };
    if (handle) {
      const path = handle.dataset.node;
      Object.assign(drag, {
        path,
        element: handle.closest(".spec-card"),
        position: { ...positions.get(path) },
        offset: offsets.get(path) || { x: 0, y: 0 },
      });
    }
    $("graph").setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  $("graph").addEventListener("pointermove", (event) => {
    if (!drag) return;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!frame) frame = requestAnimationFrame(drawDrag);
  });
  $("graph").addEventListener("pointerup", endDrag);
  $("graph").addEventListener("pointercancel", endDrag);
  $("graph").addEventListener("lostpointercapture", endDrag);
  $("graph").addEventListener(
    "wheel",
    (event) => {
      if (event.target.closest("textarea,input,select,.edge-detail")) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey || event.altKey) {
        const box = $("graph").getBoundingClientRect();
        zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, { x: event.clientX - box.x, y: event.clientY - box.y });
      } else {
        pan.x -= event.shiftKey ? event.deltaY : event.deltaX;
        pan.y -= event.shiftKey ? 0 : event.deltaY;
        transformCanvas();
      }
    },
    { passive: false },
  );
}
