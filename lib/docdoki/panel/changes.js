/* Unsaved review, compact unified-diff handoffs, steering notes, and disk sync. */

const diffCache = new Map(),
  conflicts = new Map();

let changeTimer = null,
  syncSequence = 0,
  saveFailure = null,
  copySequence = 0;

function renderChanges(details = true) {
  const edits = store.edits(),
    saved = store.savedEntries(),
    note = ($("steering-note")?.value || "").trim(),
    paths = new Set(edits.map((e) => e.path));

  for (const cache of [diffCache, conflicts])
    for (const path of cache.keys()) if (!paths.has(path)) cache.delete(path);

  $("count").hidden = !paths.size;
  $("count").textContent = paths.size;
  $("save").hidden = !edits.length;
  $("save").disabled = store.busy || !!conflicts.size;
  $("save").textContent = store.busy ? tr("Saving…", "保存中…") : tr("Save", "保存");
  $("copy-agent").disabled = store.busy || (!edits.length && !saved.length && !note);
  $("export").hidden = !saveFailure || !edits.length;
  $("save-error").hidden = !saveFailure || !edits.length;
  $("save-error").textContent = saveFailure
    ? saveFailure.unknown
      ? tr("Save could not be confirmed. Your edits are kept.", "无法确认保存结果，修改已保留。")
      : tr("Save failed. Your edits are kept.", "保存失败，修改已保留。")
    : "";
  $("save-error").title = saveFailure?.message || "";
  $("source-view").disabled = store.busy || !store.base.has(current);
  document.querySelectorAll("[data-field],[data-remove-after],[data-discard],#connect").forEach((el) => {
    el.disabled = store.busy;
  });

  if (!details) return;
  const list = $("change-list"),
    existing = new Map([...list.querySelectorAll(".change")].map((el) => [el.dataset.path, el]));
  for (const [path, el] of existing) if (!paths.has(path)) el.remove();

  if (!edits.length) {
    const savedMsg = saved.length
      ? tr(
          `Saved changes in ${saved.length} document(s) ready for agent handoff.`,
          `已保存 ${saved.length} 份文档的修改，可直接复制给 Agent。`,
        )
      : tr("No unsaved changes. Add a steering note below to message the agent.", "没有待保存的修改。可在下方填写补充说明直接复制给 Agent。");
    setHTML(list, `<p class="change-empty">${savedMsg}</p>`);
    return;
  }

  list.querySelector(":scope > p")?.remove();
  renderedHTML.delete(list);

  for (const edit of edits) {
    let el = existing.get(edit.path);
    if (!el) {
      el = document.createElement("section");
      el.className = "change";
      el.dataset.path = edit.path;
      el.innerHTML =
        '<header></header><p class="summary"></p><details class="change-details"><summary>' +
        CHEV_SVG +
        '<span data-en="View diff" data-zh="查看差异">View diff</span></summary><div class="change-diff"></div></details><div class="conflict" hidden></div>';
      el.querySelector(".change-details").addEventListener("toggle", () => renderChangeDiff(el));
      list.append(el);
    }
    const doc = store.base.get(edit.path);
    setHTML(
      el.querySelector("header"),
      `<button data-doc="${esc(edit.path)}" title="${esc(edit.path)}">${esc(doc?.title || edit.path)}${privacy(doc)}</button><button data-discard="${esc(edit.path)}" ${store.busy ? "disabled" : ""}>${tr("Discard", "撤回")}</button>`,
    );
    const before = edit.from.split("\n"),
      after = edit.to.split("\n");
    let first = 0;
    while (first < Math.min(before.length, after.length) && before[first] === after[first]) first++;
    el.querySelector(".summary").textContent =
      (before[first] || "∅").slice(0, 72) + " → " + (after[first] || "∅").slice(0, 72);
    renderChangeDiff(el);
    const conflict = conflicts.get(edit.path),
      surface = el.querySelector(".conflict");
    surface.hidden = !conflict;
    if (conflict)
      setHTML(
        surface,
        `<p>${tr("This document changed elsewhere. Your edits are kept.", "此文档有外部修改，你的修改已保留。")}</p><details><summary>${CHEV_SVG}<span>${tr("View external version", "查看外部版本")}</span></summary><pre class="external-source">${esc(conflict.source ?? tr("File unavailable: ", "文件不可用：") + conflict.error)}</pre></details>`,
      );
  }
  list.querySelectorAll("[data-en]").forEach((el) => {
    el.textContent = el.dataset[lang];
  });
}

