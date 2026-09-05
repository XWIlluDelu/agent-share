/* Captured body sessions and native card buffers. Only validated full sources enter DraftStore.
   Assembled with panel.js into one lexical scope; DOM bindings run at startup. */

let bodyEditor = null,
  bodySurface = null,
  bodyPointerDown = false;

let fieldEditor = null,
  fieldSequence = 0,
  composing = false;

async function finishEditing() {
  fieldSequence++; // Cancel an outstanding local-editor open request on another view.
  if (bodyEditor && !(await commitBody())) return false;
  if (fieldEditor && !(await commitField())) return false;
  renderChanges(false);
  return true;
}

/* One continuous source-backed editor serves live Markdown and full source.
   Local transactions stay in memory; previews validate the complete captured source. */
function bodyDirty() {
  return !!bodyEditor && bodyEditor.model.source !== bodyEditor.before;
}

function renderBody(doc) {
  if (
    bodySurface?.owner === store &&
    bodySurface.version === store.version &&
    bodySurface.path === current &&
    bodySurface.model.source === store.source(current)
  )
    return;
  const bookmark = bodySurface?.path === current ? bodySurface.model.bookmark() : null;
  bodySurface?.model.destroy();
  bodySurface = null;
  $("reading").replaceChildren();
  renderedHTML.delete($("reading"));
  if (!doc || !store.base.has(current)) {
    setHTML($("reading"), `<h1>${tr("Document not found", "未找到文档")}</h1>`);
    return;
  }
  const surface = (bodySurface = { path: current, owner: store, version: store.version, model: null });
  surface.model = DocDokiBody.create({
    parent: $("reading"),
    source: store.source(current),
    markdown,
    resolveLink,
    label: () => (sourceMode ? tr("Document source", "文档源码") : tr("Document", "文档")),
    canEdit: () =>
      !store.busy && surface.owner === store && surface.version === store.version && surface === bodySurface,
    onFocus: beginBody,
    onBlur: scheduleBodyBlur,
    onChange: () => {
      beginBody();
      if (bodyEditor) bodyEditor.generation++;
      $("reading").removeAttribute("aria-invalid");
      clearPrompt();
      queueMicrotask(() => {
        renderChanges(false);
        if (!bodyFocused()) scheduleBodyBlur();
      });
    },
    onComposition: (active) => {
      composing = active;
      if (!active) scheduleBodyBlur();
    },
    onFinish: () => {
      $("workspace").focus({ preventScroll: true });
      scheduleBodyBlur();
    },
    onSave: save,
    onEscape: () => {
      if (!sourceMode || !bodyEditor || composing) return false;
      surface.model.replace(bodyEditor.before);
      $("source-view").focus({ preventScroll: true });
      scheduleBodyBlur();
      return true;
    },
    onLink: (link) => {
      if (link.path === current && !bodyDirty()) {
        surface.model.jump(link.anchor);
        return;
      }
      if (link.path) openDocument(link.path, link.anchor);
      else if (resolveLink(link.href)?.external) {
        window.open(link.href, "_blank", "noopener,noreferrer");
        commitBody();
      }
    },
  });
  surface.model.setMode(sourceMode);
  if (bookmark) surface.model.restore(bookmark);
}

function beginBody() {
  if (store.busy || view !== "doc" || !bodySurface) return;
  if (bodySurface.owner !== store || bodySurface.version !== store.version || bodySurface.path !== current)
    return;
  if (!bodyEditor) {
    fieldSequence++;
    bodyEditor = { ...bodySurface, before: store.source(current), generation: 0, pending: null };
  }
  bodyEditor.generation++;
}

