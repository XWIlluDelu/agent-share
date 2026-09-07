/* Local Markdown source buffers over captured full-source ranges. Rendered HTML
   is never serialized back into Markdown. */
(() => {
  function normalize(source) {
    let text = ''; const offsets = [0];
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\r') { if (source[i + 1] === '\n') i++; text += '\n'; }
      else text += source[i];
      offsets.push(i + 1);
    }
    return { text, offsets };
  }
  function plan(source, body, markdown) {
    if (!source.endsWith(body)) throw new Error('Body does not match its captured source.');
    const base = source.length - body.length, { text, offsets } = normalize(body);
    const blocks = [], tokens = markdown.lexer(text);
    let cursor = 0;
    const gapSafe = gap => !gap || markdown.lexer(gap).every(t => t.type === 'space');
    for (const token of tokens) {
      const start = text.indexOf(token.raw, cursor);
      if (start < 0 || !gapSafe(text.slice(cursor, start))) throw new Error('Unmapped source; use Source editing.');
      const end = start + token.raw.length;
      if (!['space', 'def'].includes(token.type)) {
        const raw = source.slice(base + offsets[start], base + offsets[end]);
        const ending = raw.match(/(?:\r\n|\r|\n)+$/)?.[0] || '';
        const initial = normalize(raw.slice(0, raw.length - ending.length)).text;
        blocks.push({ start: base + offsets[start], end: base + offsets[end], initial, value: initial, ending });
      }
      cursor = end;
    }
    if (!gapSafe(text.slice(cursor))) throw new Error('Unmapped source; use Source editing.');
    return { source, base, blocks, markdown, active: null, newline: source.includes('\r\n') ? '\r\n' : source.includes('\r') ? '\r' : '\n' };
  }
  function value(model, block) { return model.active?.block === block ? model.active.input.value : block.value; }
  function apply(model, container) {
    const expected = [...model.blocks.map(b => b.element), model.append];
    if (container.children.length !== expected.length || expected.some((el, i) => container.children[i] !== el))
      throw new Error('The body surface changed. Your Markdown input is kept.');
    let source = model.source;
    for (const block of [...model.blocks].reverse()) {
      const text = value(model, block);
      if (text === block.initial) continue;
      const replacement = text ? text.replace(/\n/g, model.newline) + block.ending : '';
      source = source.slice(0, block.start) + replacement + source.slice(block.end);
    }
    const extra = value(model, model.extra);
    if (extra) {
      const lines = source.match(/(?:\r\n|\r|\n)*$/)[0].replace(/\r\n?/g, '\n').length;
      source += (source ? model.newline.repeat(Math.max(0, 2 - lines)) : '') + extra.replace(/\n/g, model.newline) + model.newline;
    }
    return source;
  }
  function render(model, block, links) {
    // Supply definitions before inline lexing, not just before HTML rendering.
    const lexer = new marked.Lexer(model.markdown.defaults);
    lexer.tokens.links = links || model.markdown.lexer(apply(model, model.container).slice(model.base)).links;
    block.element.innerHTML = model.markdown.parser(lexer.lex(block.value));
    block.element.classList.remove('body-active'); block.element.tabIndex = 0;
  }
  function mount(model, container, label) {
    model.container = container;
    model.extra = { initial: '', value: '', ending: '' };
    const fragment = document.createDocumentFragment();
    for (const [index, block] of [...model.blocks, model.extra].entries()) {
      const el = document.createElement('div'); el.className = 'body-block'; el.dataset.bodyBlock = index;
      el.tabIndex = 0; el.setAttribute('role', 'group'); el.setAttribute('aria-label', label(block === model.extra ? -1 : index));
      block.element = el; fragment.append(el);
    }
    model.append = model.extra.element; model.append.classList.add('body-append');
    container.replaceChildren(fragment);
    const links = model.markdown.lexer(model.source.slice(model.base)).links;
    for (const block of [...model.blocks, model.extra]) render(model, block, links);
  }
  function resize(input) {
    input.style.height = '0px'; input.style.height = Math.max(36, input.scrollHeight + 2) + 'px';
  }
  function deactivate(model) {
    const active = model.active;
    if (!active) return;
    active.block.value = active.input.value; active.observer?.disconnect(); model.active = null;
    render(model, active.block);
  }
  function activate(model, root) {
    const block = [...model.blocks, model.extra].find(b => b.element === root);
    if (!block) return null;
    if (model.active?.block === block) return model.active.input;
    deactivate(model);
    const input = document.createElement('textarea'); input.className = 'body-source'; input.value = block.value;
    input.spellcheck = false; input.setAttribute('aria-label', root.getAttribute('aria-label'));
    model.active = { block, input }; root.tabIndex = -1; root.classList.add('body-active'); root.replaceChildren(input); resize(input);
    if (input.isConnected) {
      let width;
      const observer = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width !== width) { width = entry.contentRect.width; resize(input); }
      });
      observer.observe(input); model.active.observer = observer;
    }
    return input;
  }
  globalThis.DocDokiBody = { plan, mount, apply, activate, deactivate, resize };
})();
