/* Presentation ink.
   Page and evidence strokes are anchored to rendered text — target id, character offset and quoted context —
   and measured in em from that character, so they follow their words through reflow. Image strokes are
   relative to the image. Strokes whose target vanished, whose quoted text no longer matches, or whose image
   changed shape are kept as unattached marks that can be reattached or discarded. */
window.createAnnotations = function ({dialog, viewport, image, getView, onEnable, evidence = null}) {
  const NS = 'http://www.w3.org/2000/svg';
  const QUOTE = 24;
  const BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,dt,dd,td,th,caption,figcaption,blockquote,pre,summary,.math-display,.ev-note';
  const SCROLLER = '.math-display,.table-responsive,.code-block';
  const HIDDEN = {hidden:true};
  const main = document.querySelector('main');
  const report = document.querySelector('meta[name="annotation-report"]').content;
  const strokes = [], history = [];
  let enabled = false, erasing = false, color = '#c73e37', active = null, frame = 0, sequence = 0;
  let files = new AnnotationFiles(report, update);
  let readOnly = !!navigator.locks, preparing = false, documentBusy = false, restore = Promise.resolve();
  let orphans = [], placing = null;
  const controls = [];
  const keyFor = img => {
    const url = new URL(img.dataset.full || img.currentSrc || img.src, location.href);
    const base = new URL('.', location.href).href;
    return url.href.startsWith(base) ? url.href.slice(base.length) : url.href;
  };
  const figures = () => [...document.querySelectorAll('main .figure-open img, #evidence .figure-open img')];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* Text indexes are rebuilt only after the page or evidence DOM changes. */
  let indexes = new Map(), sizes = new Map();
  const indexFor = root => { let i = indexes.get(root); if (!i) indexes.set(root, i = new TextIndex(root)); return i; };
  const fontSize = el => {
    let v = sizes.get(el);
    if (v === undefined) sizes.set(el, v = parseFloat(getComputedStyle(el).fontSize) || 16);
    return v;
  };
  const watcher = new MutationObserver(() => {
    indexes = new Map();
    strokes.forEach(s => { s.found = undefined; });
    schedule();
  });
  for (const el of [main, evidence]) if (el) watcher.observe(el, {childList:true, subtree:true, characterData:true});

  function rootFor(s) {
    const host = s.surface === 'evidence' ? evidence : main;
    if (!host) return null;
    if (s.surface === 'page' && s.target === '') return main;
    const el = document.getElementById(s.target);
    return el && host.contains(el) ? el : null;
  }
  /* Screen origin and em of a text stroke; null when unattached, HIDDEN when its text is not rendered. */
  function origin(s) {
    const root = rootFor(s);
    if (!root) return null;
    const index = indexFor(root), n = index.text.length;
    if (s.found === undefined) s.found = index.find(s.anchor);
    if (s.found < 0) return null;
    let x, y, el;
    if (!n) {
      const r = root.getBoundingClientRect();
      if (!r.width && !r.height) return HIDDEN;
      x = r.left; y = r.top; el = root;
    } else {
      const unit = Math.min(s.found, n - 1), r = index.rect(unit);
      el = index.element(unit);
      // Closed <details> keep layout boxes under content-visibility, so rects alone are not enough.
      if (!r || el.checkVisibility?.() === false) return HIDDEN;
      x = s.found >= n ? r.right : r.left; y = r.top;
    }
    if (s.anchor.side) {
      const block = el.closest(BLOCK), b = (block && root.contains(block) ? block : root).getBoundingClientRect();
      x = s.anchor.side === 'left' ? b.left : b.right;
    }
    const em = fontSize(el), r = root.getBoundingClientRect();
    return {x, y, em, el, at:[(x - r.left) / em, (y - r.top) / em]};
  }
  /* Image elements showing a stroke's image; null when unattached, HIDDEN while loading. */
  function imagesFor(s) {
    const list = figures().filter(img => keyFor(img) === s.target);
    if (!list.length) return null;
    const img = list.find(i => i.naturalWidth);
    if (!img) return list.every(i => i.complete) ? null : HIDDEN;
    const ratio = s.size[0] / s.size[1];
    return Math.abs(img.naturalWidth / img.naturalHeight - ratio) > ratio * .01 ? null : list;
  }

  function layer(parent, name) {
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('ink-layer', name);
    svg.setAttribute('aria-hidden', 'true');
    parent.append(svg);
    return svg;
  }
  const page = layer(document.body, 'ink-page');
  const side = evidence ? layer(document.body, 'ink-evidence') : null;
  const viewer = layer(viewport, 'ink-viewer');
  const ghost = layer(document.body, 'ink-ghost');
  const layers = [page, side, ghost].filter(Boolean);
  function withoutLayers(fn) {
    const saved = layers.map(l => l.style.pointerEvents);
    layers.forEach(l => { l.style.pointerEvents = 'none'; });
    try { return fn(); } finally { layers.forEach((l, i) => { l.style.pointerEvents = saved[i]; }); }
  }
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      return p && {node:p.offsetNode, offset:p.offset};
    }
    const r = document.caretRangeFromPoint?.(x, y);
    return r && {node:r.startContainer, offset:r.startOffset};
  }
  function nearest(elements, y) {
    let best = null, distance = Infinity, height = Infinity;
    for (const el of elements) {
      const r = el.getBoundingClientRect();
      if (!r.height) continue;
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < distance || d === distance && r.height < height) { best = el; distance = d; height = r.height; }
    }
    return best;
  }
  const elementOf = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  /* Text anchor for a screen point. Points beside a block anchor to its edge on that line. */
  function locate(x, y, surface) {
    return withoutLayers(() => {
      const host = surface === 'evidence' ? evidence : main;
      if (!host) return null;
      const target = document.elementFromPoint(x, y);
      let caret = caretAt(x, y), root = null;
      if (surface === 'evidence') {
        root = target?.closest('.ev-item')?.querySelector('.ev-note') || nearest(host.querySelectorAll('.ev-note'), y);
        if (!root) return null;
      }
      const scope = root || main;
      if (caret && !scope.contains(caret.node)) caret = null;
      let block = caret && elementOf(caret.node)?.closest(BLOCK);
      if (!block || !scope.contains(block)) block = nearest(scope.querySelectorAll(BLOCK), y) || scope;
      const b = block.getBoundingClientRect();
      const edge = x < b.left ? 'left' : x > b.right ? 'right' : undefined;
      if (!caret || edge || !block.contains(caret.node)) {
        caret = caretAt(clamp(x, b.left + 1, b.right - 1), clamp(y, b.top + 1, b.bottom - 1));
        if (caret && !block.contains(caret.node)) caret = null;
      }
      if (!root) {
        root = main;
        for (let el = block; el && el !== main; el = el.parentElement) if (el.id) { root = el; break; }
      }
      const index = indexFor(root);
      let offset = caret ? index.indexOf(caret.node, caret.offset) : index.indexOf(block, 0);
      if (index.text[offset] === ' ' && offset + 1 < index.text.length) offset++;
      const anchor = {offset, prefix:index.text.slice(Math.max(0, offset - QUOTE), offset), suffix:index.text.slice(offset, offset + QUOTE)};
      if (edge) anchor.side = edge;
      return {kind:'text', surface, target:root === main ? '' : root.id, anchor};
    });
  }
  const surfaceAt = (x, y) => withoutLayers(() => evidence?.contains(document.elementFromPoint(x, y)) ? 'evidence' : 'page');

  /* Serialization groups strokes by surface and target. */
  const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  function snapshot() {
    const data = AnnotationFiles.empty();
    for (const s of strokes) {
      const points = s.points.map(p => p.map(v => round(v, 4)));
      if (s.kind === 'image') (data.images[s.target] ||= []).push({size:[...s.size], color:s.color, width:round(s.width, 6), points});
      else (data[s.surface][s.target] ||= []).push({anchor:{...s.anchor}, at:s.at.map(v => round(v, 3)), color:s.color, width:round(s.width, 4), points});
    }
    return data;
  }
  function save() { if (files.current && !readOnly) files.update(snapshot()); }
  function loadRecord(record) {
    strokes.length = 0; history.length = 0; sequence = 0;
    const copy = s => ({color:s.color, width:s.width, points:s.points.map(p => [...p]), order:sequence++});
    if (record) {
      for (const surface of ['page', 'evidence'])
        for (const [target, list] of Object.entries(record[surface]))
          for (const s of list) strokes.push({kind:'text', surface, target, anchor:{...s.anchor}, at:[...s.at], ...copy(s)});
      for (const [target, list] of Object.entries(record.images))
        for (const s of list) strokes.push({kind:'image', target, size:[...s.size], ...copy(s)});
    }
    render(); update();
  }
  async function changeDocument(operation) {
    finish(); documentBusy = true; update();
    try { loadRecord(await operation()); }
    catch (error) { if (error.name !== 'AbortError') alert(error.message); }
    finally { documentBusy = false; update(); }
  }
  /* One editing tab per report; others show the ink read-only until the lock frees. */
  function acquire() {
    readOnly = false;
    files = new AnnotationFiles(report, update);
    restore = files.connect(false).then(loadRecord).catch(() => loadRecord(files.current?.record || null));
    update();
  }
  if (navigator.locks) {
    navigator.locks.request('report-annotations:' + report, () => { acquire(); return new Promise(() => {}); });
    window.addEventListener('storage', e => {
      if (!readOnly || e.key !== files.storageKey) return;
      files = new AnnotationFiles(report, update);
      loadRecord(files.current?.record || null);
    });
  }

  const icons = {
    pen: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
    eraser: '<path d="m14 3 7 7-11 11H5l-4-4zM8 10l7 7M10 21h11"/>',
    undo: '<path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" transform="translate(0 -2)"/>',
    previous: '<path d="m14 5-7 7 7 7"/>',
    next: '<path d="m10 5 7 7-7 7"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    clear: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7M14 10v7"/>'
  };
  function button(name, label) {
    const b = document.createElement('button');
    b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';
    return b;
  }
  const isOrphan = s => orphans.includes(s);
  function inContext(s) { return !dialog.open || s.kind === 'image' && s.target === keyFor(image); }
  function currentStrokes() { return strokes.filter(s => inContext(s) && !isOrphan(s)); }
  function update() {
    const empty = currentStrokes().length === 0, locked = readOnly || documentBusy;
    controls.forEach(c => {
      c.pen.disabled = preparing || locked;
      c.pen.title = readOnly ? 'Annotations are being edited in another tab' : 'Draw annotations';
      c.pen.setAttribute('aria-pressed', String(enabled && !erasing));
      c.previous.disabled = locked || !files.neighbor(-1);
      c.next.disabled = locked || !files.neighbor(1);
      c.more.disabled = documentBusy;
      c.more.dataset.state = files.state === 'error' ? 'error' : '';
      c.fileName.textContent = (files.current?.record.name || 'No annotations') + (readOnly ? ' · read-only' : '');
      c.newButton.disabled = c.importButton.disabled = readOnly;
      c.saveButton.disabled = readOnly || !files.current;
      c.exportButton.disabled = !files.current;
      c.orphanButton.hidden = !orphans.length;
      c.orphanButton.disabled = readOnly;
      c.orphanButton.textContent = 'Unattached marks (' + orphans.length + ')';
      c.error.textContent = files.state === 'error' ? files.message : '';
      c.error.hidden = files.state !== 'error';
      c.eraser.setAttribute('aria-pressed', String(enabled && erasing));
      c.tools.hidden = !enabled;
      c.clear.disabled = empty;
      c.undo.disabled = !history.some(op => [...op.added, ...op.removed].some(inContext));
      c.colors.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === color)));
    });
    for (const svg of [page, side]) svg?.classList.toggle('drawing-enabled', enabled && !dialog.open && !placing);
    viewer.classList.toggle('drawing-enabled', enabled && dialog.open);
    [page, side, viewer].forEach(svg => svg?.classList.toggle('erasing', enabled && erasing));
  }
  function finish() {
    if (!active) return;
    const {layer: svg, id, stroke, removed} = active;
    if (stroke) history.push({added:[stroke], removed:[]});
    if (removed?.length) history.push({added:[], removed});
    active = null;
    if (stroke || removed?.length) save();
    if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id);
    update();
  }
  async function setEnabled(value) {
    finish();
    if (value) {
      if (preparing || readOnly) return;
      preparing = true; update();
      try { await restore; }
      catch (error) {
        if (error.name !== 'AbortError') alert(error.message);
        return;
      } finally { preparing = false; update(); }
    }
    enabled = value;
    if (value) onEnable();
    if (!value) controls.forEach(c => { if (c.menu.matches(':popover-open')) c.menu.hidePopover(); });
    update();
  }
  function replace(removed, added) {
    for (const s of removed) { const i = strokes.indexOf(s); if (i >= 0) strokes.splice(i, 1); }
    strokes.push(...added);
    strokes.sort((a, b) => a.order - b.order);
  }

  /* Unattached marks: grouped by former target, previewed, reattached by clicking, or discarded. */
  const orphanDialog = document.createElement('dialog');
  orphanDialog.className = 'ink-orphans';
  orphanDialog.setAttribute('aria-labelledby', 'ink-orphans-title');
  orphanDialog.innerHTML = '<div class="ink-orphans-head"><h2 id="ink-orphans-title">Unattached marks</h2>' +
    '<button type="button" class="icon-button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
    '<p class="ink-orphans-note">Their text, evidence or image changed. Reattach, then click where the group belongs.</p><ul></ul>';
  document.body.append(orphanDialog);
  orphanDialog.querySelector('.ink-orphans-head button').onclick = () => orphanDialog.close();
  const groupKey = s => s.kind === 'image' ? 'images\0' + s.target : s.surface + '\0' + s.target;
  function groups() {
    const map = new Map();
    for (const s of orphans) { const k = groupKey(s); map.has(k) ? map.get(k).push(s) : map.set(k, [s]); }
    return [...map.values()];
  }
  /* Group geometry in a shared unit space: em from the target for text, pixels of the image for images. */
  const shape = s => s.kind === 'image' ? s.points.map(([x, y]) => [x * s.size[0], y * s.size[1]]) : s.points.map(([x, y]) => [s.at[0] + x, s.at[1] + y]);
  function bounds(group) {
    const all = group.flatMap(shape);
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    return {x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs) - Math.min(...xs), h:Math.max(...ys) - Math.min(...ys)};
  }
  function label(group) {
    const s = group[0];
    if (s.kind === 'image') return 'Image · ' + s.target.split('/').pop();
    if (s.surface === 'evidence') return 'Evidence · ' + s.target;
    // Whole words around the anchor: the last words of the prefix and the first of the suffix.
    const before = s.anchor.prefix.split(' ').slice(1).slice(-3).join(' '), after = s.anchor.suffix.split(' ').slice(0, -1).slice(0, 3).join(' ');
    const text = [before, after].filter(Boolean).join(s.anchor.prefix.endsWith(' ') ? ' ' : '').replace(/\uFFFC/g, '\u2026');
    return 'Text · “' + text + '”';
  }
  function showOrphans() {
    const list = orphanDialog.querySelector('ul');
    list.replaceChildren();
    for (const group of groups()) {
      const li = document.createElement('li');
      const box = bounds(group), scale = Math.min(150 / Math.max(box.w, 1e-6), 56 / Math.max(box.h, 1e-6), 24);
      const dx = (150 - box.w * scale) / 2, dy = (56 - box.h * scale) / 2;
      const preview = document.createElementNS(NS, 'svg');
      preview.setAttribute('viewBox', '-6 -6 162 68'); preview.classList.add('ink-orphan-preview');
      for (const s of group) path(preview, s, shape(s).map(([x, y]) => [dx + (x - box.x) * scale, dy + (y - box.y) * scale]), 2);
      const text = document.createElement('div'); text.className = 'ink-orphan-label';
      text.textContent = label(group);
      const count = document.createElement('div'); count.className = 'ink-orphan-count';
      count.textContent = group.length + (group.length === 1 ? ' stroke' : ' strokes');
      const reattach = document.createElement('button'); reattach.type = 'button'; reattach.textContent = 'Reattach';
      reattach.onclick = () => { orphanDialog.close(); startPlacing(group); };
      const discard = document.createElement('button'); discard.type = 'button'; discard.textContent = 'Discard';
      discard.onclick = () => {
        history.push({added:[], removed:group}); replace(group, []);
        save(); render(); update();
        if (orphans.length) showOrphans(); else orphanDialog.close();
      };
      const actions = document.createElement('div'); actions.className = 'ink-orphan-actions';
      actions.append(reattach, discard);
      const info = document.createElement('div'); info.append(text, count);
      li.append(preview, info, actions);
      list.append(li);
    }
    if (!orphanDialog.open) orphanDialog.showModal();
  }
  function startPlacing(group) {
    finish();
    placing = {group, x:0, y:0};
    ghost.classList.add('placing');
    update();
  }
  function stopPlacing() {
    placing = null;
    ghost.classList.remove('placing');
    ghost.replaceChildren();
    update();
  }
  function placement(x, y) {
    const {group} = placing;
    if (group[0].kind === 'image') {
      const img = withoutLayers(() => document.elementFromPoint(x, y)?.closest('.figure-open')?.querySelector('img'));
      if (!img?.naturalWidth || !(main.contains(img) || evidence?.contains(img))) return null;
      const r = img.getBoundingClientRect();
      return {img, preview:group.map(s => s.points.map(([px, py]) => [r.left + px * r.width, r.top + py * r.height])), widths:group.map(s => s.width * r.width)};
    }
    const surface = surfaceAt(x, y);
    const hit = withoutLayers(() => document.elementFromPoint(x, y));
    const em = fontSize(hit?.closest(BLOCK) || main), box = bounds(group);
    return {surface, em, preview:group.map(s => shape(s).map(([px, py]) => [x + (px - box.x) * em, y + (py - box.y) * em])), widths:group.map(s => s.width * em)};
  }
  function drawGhost(x, y) {
    ghost.replaceChildren();
    const p = placing && placement(x, y);
    ghost.classList.toggle('invalid', !p);
    if (p) placing.group.forEach((s, i) => path(ghost, s, p.preview[i], p.widths[i]));
  }
  function place(x, y) {
    const p = placement(x, y);
    if (!p) return;
    const {group} = placing, added = [];
    for (const [i, s] of group.entries()) {
      let next;
      if (p.img) next = {...s, target:keyFor(p.img), size:[p.img.naturalWidth, p.img.naturalHeight], order:sequence++};
      else {
        const [x0, y0] = p.preview[i][0];
        const located = locate(x0, y0, p.surface);
        if (!located) return;
        next = {...located, color:s.color, order:sequence++};
        const o = origin(next);
        if (!o || o.hidden) return;
        next.points = p.preview[i].map(([px, py]) => [(px - o.x) / o.em, (py - o.y) / o.em]);
        next.width = p.widths[i] / o.em;
        next.at = o.at;
      }
      added.push(next);
    }
    history.push({added, removed:group});
    replace(group, added);
    stopPlacing(); save(); render(); update();
  }
  ghost.addEventListener('pointermove', e => { if (placing) drawGhost(e.clientX, e.clientY); });
  ghost.addEventListener('pointerdown', e => {
    if (!placing || e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    place(e.clientX, e.clientY);
  });
  ghost.addEventListener('click', e => e.stopPropagation());

  for (const host of [document.querySelector('.toolbar'), dialog.querySelector('.viewer-bar')]) {
    const pen = button('pen', 'Draw annotations');
    pen.className = 'pen-button icon-button';
    const tools = document.createElement('span');
    tools.className = 'ink-tools'; tools.hidden = true;
    tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Annotation tools');
    const colors = [['#c73e37','Red'],['#326fb0','Blue'],['#303b45','Charcoal']].map(([value,name]) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'ink-color'; b.dataset.color = value;
      b.title = name; b.setAttribute('aria-label', name + ' ink');
      b.style.setProperty('--ink-color', value);
      b.onclick = () => { finish(); color = value; erasing = false; update(); };
      tools.append(b); return b;
    });
    const eraser = button('eraser', 'Erase strokes');
    eraser.onclick = () => { finish(); erasing = !erasing; update(); };
    const undo = button('undo', 'Undo stroke'), clear = button('clear', 'Clear annotations');
    undo.onclick = () => {
      finish();
      const index = history.findLastIndex(op => [...op.added, ...op.removed].some(inContext));
      if (index >= 0) {
        const op = history[index], added = op.added.filter(inContext), removed = op.removed.filter(inContext);
        replace(added, removed);
        op.added = op.added.filter(s => !added.includes(s));
        op.removed = op.removed.filter(s => !removed.includes(s));
        if (!op.added.length && !op.removed.length) history.splice(index, 1);
      }
      save(); render(); update();
    };
    clear.onclick = () => {
      finish();
      const items = currentStrokes();
      if (items.length) history.push({added:[], removed:items});
      replace(items, []);
      save(); render(); update();
    };
    const previous = button('previous', 'Previous annotations'), next = button('next', 'Next annotations');
    previous.onclick = () => changeDocument(() => files.move(-1));
    next.onclick = () => changeDocument(() => files.move(1));
    const more = button('more', 'Annotation files');
    more.className = 'ink-more';
    more.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'ink-menu'; menu.popover = 'auto';
    menu.setAttribute('aria-label', 'Annotation files');
    const fileName = document.createElement('div');
    fileName.className = 'ink-file-name';
    menu.append(fileName);
    for (const [control, text] of [[previous, 'Previous annotations'], [next, 'Next annotations']]) {
      control.textContent = text;
      control.addEventListener('click', () => menu.hidePopover());
      menu.append(control);
    }
    const action = (text, fn) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
      b.onclick = () => { menu.hidePopover(); fn(); };
      menu.append(b); return b;
    };
    const newButton = action('New', () => changeDocument(() => files.create()));
    const input = document.createElement('input'); input.type = 'file';
    input.accept = '.json,application/json'; input.hidden = true;
    input.onchange = () => {
      const file = input.files[0]; input.value = '';
      if (file) changeDocument(() => files.import(file));
    };
    const importButton = action('Import…', () => input.click());
    const saveButton = action('Save', async () => {
      documentBusy = true; update();
      try { await files.saveToFile(); }
      catch { /* Non-cancelled failures are displayed beside the annotation tools. */ }
      finally { documentBusy = false; update(); }
    });
    const exportButton = action('Export JSON', () => { finish(); files.export(); });
    const orphanButton = action('Unattached marks', () => { finish(); if (dialog.open) dialog.close(); showOrphans(); });
    menu.append(input);
    host.append(menu);
    more.onclick = () => {
      finish();
      if (menu.matches(':popover-open')) { menu.hidePopover(); return; }
      menu.showPopover();
      const rect = more.getBoundingClientRect();
      menu.style.left = Math.max(12, Math.min(rect.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 12)) + 'px';
      menu.style.top = Math.max(12, Math.min(rect.bottom + 8, innerHeight - menu.offsetHeight - 12)) + 'px';
    };
    menu.addEventListener('toggle', () => more.setAttribute('aria-expanded', String(menu.matches(':popover-open'))));
    const error = document.createElement('span'); error.className = 'ink-file-error';
    error.setAttribute('role','alert'); error.hidden = true;
    tools.append(eraser,undo,clear,more,error);
    pen.onclick = () => {
      if (enabled && erasing) { finish(); erasing=false; update(); }
      else { erasing=false; setEnabled(!enabled); }
    };
    if (dialog.contains(host)) {
      const close = document.getElementById('close-viewer');
      host.insertBefore(pen,close); host.insertBefore(tools,close);
    } else host.append(pen,tools);
    controls.push({pen,tools,eraser,undo,clear,colors,previous,next,more,menu,fileName,newButton,importButton,saveButton,exportButton,orphanButton,error});
  }

  function imageRect() {
    const v = getView();
    if (!image.complete || !image.naturalWidth) return null;
    return {left:v.x,top:v.y,width:image.naturalWidth*v.scale,height:image.naturalHeight*v.scale};
  }
  function path(svg, stroke, points, width, clip) {
    if (!points.length || !(width > 0)) return;
    const el = document.createElementNS(NS,'path');
    const xy = p => p.map(v=>v.toFixed(2)).join(' ');
    let d = 'M' + xy(points[0]);
    if (points.length === 1) d += ' l0.01 0';
    else if (points.length === 2) d += ' L' + xy(points[1]);
    else {
      // Midpoint quadratic smoothing rounds sampling corners without overshoot.
      for (let i=1;i<points.length-1;i++) {
        const midpoint=points[i].map((v,j)=>(v+points[i+1][j])/2);
        d += ' Q' + xy(points[i]) + ' ' + xy(midpoint);
      }
      d += ' L' + xy(points.at(-1));
    }
    el.setAttribute('d',d); el.setAttribute('stroke',stroke.color);
    el.setAttribute('stroke-width',String(width));
    if (clip) el.setAttribute('clip-path', 'url(#' + clip + ')');
    el.inkStroke = stroke;
    svg.append(el);
  }
  function renderViewer() {
    viewer.replaceChildren();
    if (!dialog.open) return;
    const key = keyFor(image), rect = imageRect();
    if (!rect) return;
    strokes.filter(s => s.kind === 'image' && s.target === key && !isOrphan(s)).forEach(s =>
      path(viewer, s, s.points.map(p => [rect.left + p[0] * rect.width, rect.top + p[1] * rect.height]), s.width * rect.width));
  }
  /* Strokes inside horizontally scrolling blocks are clipped to them and follow their scroll. */
  function clipper(svg, offset) {
    const defs = document.createElementNS(NS, 'defs'), ids = new Map();
    svg.append(defs);
    return element => {
      if (!element) return null;
      if (!ids.has(element)) {
        const id = svg.classList[1] + '-clip-' + ids.size, r = element.getBoundingClientRect();
        const clip = document.createElementNS(NS, 'clipPath'), rect = document.createElementNS(NS, 'rect');
        clip.id = id;
        Object.entries({x:r.left - offset.left, y:r.top - offset.top, width:r.width, height:r.height}).forEach(([k, v]) => rect.setAttribute(k, v));
        clip.append(rect); defs.append(clip); ids.set(element, id);
      }
      return ids.get(element);
    };
  }
  function render() {
    sizes = new Map();
    const targets = new Map();
    for (const svg of [page, side].filter(Boolean)) {
      svg.replaceChildren();
      const offset = svg === page ? {left:0, top:0} : svg.getBoundingClientRect();
      targets.set(svg, {offset, clip:clipper(svg, offset)});
    }
    const draw = (svg, s, points, width, scroller) => {
      const t = targets.get(svg);
      if (t) path(svg, s, points.map(([x, y]) => [x - t.offset.left, y - t.offset.top]), width, t.clip(scroller));
    };
    const lost = [];
    for (const s of strokes) {
      if (s.kind === 'image') {
        const list = imagesFor(s);
        if (!list) { lost.push(s); continue; }
        if (list === HIDDEN) continue;
        for (const img of list) {
          const r = img.getBoundingClientRect();
          if (r.width) draw(evidence?.contains(img) ? side : page, s, s.points.map(p => [r.left + p[0] * r.width, r.top + p[1] * r.height]), s.width * r.width);
        }
      } else {
        const o = origin(s);
        if (!o) { lost.push(s); continue; }
        if (o.hidden) continue;
        s.at = o.at;
        const scroller = o.el.closest(SCROLLER);
        draw(s.surface === 'evidence' ? side : page, s, s.points.map(p => [o.x + p[0] * o.em, o.y + p[1] * o.em]), s.width * o.em, scroller);
      }
    }
    renderViewer();
    const changed = lost.length !== orphans.length || lost.some((s, i) => s !== orphans[i]);
    orphans = lost;
    const inked = new Set(strokes.filter(s => s.surface === 'evidence' && !isOrphan(s)).map(s => s.target));
    document.querySelectorAll('a.ev-ref[href^="#"]').forEach(a => a.classList.toggle('has-ink', inked.has(decodeURIComponent(a.hash.slice(1)))));
    if (changed) update();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(()=>{ frame=0; render(); });
  }
  function eraseAt(e) {
    const svg=active.layer, r=svg.getBoundingClientRect();
    const end=[e.clientX-r.left,e.clientY-r.top], start=active.last || end;
    const steps=Math.max(1,Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])/6));
    for (const p of [...svg.querySelectorAll('path')]) {
      const s=p.inkStroke;
      if (!strokes.includes(s)) continue;
      const width=p.getAttribute('stroke-width');
      p.setAttribute('stroke-width',String(Number(width)+24));
      let hit=false;
      for(let i=0;i<=steps && !hit;i++) {
        hit=p.isPointInStroke(new DOMPoint(
          start[0]+(end[0]-start[0])*i/steps,
          start[1]+(end[1]-start[1])*i/steps));
      }
      p.setAttribute('stroke-width',width);
      if(hit) {
        strokes.splice(strokes.indexOf(s),1);
        active.removed.push(s); p.remove();
      }
    }
    active.last=end;
  }
  /* Screen frame of the stroke being drawn: maps client points to stored coordinates. */
  function frameOf(a) {
    if (a.inViewer) {
      const r = imageRect(), v = viewport.getBoundingClientRect();
      return r && {map:(x, y) => [(x - v.left - r.left) / r.width, (y - v.top - r.top) / r.height], scale:r.width};
    }
    if (a.stroke.kind === 'image') {
      const r = a.img.getBoundingClientRect();
      return r.width ? {map:(x, y) => [(x - r.left) / r.width, (y - r.top) / r.height], scale:r.width} : null;
    }
    const o = origin(a.stroke);
    return o && !o.hidden ? {map:(x, y) => [(x - o.x) / o.em, (y - o.y) / o.em], scale:o.em, at:o.at} : null;
  }
  for (const svg of [page, side, viewer].filter(Boolean)) {
    svg.addEventListener('pointerdown',e=>{
      if (!enabled || active || documentBusy || preparing || readOnly || placing || (e.pointerType==='mouse' && e.button!==0)) return;
      const inViewer = svg===viewer;
      if (erasing) {
        e.preventDefault(); e.stopPropagation();
        active={layer:svg,id:e.pointerId,inViewer,removed:[]};
        svg.setPointerCapture(e.pointerId); eraseAt(e); render(); update();
        return;
      }
      const surface = svg === side ? 'evidence' : 'page';
      let stroke, img = null;
      if (inViewer) {
        if (!image.naturalWidth) return;
        stroke = {kind:'image', target:keyFor(image), size:[image.naturalWidth, image.naturalHeight]};
      } else {
        img = withoutLayers(() => document.elementFromPoint(e.clientX, e.clientY)?.closest('.figure-open')?.querySelector('img'));
        if (img && img.naturalWidth && (surface === 'evidence' ? evidence : main).contains(img))
          stroke = {kind:'image', target:keyFor(img), size:[img.naturalWidth, img.naturalHeight]};
        else { img = null; stroke = locate(e.clientX, e.clientY, surface); }
      }
      if (!stroke) return;
      Object.assign(stroke, {color, points:[], order:sequence++});
      const draft = {layer:svg, id:e.pointerId, stroke, inViewer, img};
      const f = frameOf(draft);
      if (!f) return;
      const point = f.map(e.clientX, e.clientY);
      if (stroke.kind === 'image' && point.some(v => v < 0 || v > 1)) return;
      e.preventDefault(); e.stopPropagation();
      if (!files.current) files.begin();
      stroke.width = 2.5 / f.scale;
      stroke.points.push(point);
      if (f.at) stroke.at = f.at;
      strokes.push(stroke);
      active = draft;
      svg.setPointerCapture(e.pointerId);
      render(); update();
    });
    svg.addEventListener('pointermove',e=>{
      if (!active || active.id!==e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      if (active.removed) { eraseAt(e); schedule(); return; }
      const f = frameOf(active);
      if (!f) return;
      const samples = e.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [e]) {
        const point=f.map(sample.clientX, sample.clientY), last=active.stroke.points.at(-1);
        // Ignore subpixel jitter, retaining coalesced pointer samples.
        if (Math.hypot(point[0]-last[0],point[1]-last[1])*f.scale>=.6) active.stroke.points.push(point);
      }
      schedule();
    });
    for (const event of ['pointerup','pointercancel','lostpointercapture']) {
      svg.addEventListener(event,e=>{
        if (!active || active.id!==e.pointerId) return;
        e.stopPropagation(); finish(); render();
      });
    }
    // Do not open the underlying image or double-click zoom while drawing.
    svg.addEventListener('click',e=>e.stopPropagation());
    svg.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();});
  }
  // The evidence ink layer sits over the pane, so it forwards wheel scrolling to it.
  side?.addEventListener('wheel', e => {
    e.preventDefault();
    evidence.scrollTop += e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? evidence.clientHeight : 1);
  }, {passive:false});
  document.addEventListener('keydown',e=>{
    if (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (placing && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stopPlacing(); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase()==='p') {
      e.preventDefault();e.stopImmediatePropagation();
      if (!e.repeat) setEnabled(!enabled);
    } else if (enabled && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase()==='e') {
      e.preventDefault();e.stopImmediatePropagation();
      if (!e.repeat) { finish(); erasing=!erasing; update(); }
    } else if (enabled && e.key==='Escape') {
      e.preventDefault();e.stopImmediatePropagation();
      const menu = controls.find(c => c.menu.matches(':popover-open'))?.menu;
      if (menu) menu.hidePopover(); else setEnabled(false);
    } else if (enabled && (e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='z') {
      e.preventDefault();e.stopImmediatePropagation();controls[0].undo.click();
    }
  },true);
  // Capture catches window, pane and inner horizontal scrolling alike.
  document.addEventListener('scroll',schedule,{capture:true,passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('blur',finish);
  window.addEventListener('beforeunload', e => {
    finish();
    if (files.pending || files.state === 'error') { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  document.addEventListener('load',schedule,true);
  document.fonts?.ready.then(schedule);
  const observer = new ResizeObserver(schedule);
  for (const el of [main, evidence]) if (el) observer.observe(el);
  document.querySelectorAll('.figure-resizable').forEach(el=>observer.observe(el));
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
  dialog.addEventListener('close',()=>{setEnabled(false);render();});
  new MutationObserver(()=>{update();schedule();}).observe(dialog,{attributes:true,attributeFilter:['open']});
  update();
  if (navigator.locks) loadRecord(files.current?.record || null);
  else acquire();
  return {setEnabled,renderViewer, get enabled(){return enabled;},get drawing(){return !!active;}};
};
