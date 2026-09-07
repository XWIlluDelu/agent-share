/* A source-backed, continuous Markdown editor. Decorations are disposable views;
   HTML is never serialized into document text. CodeMirror is vendored offline. */
(() => {
  const { EditorState, EditorView, EditorSelection, StateField, StateEffect, Compartment,
    Transaction, Decoration, WidgetType, keymap, history, historyKeymap, defaultKeymap,
    markdown, markdownLanguage, syntaxTree, drawSelection, dropCursor, rectangularSelection,
    syntaxHighlighting, HighlightStyle, tags, undo, redo } = DocDokiCM;
  function format(marker) {
    return view => {
      const length = marker.length, change = view.state.changeByRange(range => {
        const text = view.state.sliceDoc(range.from, range.to);
        const inside = text.length >= 2 * length && text.startsWith(marker) && text.endsWith(marker);
        const outside = view.state.sliceDoc(Math.max(0, range.from - length), range.from) === marker && view.state.sliceDoc(range.to, Math.min(view.state.doc.length, range.to + length)) === marker;
        if (inside) return { changes: [{ from: range.from, to: range.from + length }, { from: range.to - length, to: range.to }], range: EditorSelection.range(range.from, range.to - 2 * length) };
        if (outside) return { changes: [{ from: range.from - length, to: range.from }, { from: range.to, to: range.to + length }], range: EditorSelection.range(range.from - length, range.to - length) };
        return { changes: [{ from: range.from, insert: marker }, { from: range.to, insert: marker }], range: EditorSelection.range(range.from + length, range.to + length) };
      });
      view.dispatch({ ...change, annotations: Transaction.userEvent.of('input.format'), scrollIntoView: true });
      return true;
    };
  }
  const presentation = StateEffect.define(), activity = StateEffect.define(), exactSource = StateEffect.define();
  const display = StateField.define({
    create: () => ({ source: false, focused: false }),
    update(value, tr) {
      for (const effect of tr.effects) {
        if (effect.is(presentation)) value = { ...value, source: effect.value };
        if (effect.is(activity)) value = { ...value, focused: effect.value };
      }
      return value;
    },
  });
  function normalize(source) {
    let text = ''; const offsets = [0];
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\r') { if (source[i + 1] === '\n') i++; text += '\n'; }
      else text += source[i];
      offsets.push(i + 1);
    }
    return { text, offsets };
  }
  function patch(source, changes) {
    const { offsets } = normalize(source), newline = source.includes('\r\n') ? '\r\n' : source.includes('\r') ? '\r' : '\n';
    const edits = [];
    changes.iterChanges((from, to, _a, _b, text) => edits.push([offsets[from], offsets[to], text.toString().replace(/\n/g, newline)]));
    for (const [from, to, text] of edits.reverse()) source = source.slice(0, from) + text + source.slice(to);
    return source;
  }
  function bodyStart(text) { return /^(?:\uFEFF)?---\n[\s\S]*?\n---(?:\n|$)/.exec(text)?.[0].length || 0; }
  function slug(text) { return text.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/\s+/g, '-'); }
  class Glyph extends WidgetType {
    constructor(text, kind = '') { super(); this.text = text; this.kind = kind; }
    eq(other) { return this.text === other.text && this.kind === other.kind; }
    toDOM() { const el = document.createElement('span'); el.className = 'md-glyph ' + this.kind; el.textContent = this.text; el.setAttribute('aria-hidden', 'true'); return el; }
    ignoreEvent() { return false; }
  }
  class TaskBox extends WidgetType {
    constructor(checked, label) { super(); this.checked = checked; this.label = label; }
    eq(other) { return this.checked === other.checked && this.label === other.label; }
    toDOM(view) {
      const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'md-task';
      input.checked = this.checked; input.setAttribute('aria-label', this.label || 'Task');
      input.addEventListener('change', () => {
        const from = view.posAtDOM(input), marker = view.state.sliceDoc(from, from + 3);
        if (!/^\[[ xX]\]$/.test(marker)) return;
        view.dispatch({ changes: { from, to: from + 3, insert: input.checked ? '[x]' : '[ ]' }, selection: { anchor: from + 3 }, annotations: Transaction.userEvent.of('input.task') });
        input.checked = /x/i.test(view.state.sliceDoc(from, from + 3)); view.focus();
      });
      return input;
    }
  }
  function create(options) {
    const raw = StateField.define({ create: () => options.source, update: (value, tr) => {
      for (const effect of tr.effects) if (effect.is(exactSource)) return effect.value;
      return tr.docChanged ? patch(value, tr.changes) : value;
    } });
    const writable = new Compartment(), labels = new Compartment(), highlighting = new Compartment();
    const sourceHighlight = syntaxHighlighting(HighlightStyle.define([
      { tag: tags.heading, color: '#333', fontWeight: 'bold' },
      { tag: [tags.processingInstruction, tags.meta, tags.punctuation], color: '#777' },
      { tag: tags.link, color: '#385943' }, { tag: tags.monospace, color: '#555' },
    ]));
    let editor, destroyed = false, pointerLink = null, restoreSequence = 0;
    const ready = () => !destroyed && options.canEdit();
    function decorations(state) {
      const mode = state.field(display), text = state.doc.toString(), start = bodyStart(text), ranges = [], lines = new Map(), headings = new Map();
      const touched = (from, to) => mode.focused && state.selection.ranges.some(r => r.from <= to && r.to >= from);
      const mark = (from, to, spec) => { if (to > from) ranges.push(Decoration.mark(spec).range(from, to)); };
      const hide = (from, to, block = false, widget) => { if (to > from) ranges.push(Decoration.replace({ block, widget, atomic: true }).range(from, to)); };
      const line = (pos, cls, attributes = {}) => {
        const at = state.doc.lineAt(pos).from, old = lines.get(at) || { class: '' };
        lines.set(at, { ...old, ...attributes, class: old.class + ' ' + cls });
      };
      if (!mode.source && start) { hide(0, start - 1, true); line(start - 1, 'md-hidden-line'); }
      syntaxTree(state).iterate({ enter(node) {
        const { name, from, to } = node;
        if (to <= start) return false;
        const value = text.slice(from, to), active = touched(from, to);
        if (/^(?:ATX|Setext)Heading[1-6]$/.test(name)) {
          const level = name.at(-1), title = value.replace(/^#+\s*|\s*#+$|\n[=-]+$/g, '').replace(/[*_`]/g, ''), key = slug(title);
          const count = headings.get(key) || 0; headings.set(key, count + 1);
          line(from, mode.source ? '' : 'md-heading md-h' + level, { role: 'heading', 'aria-level': level, tabindex: '-1', id: 'heading-' + key + (count ? '-' + count : '') });
        }
        if (mode.source) return;
        if (name === 'HeaderMark') {
          if (!touched(state.doc.lineAt(from).from, state.doc.lineAt(from).to)) {
            let end = to; if (text[end] === ' ') end++;
            hide(from, end);
          } else mark(from, to, { class: 'md-syntax' });
        }
        if (['StrongEmphasis', 'Emphasis', 'Strikethrough', 'InlineCode'].includes(name)) {
          mark(from, to, { class: { StrongEmphasis: 'md-strong', Emphasis: 'md-em', Strikethrough: 'md-strike', InlineCode: 'md-code' }[name] });
          for (let child = node.node.firstChild; child; child = child.nextSibling) {
            if (!/^(EmphasisMark|StrikethroughMark|CodeMark)$/.test(child.name)) continue;
            if (!active) hide(child.from, child.to); else mark(child.from, child.to, { class: 'md-syntax' });
          }
        }
        if (name === 'Link' || name === 'Image' || name === 'Autolink') {
          const children = []; for (let c = node.node.firstChild; c; c = c.nextSibling) children.push(c);
          const url = children.find(c => c.name === 'URL'), marks = children.filter(c => c.name === 'LinkMark');
          if (url && marks.length >= 2) {
            const href = text.slice(url.from, url.to), resolved = options.resolveLink(href), attrs = { title: href };
            if (resolved?.external) Object.assign(attrs, { href: resolved.external, target: '_blank', rel: 'noopener noreferrer' });
            else if (resolved?.path) Object.assign(attrs, { href: '#' + encodeURIComponent(resolved.path), 'data-doc': resolved.path, 'data-anchor': resolved.anchor || '' });
            const labelFrom = name === 'Autolink' ? url.from : marks[0].to, labelTo = name === 'Autolink' ? url.to : marks[1].from;
            mark(labelFrom, labelTo, { tagName: resolved ? 'a' : 'span', class: resolved ? 'md-link' : 'unresolved', attributes: attrs });
            if (!active && labelTo > labelFrom) { hide(from, labelFrom); hide(labelTo, to); return false; }
          }
        }
        if (name === 'FencedCode' || name === 'CodeBlock') {
          for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++) line(state.doc.line(n).from, 'md-code-line');
          if (!active && name === 'FencedCode') {
            const first = state.doc.lineAt(from), last = state.doc.lineAt(to);
            if (last.number > first.number && /^\s*(`{3,}|~{3,})\s*$/.test(last.text)) {
              hide(first.from, first.to); hide(last.from, last.to);
              line(first.from, 'md-hidden-line'); line(last.from, 'md-hidden-line');
            }
          }
          return false;
        }
        if (name === 'Table') {
          for (let row = node.node.firstChild; row; row = row.nextSibling) {
            if (row.name === 'TableDelimiter') { hide(row.from, row.to); line(row.from, 'md-hidden-line'); continue; }
            line(row.from, 'md-table-row' + (row.name === 'TableHeader' ? ' md-table-header' : ''), { role: 'row' });
            const pipes = []; for (let c = row.firstChild; c; c = c.nextSibling) if (c.name === 'TableDelimiter') pipes.push(c);
            const cells = []; let edge = row.from;
            for (const pipe of pipes) { if (pipe.from > edge) cells.push([edge, pipe.from]); hide(pipe.from, pipe.to); edge = pipe.to; }
            if (edge < row.to) cells.push([edge, row.to]);
            for (const [a, b] of cells) mark(a, b, { class: 'md-table-cell', attributes: { role: row.name === 'TableHeader' ? 'columnheader' : 'cell' } });
          }
        }
        if (name === 'ListMark') {
          line(from, 'md-list-line');
          if (!touched(state.doc.lineAt(from).from, state.doc.lineAt(from).to) && /^[-+*]$/.test(value)) hide(from, to, false, new Glyph('•'));
        }
        if (name === 'TaskMarker') hide(from, to, false, new TaskBox(/x/i.test(value), state.doc.lineAt(to).text.slice(to - state.doc.lineAt(to).from).trim()));
        if (name === 'QuoteMark') {
          line(from, 'md-quote-line');
          if (!touched(state.doc.lineAt(from).from, state.doc.lineAt(from).to)) hide(from, to + (text[to] === ' ' ? 1 : 0));
        }
        if (name === 'Entity' && !active) {
          const decoder = document.createElement('textarea'); decoder.innerHTML = value;
          hide(from, to, false, new Glyph(decoder.value));
        }
        if (name === 'Escape' && !active && value.startsWith('\\')) hide(from, from + 1);
        if (name === 'HorizontalRule') {
          if (active) mark(from, to, { class: 'md-syntax' }); else line(from, 'md-rule');
        }
        if (name === 'LinkReference' && !active) { hide(from, to, true); return false; }
      } });
      // Wiki links and reference links keep source spelling while sharing the
      // library resolver. Exclude code and already-decorated ordinary links.
      if (!mode.source && (text.includes('[[') || text.includes(']['))) {
        const tokens = options.markdown.lexer(text.slice(start)), definitions = tokens.links;
        for (const match of text.matchAll(/\[\[([^\]\n]+)\]\]|\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
          const from = match.index, to = from + match[0].length;
          if (from < start) continue;
          let node = syntaxTree(state).resolveInner(from + 1, 1), code = false;
          for (; node; node = node.parent) if (/Code|HTML/.test(node.name)) code = true;
          if (code) continue;
          const parts = match[1]?.split('|'), target = parts ? 'wiki:' + parts[0] : definitions[(match[3] || match[2]).toLowerCase().replace(/\s+/g, ' ')]?.href;
          if (!target) continue;
          const resolved = options.resolveLink(target); if (!resolved) continue;
          const label = parts ? parts[1] || parts[0] : match[2], labelFrom = from + (parts ? parts.length > 1 ? 3 + parts[0].length : 2 : 1);
          const attrs = { title: target, href: resolved.external || '#' + encodeURIComponent(resolved.path) };
          if (resolved.path) Object.assign(attrs, { 'data-doc': resolved.path, 'data-anchor': resolved.anchor || '' });
          else Object.assign(attrs, { target: '_blank', rel: 'noopener noreferrer' });
          mark(labelFrom, labelFrom + label.length, { tagName: 'a', class: 'md-link', attributes: attrs });
          if (!touched(from, to)) { hide(from, labelFrom); hide(labelFrom + label.length, to); }
        }
      }
      for (const [at, attributes] of lines) ranges.push(Decoration.line({ attributes }).range(at));
      return Decoration.set(ranges, true);
    }
    const decorated = StateField.define({ create: decorations, update: (value, tr) => {
      if (!tr.docChanged && !tr.selection && tr.state.field(display) === tr.startState.field(display) && syntaxTree(tr.state) === syntaxTree(tr.startState)) return value;
      return decorations(tr.state);
    }, provide: field => EditorView.decorations.from(field) });
    const attributes = () => EditorView.contentAttributes.of({ id: 'source', 'aria-label': options.label(), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' });
    const extensions = [raw, display, markdown({ base: markdownLanguage, completeHTMLTags: false }),
      history(), drawSelection(), dropCursor(), rectangularSelection(), EditorView.lineWrapping,
      keymap.of([{ key: 'Mod-b', run: format('**') }, { key: 'Mod-i', run: format('*') }, { key: 'Mod-`', run: format('`') },
        { key: 'Mod-s', run: () => { options.onSave(); return true; } },
        { key: 'Mod-Enter', run: () => { options.onFinish(); return true; } },
        { key: 'Escape', run: () => options.onEscape() }, ...historyKeymap, ...defaultKeymap]),
      writable.of([EditorState.readOnly.of(!ready()), EditorView.editable.of(ready())]), labels.of(attributes()),
      highlighting.of([]), decorated,
      EditorView.atomicRanges.of(view => view.state.field(decorated).update({ filter: (_a, _b, value) => !!value.spec.atomic })),
      EditorView.domEventHandlers({
        focus: () => { options.onFocus(); queueMicrotask(() => { if (!destroyed) editor.dispatch({ effects: activity.of(true) }); }); },
        blur: () => { queueMicrotask(() => { if (!destroyed) editor.dispatch({ effects: activity.of(false) }); }); options.onBlur(); },
        compositionstart: () => options.onComposition(true), compositionend: () => options.onComposition(false),
        wheel() { restoreSequence++; },
        pointerdown(event) {
          restoreSequence++;
          const a = event.target.closest('a');
          pointerLink = a ? { x: event.clientX, y: event.clientY, href: a.getAttribute('href'), path: a.dataset.doc, anchor: a.dataset.anchor || '' } : null;
        },
        pointerup(event) {
          const link = pointerLink; pointerLink = null;
          if (!link || Math.hypot(event.clientX - link.x, event.clientY - link.y) > 4) return;
          setTimeout(() => { if (!destroyed && editor.state.selection.main.empty) options.onLink(link); }, 0);
        },
        click(event) { if (event.target.closest('a')) { event.preventDefault(); return true; } },
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged || update.selectionSet) restoreSequence++;
        if (update.docChanged) options.onChange();
      }),
      EditorState.transactionFilter.of(tr => {
        if (tr.docChanged && !ready()) return [];
        if (tr.state.field(display).source) return tr;
        const start = bodyStart(tr.startState.doc.toString());
        let protectedChange = false;
        tr.changes.iterChangedRanges(from => { if (from < start) protectedChange = true; });
        if (protectedChange) return [];
        const ranges = tr.newSelection.ranges.map(r => EditorSelection.range(Math.max(start, r.anchor), Math.max(start, r.head)));
        return ranges.some((r, i) => !r.eq(tr.newSelection.ranges[i])) ? [tr, { selection: EditorSelection.create(ranges, tr.newSelection.mainIndex) }] : tr;
      }),
    ];
    const start = bodyStart(normalize(options.source).text);
    editor = new EditorView({ parent: options.parent, state: EditorState.create({ doc: normalize(options.source).text, selection: { anchor: start }, extensions }) });
    const api = {
      view: editor,
      get source() { return editor.state.field(raw); },
      get focused() { return editor.hasFocus; },
      get composing() { return editor.composing; },
      setReadOnly() { editor.dispatch({ effects: writable.reconfigure([EditorState.readOnly.of(!ready()), EditorView.editable.of(ready())]) }); },
      localize() { editor.dispatch({ effects: labels.reconfigure(attributes()) }); },
      bookmark() {
        const workspace = options.parent.closest('.workspace'), bar = document.querySelector('.source-bar').getBoundingClientRect();
        const box = editor.contentDOM.getBoundingClientRect(), y = Math.max(box.top, bar.bottom + 18);
        const pos = editor.posAtCoords({ x: box.left + 24, y }, false) ?? editor.state.selection.main.head;
        return { pos, top: editor.coordsAtPos(pos)?.top, scroll: workspace.scrollTop, selection: editor.state.selection };
      },
      restore(mark) {
        const workspace = options.parent.closest('.workspace'), sequence = ++restoreSequence;
        // Let CodeMirror finish its own height/scroll stabilization first. A
        // newer selection, edit or restoration invalidates this camera request.
        editor.requestMeasure({ read: () => null, write: () => requestAnimationFrame(() => {
          if (destroyed || sequence !== restoreSequence) return;
          const top = editor.coordsAtPos(Math.min(mark.pos, editor.state.doc.length))?.top;
          if (top != null && mark.top != null) workspace.scrollTop += top - mark.top;
          else workspace.scrollTop = mark.scroll;
        }) });
      },
      setMode(source) {
        const mark = api.bookmark(), start = bodyStart(editor.state.doc.toString()), selection = editor.state.selection.main;
        options.parent.classList.toggle('is-source', source);
        editor.dispatch({ effects: [presentation.of(source), highlighting.reconfigure(source ? sourceHighlight : [])], ...(!source && selection.head < start ? { selection: { anchor: start } } : {}) });
        api.restore(mark);
      },
      focus(anchor) {
        if (anchor != null) editor.dispatch({ selection: { anchor: Math.max(0, Math.min(anchor, editor.state.doc.length)) } });
        editor.focus();
      },
      jump(anchor) {
        const text = editor.state.doc.toString(), start = bodyStart(text), seen = new Map(); let target = null;
        syntaxTree(editor.state).iterate({ enter(node) {
          if (node.to <= start || /^(FencedCode|CodeBlock)$/.test(node.name)) return false;
          if (!/^(ATX|Setext)Heading[1-6]$/.test(node.name)) return;
          const key = slug(text.slice(node.from, node.to).replace(/^#+\s*|\s*#+$|\n[=-]+$/g, '').replace(/[*_`]/g, ''));
          const count = seen.get(key) || 0; seen.set(key, count + 1);
          if (key + (count ? '-' + count : '') === slug(anchor)) target = node.from;
        } });
        if (target == null) return false;
        restoreSequence++;
        const margin = document.querySelector('.source-bar').getBoundingClientRect().height + 18;
        editor.dispatch({ effects: EditorView.scrollIntoView(target, { y: 'start', yMargin: margin }) });
        return true;
      },
      replace(source) { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: normalize(source).text }, effects: exactSource.of(source) }); },
      undo() { return undo(editor); }, redo() { return redo(editor); },
      destroy() { destroyed = true; editor.destroy(); },
    };
    return api;
  }
  globalThis.DocDokiBody = { create, normalize, patch, bodyStart };
})();
