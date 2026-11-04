/* Side panes: one open/close controller and one boundary scrollbar for the contents (left)
   and evidence (right) panes. Layout (push or overlay) is decided by CSS media queries. */
(() => {
  function attachRail(pane, side, label) {
    const rail = document.createElement('div');
    rail.className = 'pane-rail pane-rail--' + side;
    const thumb = document.createElement('div');
    thumb.className = 'pane-rail-thumb';
    thumb.tabIndex = 0;
    thumb.setAttribute('role', 'scrollbar');
    thumb.setAttribute('aria-label', 'Scroll ' + label);
    thumb.setAttribute('aria-controls', pane.id);
    thumb.setAttribute('aria-orientation', 'vertical');
    thumb.setAttribute('aria-valuemin', '0');
    rail.append(thumb);
    document.body.append(rail);
    pane.classList.add('pane--railed');

    let travel = 0, maximum = 0, drag = null, timer;
    function sync() {
      maximum = Math.max(0, pane.scrollHeight - pane.clientHeight);
      rail.hidden = maximum === 0;
      const height = rail.clientHeight;
      const size = Math.min(height, Math.max(36, height * pane.clientHeight / pane.scrollHeight));
      travel = Math.max(0, height - size);
      thumb.style.height = size + 'px';
      thumb.style.transform = 'translateY(' + (maximum ? pane.scrollTop / maximum * travel : 0) + 'px)';
      thumb.setAttribute('aria-valuemax', Math.round(maximum));
      thumb.setAttribute('aria-valuenow', Math.round(pane.scrollTop));
    }
    pane.addEventListener('scroll', () => {
      sync();
      rail.classList.add('scrolling');
      clearTimeout(timer);
      timer = setTimeout(() => rail.classList.remove('scrolling'), 850);
    }, {passive:true});
    pane.addEventListener('pointerenter', () => rail.classList.add('hovered'));
    pane.addEventListener('pointerleave', () => rail.classList.remove('hovered'));
    pane.addEventListener('focusin', () => rail.classList.add('hovered'));
    pane.addEventListener('focusout', () => { if (!pane.matches(':hover')) rail.classList.remove('hovered'); });
    thumb.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      sync();
      drag = {y:e.clientY, scroll:pane.scrollTop};
      thumb.focus({preventScroll:true});
      thumb.setPointerCapture(e.pointerId);
      rail.classList.add('dragging');
    });
    thumb.addEventListener('pointermove', e => {
      if (drag && travel) pane.scrollTop = drag.scroll + (e.clientY - drag.y) * maximum / travel;
    });
    const end = () => { drag = null; rail.classList.remove('dragging'); };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
    thumb.addEventListener('lostpointercapture', end);
    thumb.addEventListener('keydown', e => {
      const delta = {ArrowDown:40, ArrowUp:-40, PageDown:pane.clientHeight * .8, PageUp:-pane.clientHeight * .8};
      if (e.key in delta) pane.scrollTop += delta[e.key];
      else if (e.key === 'Home') pane.scrollTop = 0;
      else if (e.key === 'End') pane.scrollTop = maximum;
      else return;
      e.preventDefault();
    });
    thumb.addEventListener('wheel', e => {
      e.preventDefault();
      pane.scrollTop += e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? pane.clientHeight : 1);
    }, {passive:false});
    const resize = new ResizeObserver(sync);
    resize.observe(pane);
    for (const child of pane.children) resize.observe(child);
    resize.observe(rail);
    window.addEventListener('resize', sync);
    sync();
  }

  /* side: 'left' | 'right'; openClass is set on <body> while the pane is open. */
  window.createPane = function ({pane, toggle, side, label, openClass}) {
    const close = pane.querySelector('.pane-close');
    const glyph = side === 'left' ? {open:'‹', closed:'›'} : {open:'›', closed:'‹'};
    const listeners = [];
    const controller = {
      get open() { return document.body.classList.contains(openClass); },
      set(open) {
        document.body.classList.toggle(openClass, open);
        pane.inert = !open;
        const text = (open ? 'Collapse ' : 'Expand ') + label;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', text);
        toggle.title = text;
        toggle.textContent = open ? glyph.open : glyph.closed;
        listeners.forEach(fn => fn(open));
      },
      onChange(fn) { listeners.push(fn); }
    };
    toggle.addEventListener('click', () => controller.set(!controller.open));
    close?.addEventListener('click', () => { controller.set(false); toggle.focus(); });
    attachRail(pane, side, label);
    return controller;
  };
})();