function renderChangeDiff(section) {
  const path = section.dataset.path;
  if (!section.querySelector(".change-details").open || !store.drafts.has(path)) return;
  const from = store.base.get(path).source,
    to = store.source(path);
  let cached = diffCache.get(path);
  if (!cached || cached.from !== from || cached.to !== to) {
    cached = { from, to, html: diffHTML(from, to) };
    diffCache.set(path, cached);
  }
  const diff = section.querySelector(".change-diff");
  setHTML(diff, cached.html);
  diff.querySelectorAll("[data-en]").forEach((el) => {
    el.textContent = el.dataset[lang];
  });
}

function changed(message = "") {
  clearPrompt();
  renderChanges(false);
  renderCatalog();
  renderDiagnostics();
  clearTimeout(changeTimer);
  changeTimer = setTimeout(renderChanges, 120);
  if (view === "doc")
    $("document-path").innerHTML = esc(current) + privacy(currentDocument()) + draftTag(current);
  status(message);
}

/* Compact, deduplicated unified-diff handoff + optional human steering note. */
function buildPrompt() {
  const note = ($("steering-note")?.value || "").trim(),
    saved = store.savedEntries(),
    unsaved = store.edits(),
    parts = [];

  if (unsaved.length && saveFailure) {
    parts.push(
      tr(
        "WARNING: A save attempt failed or was unconfirmed; check actual files on disk before applying edits.",
        "警告：此前保存失败或未确认，应用前请先核对磁盘上的实际文件。",
      ),
    );
  }

  parts.push(tr("Project: ", "项目：") + graph.meta.root);

  if (note) {
    parts.push(tr("Steering note:\n", "补充说明：\n") + note);
  }

  if (saved.length) {
    const blocks = saved.map((e) => {
      const tag = e.private ? " [PRIVATE]" : "";
      return `${e.path}${tag}\n\`\`\`diff\n${unifiedDiff(e.path, e.from, e.to)}\n\`\`\``;
    });
    parts.push(
      tr(
        "SAVED (already on disk — read current files and reconcile contracts/code within authorized scope):",
        "已保存（已写入磁盘——请读取当前文件并在授权范围内对齐文档与代码）：",
      ) +
        "\n\n" +
        blocks.join("\n\n"),
    );
  }

  if (unsaved.length) {
    const blocks = unsaved.map((e) => {
      const tag = e.private ? " [PRIVATE]" : "";
      const conflict = conflicts.get(e.path);
      const conflictBlock = conflict
        ? "\n[External disk change detected; check current file before applying]"
        : "";
      return `${e.path}${tag}${conflictBlock}\n\`\`\`diff\n${unifiedDiff(e.path, e.from, e.to)}\n\`\`\``;
    });
    parts.push(
      tr(
        "UNSAVED DRAFTS (not written to disk yet — review/apply against current files, preserving unrelated work and private boundaries):",
        "未保存草稿（尚未写入磁盘——请对照当前文件核对后应用，保留无关工作与公私边界）：",
      ) +
        "\n\n" +
        blocks.join("\n\n"),
    );
  }

  return parts.join("\n\n");
}

function clearPrompt() {
  copySequence++;
  $("prompt-label").hidden = $("prompt").hidden = true;
  $("prompt").value = "";
  $("private-warning").hidden = true;
}

function warnPrivate() {
  const edits = [...store.savedEntries(), ...store.edits()];
  $("private-warning").hidden = !edits.some((e) => e.private || store.base.get(e.path)?.private);
  $("private-warning").textContent = tr(
    "Contains private edits. Share only with a trusted agent.",
    "包含私有修改，请只交给可信的 Agent。",
  );
}

async function copyPrompt() {
  if (store.busy) return;
  if (!(await finishFieldEdit())) return;
  clearPrompt();
  warnPrivate();
  const sequence = ++copySequence;
  const text = buildPrompt();
  $("prompt").value = text;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    if (sequence !== copySequence) return;
    status(tr("Request copied.", "请求已复制。"));
  } catch {
    if (sequence !== copySequence) return;
    $("prompt-label").hidden = $("prompt").hidden = false;
    $("prompt").focus();
    $("prompt").select();
    status(tr("Copy failed. Select and copy the request below.", "复制失败，请手动复制下方请求。"), true);
  }
}