function closeBody(editor) {
  if (bodyEditor !== editor) return;
  bodyEditor = null;
  fieldSequence++;
  composing = false;
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
    if (store !== editor.owner || store.version !== editor.version)
      throw new Error(
        tr(
          "The source changed. Your text is kept; copy it before reloading.",
          "源码已变化，文本已保留；请复制文本后再重新加载。",
        ),
      );
    const source = editor.model.source;
    if (source === editor.before) {
      closeBody(editor);
      return true;
    }
    const generation = editor.generation,
      payload = capturedSources();
    payload.edits = payload.edits.filter((e) => e.path !== editor.path);
    payload.edits.push({
      path: editor.path,
      field: "source",
      from: store.base.get(editor.path).source,
      to: source,
    });
    editor.pending = (async () => {
      try {
        const result = await request("/preview", payload);
        if (bodyEditor !== editor || generation !== editor.generation) return false;
        if (store !== editor.owner || store.version !== editor.version || store.busy)
          throw new Error(tr("The source changed. Your text is kept.", "源码已变化，文本已保留。"));
        if (!result.ok) throw new Error(result.error);
        if (result.graph.documents[editor.path].source !== source)
          throw new Error("Preview did not preserve the proposed source.");
        const staged = store.set(editor.path, source);
        graph = result.graph;
        closeBody(editor);
        if (staged) changed();
        return true;
      } catch (error) {
        if (bodyEditor === editor) {
          $("reading").setAttribute("aria-invalid", "true");
          status(error.message, true);
        }
        return false;
      } finally {
        editor.pending = null;
        if (bodyEditor === editor && generation !== editor.generation) scheduleBodyBlur();
      }
    })();
    return editor.pending;
  } catch (error) {
    status(error.message, true);
    return false;
  }
}

function bodyFocused() {
  return document.hasFocus() && !!bodySurface?.model.focused;
}

function scheduleBodyBlur() {
  setTimeout(() => {
    if (bodyEditor && !bodyPointerDown && !composing && !bodyFocused()) commitBody();
  }, 0);
}

/* A native field buffer is local, uncommitted input. Apply transforms the captured
   complete source; it never patches a rendered heading or an old graph summary. */
function fieldDirty() {
  return !!fieldEditor && fieldEditor.input.value !== fieldEditor.before;
}

function fieldLabel(field) {
  return { title: tr("Title", "标题"), purpose: tr("Summary", "摘要"), progress: tr("Progress", "进度") }[
    field
  ];
}

async function beginField(path, field, event) {
  if (store.busy || view !== "graph") return;
  let caretOffset = null,
    displayed = null;
  if (event?.detail && field !== "progress") {
    const button = event.target.closest("[data-field]");
    const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const hit = !caret && document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const node = caret?.offsetNode || hit?.startContainer,
      offset = caret?.offset ?? hit?.startOffset;
    if (button && node && button.contains(node)) {
      const range = document.createRange();
      range.selectNodeContents(button);
      range.setEnd(node, offset);
      caretOffset = range.toString().length;
      displayed = button.textContent;
    }
  }
  if (connectMode) return activateCard(path);
  if (fieldEditor?.path === path && fieldEditor.field === field) {
    fieldEditor.input.focus();
    return;
  }
  if (!(await finishEditing())) return;
  const previous = store,
    version = store.version,
    sequence = ++fieldSequence;
  try {
    let doc = graph.documents[path];
    if (!doc || doc.source !== store.source(path)) {
      const result = await request("/preview", capturedSources());
      if (!result.ok) throw new Error(result.error);
      doc = result.graph.documents[path];
    }
    if (
      sequence !== fieldSequence ||
      previous !== store ||
      version !== store.version ||
      store.busy ||
      view !== "graph"
    )
      return;
    if (!doc || doc.error) throw new Error(doc?.error || "Document unavailable");
    const value = field === "title" ? doc.title : (doc.fm[field] ?? "");
    if (typeof value !== "string")
      throw new Error(tr("Open the source to edit this field's format.", "请打开源码修改此字段格式。"));
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
      for (const state of ["", "not-started", "in-progress", "done"])
        input.add(new Option(progressLabel(state), state));
      if (![...input.options].some((option) => option.value === value)) input.add(new Option(value, value));
    }
    input.value = value;
    form.append(input);
    button.replaceWith(form);
    const editor = (fieldEditor = {
      path,
      field,
      input,
      card,
      owner: store,
      version,
      before: input.value,
      generation: 0,
      pending: null,
    });
    card.classList.add("field-active");
    input.addEventListener("input", () => {
      editor.generation++;
      input.removeAttribute("aria-invalid");
      clearPrompt();
      renderChanges(false);
    });
    input.addEventListener("focus", () => {
      editor.generation++;
    });
    input.addEventListener("blur", scheduleFieldBlur);
    if (field === "progress")
      input.addEventListener("change", () => {
        if (!composing) commitField();
      });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!composing) commitField();
    });
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      scheduleFieldBlur();
    });
    input.addEventListener("keydown", (event) => {
      if (event.isComposing || composing) return;
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
    status();
    input.focus();
    if (field !== "progress") {
      const position =
        displayed === value && caretOffset != null ? Math.min(caretOffset, value.length) : value.length;
      input.setSelectionRange(position, position);
    }
  } catch (error) {
    if (sequence === fieldSequence) status(error.message, true);
  }
}

