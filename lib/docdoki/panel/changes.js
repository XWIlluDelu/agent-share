/* Unsaved review, saved handoffs and explicit disk synchronization. Only Save writes files.
   Assembled with panel.js into one lexical scope; DOM bindings run at startup. */

const diffCache = new Map(),
  conflicts = new Map();

let changeTimer = null,
  syncSequence = 0,
  saveFailure = null;

let copySequence = 0;

/* Pending changes and receipts are separate, memory-only products. */
function renderChanges(details = true) {
  const edits = store.edits(),
    paths = new Set(edits.map((e) => e.path));
  for (const cache of [diffCache, conflicts])
    for (const path of cache.keys()) if (!paths.has(path)) cache.delete(path);
  if (bodyDirty()) paths.add(bodyEditor.path);
  if (fieldDirty()) paths.add(fieldEditor.path);
  $("count").hidden = !paths.size;
  $("count").textContent = paths.size;
  $("save-controls").hidden = !edits.length && !store.receipt.length;
  $("save").hidden = !edits.length;
  $("save").disabled = store.busy || !!conflicts.size;
  $("save").textContent = store.busy ? tr("Saving…", "保存中…") : tr("Save", "保存");
  $("copy-agent").disabled = store.busy;
  $("export").hidden = !saveFailure || !edits.length;
  $("save-error").hidden = !saveFailure || !edits.length;
  $("save-error").textContent = saveFailure
    ? saveFailure.unknown
      ? tr("Save could not be confirmed. Your edits are kept.", "无法确认保存结果，修改已保留。")
      : tr("Save failed. Your edits are kept.", "保存失败，修改已保留。")
    : "";
  $("save-error").title = saveFailure?.message || "";
  bodySurface?.model.setReadOnly();
  $("source-view").disabled = store.busy || !store.base.has(current);
  document.querySelectorAll("[data-field],[data-remove-after],[data-discard],#connect").forEach((el) => {
    el.disabled = store.busy;
  });
  if (!details) return;
  const list = $("change-list"),
    existing = new Map([...list.querySelectorAll(".change")].map((el) => [el.dataset.path, el]));
  for (const [path, el] of existing) if (!paths.has(path)) el.remove();
  if (!edits.length) {
    const savedCount = new Set(store.receipt.map((e) => e.path)).size;
    setHTML(
      list,
      `<p>${savedCount ? tr(`Saved changes in ${savedCount} document(s) retained for handoff.`, `已保留 ${savedCount} 份文档的已保存修改，供交接。`) : tr("No unsaved changes.", "没有待保存的修改。")}</p>`,
    );
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
        '<header></header><p class="summary"></p><details class="change-details"><summary data-en="View changes" data-zh="查看差异">View changes</summary><div class="change-diff"></div></details><div class="conflict" hidden></div>';
      el.querySelector(".change-details").addEventListener("toggle", () => renderChangeDiff(el));
      list.append(el);
    }
    const doc = store.base.get(edit.path);
    setHTML(
      el.querySelector("header"),
      `<button data-doc="${esc(edit.path)}" title="${esc(edit.path)}">${esc(doc?.title || edit.path)}${privacy(doc)}</button><button data-discard="${esc(edit.path)}" ${store.busy ? "disabled" : ""}>${tr("Discard changes", "撤回修改")}</button>`,
    );
    const before = edit.from.split("\n"),
      after = edit.to.split("\n");
    let first = 0;
    while (first < Math.min(before.length, after.length) && before[first] === after[first]) first++;
    el.querySelector(".summary").textContent =
      (before[first] || "∅").slice(0, 80) + " → " + (after[first] || "∅").slice(0, 80);
    renderChangeDiff(el);
    const conflict = conflicts.get(edit.path),
      surface = el.querySelector(".conflict");
    surface.hidden = !conflict;
    if (conflict)
      setHTML(
        surface,
        `<p>${tr("This document changed elsewhere. Your edits are kept.", "此文档有外部修改。你的修改已保留。")}</p><details><summary>${tr("View external version", "查看外部版本")}</summary><pre class="external-source">${esc(conflict.source ?? tr("File unavailable: ", "文件不可用：") + conflict.error)}</pre></details>`,
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
  const diff = section.querySelector(".change-diff"),
    full = diff.querySelector("details");
  const open = full?.open,
    focused = document.activeElement === full?.querySelector("summary");
  if (setHTML(diff, cached.html)) {
    if (open) diff.querySelector("details").open = true;
    if (focused) diff.querySelector("summary").focus({ preventScroll: true });
  }
  diff.querySelectorAll("[data-en]").forEach((el) => {
    el.textContent = el.dataset[lang];
  });
}

function changed(message = "") {
  invalidatePreview();
  clearPrompt();
  renderChanges(false);
  renderCatalog();
  renderDiagnostics();
  clearTimeout(changeTimer);
  changeTimer = setTimeout(renderChanges, 150);
  if (view === "doc")
    $("document-path").innerHTML = esc(current) + privacy(currentDocument()) + draftTag(current);
  status(message);
}

function buildPrompt() {
  const uncertainty =
    store.drafts.size && saveFailure
      ? tr(
          "A save attempt failed or was not confirmed; some edits may already be on disk. Check actual files before applying anything.\n\n",
          "一次保存失败或结果未确认，部分修改可能已在磁盘上。应用前必须核对实际文件。\n\n",
        )
      : "";
  const sections = [];
  const describe = (e, saved, i) => {
    const external = !saved && conflicts.get(e.path);
    return (
      (saved ? `${i + 1}. ` : "") +
      e.path +
      (e.private || store.base.get(e.path)?.private ? " [PRIVATE]" : " [SHARED]") +
      (saved
        ? "\n--- HISTORICAL BEFORE (NOT A WRITE PRECONDITION) ---\n"
        : "\n--- CAPTURED DISK BASELINE (CHECK BEFORE WRITING) ---\n") +
      e.from +
      "\n--- AFTER ---\n" +
      e.to +
      (external
        ? "\n--- EXTERNAL VERSION (CHECK AGAIN BEFORE WRITING) ---\n" + (external.source ?? external.error)
        : "")
    );
  };
  if (store.receipt.length)
    sections.push(
      tr(
        "SAVED — chronological changes from this tab, including earlier saves. Read current files and follow the changed intent within the authorized scope. Do not apply these historical patches again. Later entries may supersede earlier ones; saving or copying is not evidence that implementation is aligned.",
        "已保存——本标签页累计的修改，按保存顺序排列。读取当前文件，在授权范围内 follow 变更意图；不要再次应用历史补丁。后续记录可能取代先前内容；保存或复制不表示实现已对齐。",
      ) +
        "\n\n" +
        store.receipt.map((e, i) => describe(e, true, i)).join("\n\n"),
    );
  if (store.drafts.size)
    sections.push(
      tr(
        "UNSAVED — check each captured disk baseline against the current file before applying, then follow the intent within the authorized scope. Historical saved versions above are NOT these write preconditions. Preserve unrelated work and public/private boundaries.",
        "尚未保存——逐份核对捕获的磁盘基线后再应用，并在授权范围内 follow 意图。上方历史保存版本不是这些修改的写入前置条件。保留无关工作和公私边界。",
      ) +
        "\n\n" +
        store
          .edits()
          .map((e) => describe(e, false))
          .join("\n\n"),
    );
  return (
    uncertainty +
    tr(
      "Coordinate other writers before writing these files.\nProject: ",
      "写入这些文件前请协调其他写者。\n项目：",
    ) +
    graph.meta.root +
    "\n\n" +
    sections.join("\n\n")
  );
}

function clearPrompt() {
  copySequence++;
  $("prompt-label").hidden = $("prompt").hidden = true;
  $("prompt").value = "";
  $("private-warning").hidden = true;
}

function warnPrivate() {
  const edits = [...store.receipt, ...store.edits()];
  $("private-warning").hidden = !edits.some((e) => e.private || store.base.get(e.path)?.private);
  $("private-warning").textContent = tr(
    "Contains private edits. Share only with a trusted agent.",
    "包含私有修改，请只交给可信的 Agent。",
  );
}

async function copyPrompt() {
  if (store.busy) return;
  if (!(await finishEditing())) return;
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
  } catch (error) {
    if (sequence !== copySequence) return;
    $("prompt-label").hidden = $("prompt").hidden = false;
    $("prompt").focus();
    $("prompt").select();
    status(tr("Copy failed. Select and copy the request below.", "复制失败，请手动复制下方请求。"), true);
  }
}

