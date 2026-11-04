/* Evidence notes are authored inline as <aside class="ev-note" id="…"> after the block that cites them,
   with <a class="ev-ref" href="#…"></a> markers in the text. On load the notes move into a right pane,
   numbered by first reference. Without notes, no pane is created. */
window.createEvidence = function () {
  const main = document.querySelector('main');
  const notes = [...main.querySelectorAll('aside.ev-note[id]')];
  if (!notes.length) return null;
  const refs = [...main.querySelectorAll('a.ev-ref[href^="#"]')];
  const idOf = a => decodeURIComponent(a.hash.slice(1));
  const number = new Map();
  refs.forEach(a => { const id = idOf(a); if (!number.has(id)) number.set(id, number.size + 1); });
  notes.sort((a, b) => (number.get(a.id) ?? Infinity) - (number.get(b.id) ?? Infinity));

  const pane = document.createElement('aside');
  pane.id = 'evidence'; pane.className = 'pane pane--right';
  pane.setAttribute('aria-label', 'Evidence'); pane.dataset.canonical = 'false';
  pane.innerHTML = '<div class="brand">Evidence</div><button class="pane-close" aria-label="Close evidence">×</button><ol class="ev-list"></ol>';
  const list = pane.querySelector('ol');
  const kinds = {excerpt:'Excerpt', citation:'Citation', note:'Note'};
  const items = new Map();
  for (const note of notes) {
    const item = document.createElement('li');
    item.className = 'ev-item'; item.dataset.note = note.id;
    const head = document.createElement('div'); head.className = 'ev-head';
    const num = document.createElement('span'); num.className = 'ev-num';
    num.textContent = number.get(note.id) ?? '–';
    const kind = document.createElement('span'); kind.className = 'ev-kind';
    kind.textContent = kinds[note.dataset.kind] || 'Note';
    head.append(num, kind);
    if (note.dataset.locator) {
      const locator = document.createElement('span'); locator.className = 'ev-locator';
      locator.textContent = note.dataset.locator;
      head.append(locator);
    }
    item.append(head, note);
    list.append(item);
    items.set(note.id, {item, head, refs:[]});
  }
  refs.forEach(a => {
    const entry = items.get(idOf(a));
    if (!entry) return;
    entry.refs.push(a);
    const n = number.get(idOf(a));
    a.textContent = n;
    if (!a.id) a.id = 'ref-' + idOf(a) + (entry.refs.length > 1 ? '-' + entry.refs.length : '');
    a.setAttribute('aria-label', 'Evidence ' + n);
    a.setAttribute('aria-controls', 'evidence');
    const back = document.createElement('a');
    back.className = 'ev-back'; back.href = '#' + a.id;
    back.textContent = entry.refs.length > 1 ? '↩' + entry.refs.length : '↩';
    back.setAttribute('aria-label', 'Back to reference ' + n + (entry.refs.length > 1 ? ' (' + entry.refs.length + ')' : ''));
    entry.head.append(back);
  });

  const toggle = document.createElement('button');
  toggle.id = 'ev-toggle'; toggle.setAttribute('aria-controls', 'evidence');
  document.body.append(pane, toggle);
  document.body.classList.add('has-evidence');
  const pane$ = createPane({pane, toggle, side:'right', label:'evidence', openClass:'ev-open'});
  pane$.set(false);

  function reveal(item, margin = 56) {
    const p = pane.getBoundingClientRect(), r = item.getBoundingClientRect();
    if (r.top < p.top + margin || r.bottom > p.bottom - 16) pane.scrollTop += r.top - p.top - margin;
  }
  /* Sentence containing the marker, highlighted with the CSS Custom Highlight API where available. */
  const segmenter = window.Intl?.Segmenter && new Intl.Segmenter(document.documentElement.lang || undefined, {granularity:'sentence'});
  function claimRange(ref) {
    const block = ref.closest('p,li,td,th,dd,blockquote,figcaption,h1,h2,h3,h4') || ref.parentElement;
    const index = new TextIndex(block);
    const at = index.indexOf(ref.parentNode, [...ref.parentNode.childNodes].indexOf(ref));
    if (!segmenter || !at) return index.range(0, index.text.length);
    for (const s of segmenter.segment(index.text)) {
      if (at - 1 >= s.index && at - 1 < s.index + s.segment.length) {
        const end = s.index + s.segment.trimEnd().length;
        return index.range(s.index, Math.max(at, end));
      }
    }
    return index.range(0, index.text.length);
  }
  let active = null;
  function activate(id, ref) {
    active?.item.classList.remove('is-active');
    active?.ref?.classList.remove('is-active');
    const entry = items.get(id);
    active = entry ? {item:entry.item, ref} : null;
    entry?.item.classList.add('is-active');
    ref?.classList.add('is-active');
    if (window.CSS?.highlights && window.Highlight) {
      if (entry && ref) CSS.highlights.set('ev-claim', new Highlight(claimRange(ref)));
      else CSS.highlights.delete('ev-claim');
    }
  }
  const mobile = matchMedia('(max-width:900px)');
  refs.forEach(a => a.addEventListener('click', e => {
    const id = idOf(a), entry = items.get(id);
    if (!entry) return;
    e.preventDefault();
    pane$.set(true);
    reveal(entry.item);
    activate(id, a);
  }));
  pane.addEventListener('click', e => {
    const back = e.target.closest('.ev-back');
    if (!back) return;
    e.preventDefault();
    const ref = document.getElementById(back.hash.slice(1));
    if (!ref) return;
    if (mobile.matches) pane$.set(false);
    ref.scrollIntoView({block:'center', behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'});
    activate(back.closest('.ev-item').dataset.note, ref);
  });
  pane$.onChange(open => { if (!open) activate(null); });

  // Notes whose markers are on screen are marked; the first of them is kept visible in the pane.
  const visible = new Set();
  let lead = null;
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    const ids = new Set([...visible].map(idOf));
    for (const [id, entry] of items) entry.item.classList.toggle('in-view', ids.has(id));
    const first = refs.find(a => visible.has(a));
    const next = first && items.get(idOf(first))?.item;
    if (next && next !== lead && pane$.open && !pane.matches(':hover')) reveal(next);
    lead = next || lead;
  }, {rootMargin:'-64px 0px -20% 0px'});
  refs.forEach(a => spy.observe(a));

  return {pane, toggle, controller:pane$};
};