async function save() {
  if (store.busy || !(await finishFieldEdit())) return;
  if (conflicts.size) {
    setChanges(true, true);
    return;
  }
  const edits = store.startSave();
  if (!edits) return;
  clearPrompt();
  renderChanges();
  try {
    const result = await request("/save", { edits });
    store.finishSave(result);
    if (!result.ok) saveFailure = { message: result.error };
    else {
      saveFailure = null;
      conflicts.clear();
      Object.assign(graph.documents, result.documents);
      status(tr(`Saved ${result.receipt.length} document(s).`, `已保存 ${result.receipt.length} 份文档。`));
      await refreshGraph();
      renderChanges();
    }
  } catch (error) {
    store.finishSave({ ok: false });
    saveFailure = { message: error.message, unknown: true };
  }
  if (saveFailure) {
    renderChanges();
    setChanges(true);
    await syncDocuments();
  }
  renderChanges();
  renderCatalog();
}

async function syncDocuments() {
  if (store.busy || fieldEditor || (view === "doc" && sourceMode)) return;
  const previous = store,
    version = store.version,
    navigation = navigationSequence,
    sequence = ++syncSequence;
  const edits = store.edits(),
    path = current;
  try {
    const snapshot = await request("/snapshot");
    if (snapshot.error) throw new Error(snapshot.error);
    const latest = new Map();
    for (const edit of edits) {
      const doc =
        snapshot.documents[edit.path] || (await request("/document?path=" + encodeURIComponent(edit.path)));
      if (doc.source !== edit.from) latest.set(edit.path, doc);
    }
    if (
      !edits.length &&
      view === "doc" &&
      !snapshot.documents[path] &&
      snapshot.catalog.some((d) => d.path === path)
    ) {
      const doc = await request("/document?path=" + encodeURIComponent(path));
      if (typeof doc.source !== "string") throw new Error(doc.error);
      snapshot.documents[path] = doc;
    }
    if (
      store !== previous ||
      store.version !== version ||
      store.busy ||
      fieldEditor ||
      sequence !== syncSequence ||
      navigation !== navigationSequence
    )
      return;
    if (
      JSON.stringify([...conflicts].map(([p, d]) => [p, d.source, d.error])) !==
      JSON.stringify([...latest].map(([p, d]) => [p, d.source, d.error]))
    )
      clearPrompt();
    conflicts.clear();
    for (const [p, doc] of latest) conflicts.set(p, doc);
    if (edits.length) {
      renderChanges();
      return;
    }
    const saved = store.saved,
      scroll = $("workspace-body").scrollTop;
    graph = snapshot;
    store = new DraftStore(snapshot.documents);
    store.saved = saved;
    diffCache.clear();
    saveFailure = null;
    if (view === "doc" && !store.base.has(current)) {
      current = overviewPath();
      view = "dashboard";
      sourceMode = false;
    }
    updateMeta();
    renderMain();
    renderCatalog();
    renderChanges();
    renderDiagnostics();
    $("workspace-body").scrollTop = scroll;
  } catch {
    if (store === previous && store.version === version && sequence === syncSequence)
      status(tr("Could not check for updates. Your edits are kept.", "暂时无法检查更新，修改已保留。"), true);
  }
}

async function discardChanges(path) {
  if (store.busy || !store.drafts.has(path)) return;
  if (!(await finishFieldEdit())) return;
  const previous = store,
    version = store.version;
  try {
    const doc = await request("/document?path=" + encodeURIComponent(path));
    const missing =
      typeof doc.source !== "string" && doc.error?.startsWith("missing or unsupported document path:");
    if (typeof doc.source !== "string" && !missing) throw new Error(doc.error);
    if (store !== previous || store.version !== version || store.busy) return;
    store.discard(path, missing ? null : doc);
    conflicts.delete(path);
    if (missing) {
      delete graph.documents[path];
      graph.catalog = graph.catalog.filter((d) => d.path !== path);
      if (current === path) {
        current = overviewPath();
        view = "dashboard";
        sourceMode = false;
      }
    } else graph.documents[path] = doc;
    if (!store.drafts.size) saveFailure = null;
    changed(tr("Changes discarded.", "修改已撤回。"));
    await refreshGraph();
    renderChanges();
    renderMain();
    if (!store.drafts.size) await syncDocuments();
  } catch (error) {
    status(tr("Could not discard changes: ", "无法撤回修改：") + error.message, true);
  }
}
