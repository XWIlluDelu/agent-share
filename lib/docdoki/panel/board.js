/* Card views, dependency controls and local canvas geometry; no source authority.
   Assembled with panel.js into one lexical scope; DOM bindings run at startup. */

let connectMode = false,
  connectFrom = null,
  zoomLocked = false;

async function changeDependency(path, stem, remove) {
  if (store.busy || !stem || !(await finishEditing())) return;
  if (store.base.get(path)?.kind !== "spec") return;
  const previous = store,
    version = store.version;
  try {
    // Add is idempotent. Connect never infers a toggle from a stale preview.
    const result = await request("/preview", {
      ...capturedSources(),
      after: { path, op: remove ? "remove" : "add", stem },
    });
    if (store !== previous || store.busy || version !== store.version || fieldEditor || bodyEditor)
      throw new Error(
        tr(
          "The source changed while checking dependencies; change not applied. Retry.",
          "校验依赖时源码或编辑状态已变化，未应用修改，请重试。",
        ),
      );
    if (!result.ok) throw new Error(result.error);
    const restoreFocus = $("edge-detail").contains(document.activeElement);
    const staged = store.set(path, result.graph.documents[path].source);
    graph = result.graph;
    $("edge-detail").hidden = true;
    if (staged) changed();
    renderMain();
    if (restoreFocus)
      $("graph-cards")
        .querySelector(`[data-node="${CSS.escape(path)}"]`)
        ?.focus({ preventScroll: true });
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

function cardElement(path) {
  return [...$("graph-cards").children].find((el) => el.dataset.node === path);
}

function setConnect(on) {
  connectMode = on;
  connectFrom = null;
  $("edge-detail").hidden = true;
  updateTools();
  if (view === "graph") selectNode(null);
}

async function toggleConnect() {
  if (store.busy || !(await finishEditing())) return;
  setConnect(!connectMode);
}

async function activateCard(path) {
  if (!(await finishEditing()) || view !== "graph") return;
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
  $("zoom-label").title = zoomLocked ? tr("Unlock zoom", "解锁缩放") : tr("Lock zoom", "锁定缩放");
  $("zoom-label").setAttribute("aria-label", $("zoom-label").textContent + " · " + $("zoom-label").title);
  $("zoom-out").disabled = $("zoom-in").disabled = $("fit").disabled = zoomLocked;
  $("reset-layout").title = tr("Restore automatic layout (R)", "恢复自动布局（R）");
}

async function resetLayout() {
  if (!(await finishEditing())) return;
  offsets.clear();
  renderGraph();
}

/* Canvas layout and geometry do not own document or editing state. */
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

function progressLabel(progress) {
  return (
    {
      "not-started": tr("Not started", "未开始"),
      "in-progress": tr("In progress", "进行中"),
      done: tr("Done", "已完成"),
    }[progress] || tr("Not recorded", "未记录")
  );
}

const CARD = { width: 300, height: 180, columnGap: 140, rowGap: 30 };

function cardHTML(node) {
  const field = (name, label) =>
    `data-field="${name}" data-path="${esc(node.path)}" aria-label="${tr("Edit ", "修改") + fieldLabel(name)}" title="${esc(label)}" ${store.busy ? "disabled" : ""}`;
  return `<section tabindex="0" aria-label="${esc(node.title)}" class="spec-card plan-${esc(node.progress || "unknown")} ${store.drafts.has(node.path) ? "dirty" : ""}" data-node="${esc(node.path)}"><header><button class="card-title field-button" ${field("title", node.title)}>${esc(node.title)}</button>${privacy(node)}</header><div class="ribbon"><button class="field-button card-purpose ${node.content ? "" : "is-empty"}" ${field("purpose", node.content || tr("Add a purpose", "填写摘要"))}><span>${esc(node.content) || tr("Add a purpose…", "填写摘要…")}</span></button></div><div class="card-foot"><button data-doc="${esc(node.path)}">${tr("Open", "打开")}</button><button class="progress-label" ${field("progress", progressLabel(node.progress))}>${esc(progressLabel(node.progress))}</button></div></section>`;
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

const PORT_SIDES = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

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

// Directional ports and stable sibling fan-out, not an obstacle-avoidance router.
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

function transform() {
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
  } // Never replace a native input during previews.
  if (drag) {
    graphRenderPending = true;
    updateTools();
    return;
  }
  graphRenderPending = false;
  const focusEdge = document.activeElement.matches(".edge-hit")
    ? edgeViews[Number(document.activeElement.dataset.edge)]
    : null;
  const focused = $("graph-cards").contains(document.activeElement) ? document.activeElement : null;
  const focusPath = focused?.closest("[data-node]")?.dataset.node;
  const focusControl = focused?.dataset.field
    ? `[data-field="${CSS.escape(focused.dataset.field)}"]`
    : focused?.hasAttribute("data-doc")
      ? "[data-doc]"
      : null;
  $("graph").style.setProperty("--card-width", CARD.width + "px");
  $("graph").style.setProperty("--card-height", CARD.height + "px");
  positions = layoutNodes(graph.nodes, offsets);
  $("graph-cards").innerHTML = graph.nodes.map(cardHTML).join("");
  $("graph-empty").hidden = !!graph.nodes.length;
  for (const el of $("graph-cards").children) {
    const p = positions.get(el.dataset.node);
    el.style.transform = `translate(${p.x}px,${p.y}px)`;
  }
  const byStem = new Map(graph.nodes.map((n) => [n.stem, n]));
  edgeViews = [];
  for (const node of graph.nodes)
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
  renderMinimap();
  selectNode(selectedNode);
  // Fit once, synchronously against the first visible, populated board. Never
  // leave a delayed camera reset that could overwrite the user's next gesture.
  if (!graphReady && positions.size && $("graph").clientWidth && $("graph").clientHeight) {
    graphReady = true;
    fitGraph();
  } else transform();
  if (focusPath) {
    const card = cardElement(focusPath);
    (focusControl ? card?.querySelector(focusControl) : card)?.focus({ preventScroll: true });
    if (!card) $("workspace").focus({ preventScroll: true });
  } else if (focusEdge) {
    const index = edgeViews.findIndex((e) => e.from === focusEdge.from && e.to === focusEdge.to);
    ($("edge-lines").querySelector(`.edge-hit[data-edge="${index}"]`) || $("workspace")).focus({
      preventScroll: true,
    });
  }
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
        (bounds.width - 50) / (right - left),
        (bounds.height - topSpace - bottomSpace) / (bottom - top),
      ),
    ),
  );
  pan = { x: (bounds.width - (right - left) * scale) / 2 - left * scale, y: topSpace - top * scale };
  transform();
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
  transform();
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
  const matched = new Set(graph.nodes.filter(matches).map((n) => n.path));
  for (const el of $("graph-cards").children) {
    el.classList.toggle("selected", el.dataset.node === path);
    el.classList.toggle("search-match", !!query && matched.has(el.dataset.node));
    el.classList.toggle("connect-origin", el.dataset.node === connectFrom);
    el.style.opacity =
      matched.has(el.dataset.node) && (connectMode || !path || neighbors.has(el.dataset.node)) ? "1" : ".3";
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
  const view = { x: -pan.x / scale, y: -pan.y / scale, w: box.width / scale, h: box.height / scale };
  rect.setAttribute("x", view.x);
  rect.setAttribute("y", view.y);
  rect.setAttribute("width", view.w);
  rect.setAttribute("height", view.h);
  if (miniDragId === null) {
    // Show the whole viewport frame, even when the graph is smaller than it.
    // Keep this coordinate system fixed during a minimap drag.
    const x = Math.min(miniBounds.x, view.x) - 20,
      y = Math.min(miniBounds.y, view.y) - 20;
    const right = Math.max(miniBounds.x + miniBounds.w, view.x + view.w) + 20;
    const bottom = Math.max(miniBounds.y + miniBounds.h, view.y + view.h) + 20;
    $("minimap").setAttribute("viewBox", `${x} ${y} ${right - x} ${bottom - y}`);
  }
}

