/* Laser trails: transient strokes drawn while the laser is on and the primary button is held.
   Page trails are in document coordinates so they scroll with the content; viewer trails are
   relative to the image so they follow zoom and pan. Nothing is saved: each trail stays solid
   for LIFE ms after release, then fades out over FADE ms. */
window.createLaserTrails = function ({viewport, image, getView}) {
  const NS = 'http://www.w3.org/2000/svg', LIFE = 60000, FADE = 1500;
  const layer = (parent, name) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('laser-trails', name);
    svg.setAttribute('aria-hidden', 'true');
    parent.append(svg);
    return svg;
  };
  const page = layer(document.body, 'laser-trails--page');
  const viewer = layer(viewport, 'laser-trails--viewer');
  const trails = [];
  let current = null, frame = 0;

  function point(e, inViewer) {
    if (!inViewer) return [e.clientX + scrollX, e.clientY + scrollY];
    const v = getView(), r = viewport.getBoundingClientRect();
    return [(e.clientX - r.left - v.x) / (image.naturalWidth * v.scale), (e.clientY - r.top - v.y) / (image.naturalHeight * v.scale)];
  }
  function place(t) {
    let points = t.points;
    if (t.inViewer) {
      const v = getView(), w = image.naturalWidth * v.scale, h = image.naturalHeight * v.scale;
      points = points.map(([u, s]) => [v.x + u * w, v.y + s * h]);
    }
    t.el.setAttribute('d', 'M' + points.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + (points.length === 1 ? ' l0.01 0' : ''));
  }
  function tick(now) {
    frame = 0;
    for (let i = trails.length - 1; i >= 0; i--) {
      const t = trails[i];
      if (t === current) continue;
      const left = t.ended + LIFE + FADE - now;
      if (left <= 0) { t.el.remove(); trails.splice(i, 1); continue; }
      const opacity = Math.min(1, left / FADE);
      if (opacity !== t.opacity) { t.opacity = opacity; t.el.style.opacity = opacity; }
    }
    if (trails.length) frame = requestAnimationFrame(tick);
  }
  function remove(filter) {
    for (let i = trails.length - 1; i >= 0; i--) if (filter(trails[i])) { trails[i].el.remove(); trails.splice(i, 1); }
    if (current && !trails.includes(current)) current = null;
  }
  return {
    get active() { return current; },
    start(e, inViewer) {
      const el = document.createElementNS(NS, 'path');
      current = {id:e.pointerId, inViewer, el, points:[point(e, inViewer)], from:[e.clientX, e.clientY], moved:false};
      (inViewer ? viewer : page).append(el);
      trails.push(current);
      place(current);
    },
    extend(e) {
      if (!current || e.pointerId !== current.id) return;
      const samples = e.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [e]) current.points.push(point(sample, current.inViewer));
      current.moved ||= Math.hypot(e.clientX - current.from[0], e.clientY - current.from[1]) > 3;
      place(current);
    },
    /* Ends the current trail; returns whether it was a drag (a click leaves no trail). */
    end() {
      const t = current;
      if (!t) return false;
      current = null;
      if (!t.moved) { remove(x => x === t); return false; }
      t.ended = performance.now();
      if (!frame) frame = requestAnimationFrame(tick);
      return true;
    },
    renderViewer() { trails.filter(t => t.inViewer).forEach(place); },
    clearViewer() { remove(t => t.inViewer); },
    clear() { remove(() => true); }
  };
};