function scheduleFieldBlur() {
  setTimeout(() => {
    if (
      fieldEditor &&
      !bodyPointerDown &&
      !composing &&
      (!document.hasFocus() || document.activeElement !== fieldEditor.input)
    )
      commitField();
  }, 0);
}

function closeField(editor) {
  if (fieldEditor !== editor) return;
  const focused = document.activeElement === editor.input;
  fieldEditor = null;
  fieldSequence++;
  composing = false;
  renderMain();
  renderChanges(false);
  if (focused)
    cardElement(editor.path)?.querySelector(`[data-field="${editor.field}"]`)?.focus({ preventScroll: true });
}

function cancelField() {
  if (!fieldEditor || store.busy) return;
  closeField(fieldEditor);
  status(tr("Field edit cancelled.", "字段修改已取消。"));
}

async function commitField() {
  const editor = fieldEditor;
  if (!editor) return true;
  if (editor.pending) return editor.pending;
  if (composing || store.busy) return false;
  if (!fieldDirty()) {
    closeField(editor);
    return true;
  }
  const value = editor.input.value,
    generation = editor.generation;
  editor.pending = (async () => {
    try {
      if (store !== editor.owner || store.version !== editor.version)
        throw new Error(
          tr(
            "The source changed. Your field text is kept; copy it before cancelling and reopening.",
            "源码已变化，字段文本已保留；请复制文本后取消并重新打开字段。",
          ),
        );
      const result = await request("/preview", {
        ...capturedSources(),
        card: {
          path: editor.path,
          field: editor.field,
          value: editor.field === "progress" && !value ? null : value,
        },
      });
      if (fieldEditor !== editor) return false;
      if (
        store !== editor.owner ||
        store.version !== editor.version ||
        store.busy ||
        generation !== editor.generation
      )
        throw new Error(tr("Editing continued. Your text is kept.", "编辑仍在继续，文本已保留。"));
      if (!result.ok) throw new Error(result.error);
      const staged = store.set(editor.path, result.graph.documents[editor.path].source);
      graph = result.graph;
      closeField(editor);
      if (staged) changed();
      return true;
    } catch (error) {
      if (fieldEditor === editor) {
        editor.input.setAttribute("aria-invalid", "true");
        status(error.message, true);
      }
      return false;
    } finally {
      editor.pending = null;
      if (fieldEditor === editor && generation !== editor.generation) scheduleFieldBlur();
    }
  })();
  return editor.pending;
}

/* Presentation changes keep the same editor, history, source selection and page. */
async function setSourceMode(on) {
  if (store.busy || view !== "doc" || !store.base.has(current)) return;
  const navigation = ++navigationSequence,
    owner = store,
    path = current;
  if (
    !(await finishEditing()) ||
    navigation !== navigationSequence ||
    store !== owner ||
    current !== path ||
    view !== "doc"
  )
    return;
  sourceMode = on;
  bodySurface?.model.setMode(on);
  renderMain();
  renderChanges(false);
}

function bindEditing() {
  document.addEventListener(
    "pointerdown",
    () => {
      bodyPointerDown = true;
    },
    true,
  );
  for (const name of ["pointerup", "pointercancel"])
    document.addEventListener(
      name,
      () => {
        setTimeout(() => {
          bodyPointerDown = false;
          scheduleBodyBlur();
          scheduleFieldBlur();
        }, 0);
      },
      true,
    );
  window.addEventListener("blur", () => {
    bodyPointerDown = false;
    scheduleBodyBlur();
    scheduleFieldBlur();
  });
}