function renderMinimap() {
  const { left, top, right, bottom } = layoutBounds();
  miniBounds = { x: left - 20, y: top - 20, w: right - left + 40, h: bottom - top + 40 };
  const colors = { done: "#c0d4a7", "in-progress": "#8c9ae0", "not-started": "#a5b8c0" };
  $("mini-nodes").innerHTML = graph.nodes
    .map((node) => {
      const p = positions.get(node.path);
      return `<rect data-mini="${esc(node.path)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${colors[node.progress] || "white"}" stroke="black" stroke-width="1" vector-effect="non-scaling-stroke"></rect>`;
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
  transform();
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
      // Shared-port siblings may move too; preserve all card and edge DOM nodes.
      if (edge.elements[0].getAttribute("d") !== d) for (const el of edge.elements) el.setAttribute("d", d);
    }
  } else {
    pan = { x: drag.pan.x + drag.lastX - drag.startX, y: drag.pan.y + drag.lastY - drag.startY };
    transform();
  }
}

async function openEdge(element, keyboard) {
  const edge = edgeViews[Number(element.dataset.edge)];
  if (!edge || !(await finishEditing())) return;
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
  if (graphRenderPending && view === "graph") renderGraph();
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
      event.target.closest(
        "button,input,textarea,select,.field-editor,.graph-tools,.edge-detail,[data-edge],#minimap",
      )
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
        transform();
      }
    },
    { passive: false },
  );
}