async function save() {
  if (store.busy || !(await finishEditing())) return;
  if (conflicts.size) {
    setChanges(true, true);
    return;
  }
  const edits = store.startSave();
  if (!edits) return;
  clearPrompt();
  invalidatePreview();
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
      renderChanges();
      await updatePreview();
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
  if (store.busy || fieldEditor || bodyEditor) return;
  const previous = store,
    version = store.version,
    navigation = navigationSequence,
    fields = fieldSequence,
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
      bodyEditor ||
      fields !== fieldSequence ||
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
    const receipt = store.receipt,
      scroll = $("workspace").scrollTop;
    const bookmark = bodySurface?.model.bookmark();
    graph = snapshot;
    store = new DraftStore(snapshot.documents);
    store.receipt = receipt;
    invalidatePreview();
    diffCache.clear();
    saveFailure = null;
    if (view === "doc" && !store.base.has(current)) {
      current = OVERVIEW;
      view = "graph";
      sourceMode = false;
    }
    updateMeta();
    renderMain();
    renderCatalog();
    renderChanges();
    renderDiagnostics();
    $("workspace").scrollTop = scroll;
    if (bookmark && bodySurface) bodySurface.model.restore(bookmark);
  } catch (error) {
    if (store === previous && store.version === version && sequence === syncSequence)
      status(tr("Could not check for updates. Your edits are kept.", "暂时无法检查更新，修改已保留。"), true);
  }
}

async function discardChanges(path) {
  if (store.busy || !store.drafts.has(path)) return;
  if (!(await finishEditing())) return;
  const previous = store,
    version = store.version,
    fields = fieldSequence;
  try {
    const doc = await request("/document?path=" + encodeURIComponent(path));
    const missing =
      typeof doc.source !== "string" && doc.error?.startsWith("missing or unsupported document path:");
    if (typeof doc.source !== "string" && !missing) throw new Error(doc.error);
    if (store !== previous || store.version !== version || store.busy || fields !== fieldSequence) {
      status(tr("Editing continued; nothing was discarded.", "编辑仍在继续，未撤回修改。"));
      return;
    }
    store.discard(path, missing ? null : doc);
    conflicts.delete(path);
    if (missing) {
      delete graph.documents[path];
      graph.catalog = graph.catalog.filter((d) => d.path !== path);
      if (current === path) {
        current = OVERVIEW;
        view = "graph";
        sourceMode = false;
      }
    } else graph.documents[path] = doc;
    if (!store.drafts.size) saveFailure = null;
    changed(tr("Changes discarded.", "修改已撤回。"));
    schedulePreview();
    renderChanges();
    renderMain();
    if (!store.drafts.size) await syncDocuments();
    $("changes-close").focus();
  } catch (error) {
    status(
      tr("Could not discard changes; your edits are kept. ", "无法撤回，修改已保留。") + error.message,
      true,
    );
  }
}
