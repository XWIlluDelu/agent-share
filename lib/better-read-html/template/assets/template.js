/* Page behaviour: math, panes, contents highlighting, figures, image viewer, laser and ink. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const mobile = matchMedia('(max-width:900px)');
 const overlayEvidence = matchMedia('(max-width:1279px)');
 // Math renders before anything indexes text, so ink anchors see the final DOM.
 window.renderMathInElement?.(document.querySelector('main'), {
   delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],
   throwOnError:false
 });
 // Keep closing punctuation on the same line as the inline formula before it.
 document.querySelectorAll('main .katex:not(.katex-display .katex)').forEach(math => {
   // auto-render wraps each formula in a classless span; the punctuation follows that wrapper.
   const box = math.parentElement.matches('span:not([class])') ? math.parentElement : math;
   const next = box.nextSibling, punct = next?.nodeType === Node.TEXT_NODE && /^[.,;:!?)\]’”]+/.exec(next.data);
   if (!punct) return;
   const glue = document.createElement('span');
   glue.className = 'math-nowrap';
   box.replaceWith(glue);
   next.data = next.data.slice(punct[0].length);
   glue.append(box, punct[0]);
 });
 const headings = [...document.querySelectorAll('main h2, main h3')];
 const links = headings.map((h, i) => {
   if (!h.id) h.id = 'section-' + i;
   const li = document.createElement('li');
   if (h.tagName === 'H3') li.className = 'sub';
   const a = document.createElement('a');
   a.href = '#' + h.id; a.textContent = h.textContent;
   li.append(a); $('toc-list').append(li);
   a.addEventListener('click', () => { if (mobile.matches) toc.set(false); });
   return a;
 });
 const toc = createPane({pane:$('toc'), toggle:$('toc-toggle'), side:'left', label:'contents', openClass:'toc-open'});
 const evidence = createEvidence();
 const panes = [toc, evidence?.controller].filter(Boolean);
 // On narrow screens panes overlay the page: one at a time, behind a shared shade.
 panes.forEach(pane => pane.onChange(open => {
   if (open && mobile.matches) panes.forEach(other => { if (other !== pane && other.open) other.set(false); });
 }));
 $('nav-shade').onclick = () => panes.forEach(pane => pane.set(false));
 mobile.addEventListener('change', () => { toc.set(!mobile.matches); if (mobile.matches) evidence?.controller.set(false); });
 toc.set(!mobile.matches);
 let scrollFrame = 0, lastActiveIndex = -1;
 function highlight() {
   scrollFrame = 0;
   let current = 0;
   headings.forEach((h, i) => { if (h.getBoundingClientRect().top <= 140) current = i; });
   if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
     const target = headings.findIndex(h => '#' + h.id === location.hash && h.getBoundingClientRect().top >= 0);
     current = target >= 0 ? target : headings.length - 1;
   }
   links.forEach((a, i) => {
     if (i === current) {
       a.setAttribute('aria-current', 'location');
       if (current !== lastActiveIndex) {
         lastActiveIndex = current;
         const toc = $('toc'), item = a.getBoundingClientRect(), bounds = toc.getBoundingClientRect();
         // Scroll only the contents pane, without moving the document.
         if (item.top < bounds.top + 40) toc.scrollTop += item.top - bounds.top - 40;
         else if (item.bottom > bounds.bottom - 40) toc.scrollTop += item.bottom - bounds.bottom + 40;
       }
     }
     else a.removeAttribute('aria-current');
   });
 }
 window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(highlight); }, {passive:true});
 window.addEventListener('hashchange', highlight);
 highlight();

 // Resize figures proportionally without overlapping the contents or viewport.
 document.querySelectorAll('.figure-resizable').forEach(wrapper => {
   const handle = wrapper.querySelector('.figure-resize');
   let drag = null;
   function bounds() {
     const center = wrapper.parentElement.getBoundingClientRect();
     const cx = center.left + center.width / 2;
     const docked = !mobile.matches;
     const left = docked && toc.open ? $('toc').getBoundingClientRect().right + 16 : 16;
     const right = docked && !overlayEvidence.matches && evidence?.controller.open ? evidence.pane.getBoundingClientRect().left - 16 : innerWidth - 16;
     const max = Math.max(1, 2 * Math.min(cx - left, right - cx));
     return {min:Math.min(240,max),max};
   }
   function resize(width) {
     const {min,max} = bounds();
     wrapper.style.width = Math.max(min,Math.min(max,width)) + 'px';
   }
   function end() { drag=null; document.body.classList.remove('figure-resizing'); }
   handle.addEventListener('pointerdown', e => {
     if(e.pointerType==='mouse' && e.button!==0) return;
     e.preventDefault();
     const r=wrapper.getBoundingClientRect();
     drag={id:e.pointerId,x:e.clientX,y:e.clientY,width:r.width,ratio:r.height/r.width};
     handle.setPointerCapture(e.pointerId);
     document.body.classList.add('figure-resizing');
   });
   handle.addEventListener('pointermove', e => {
     if(!drag || e.pointerId!==drag.id) return;
     const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
     // A width change dw moves the right edge by dw/2 and the bottom by ratio*dw.
     const dw=(dx*.5+dy*drag.ratio)/(.25+drag.ratio**2);
     resize(drag.width+dw);
   });
   handle.addEventListener('pointerup',end);
   handle.addEventListener('pointercancel',end);
   handle.addEventListener('lostpointercapture',end);
   handle.addEventListener('dblclick',e=>{e.preventDefault();wrapper.style.width='';});
   handle.addEventListener('keydown',e=>{
     if(e.key==='Enter'||e.key==='Home') {e.preventDefault();wrapper.style.width='';}
     if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)) {
       e.preventDefault();
       resize(wrapper.getBoundingClientRect().width+(['ArrowRight','ArrowDown'].includes(e.key)?40:-40));
     }
   });
   new ResizeObserver(()=>{if(wrapper.style.width) resize(parseFloat(wrapper.style.width));}).observe(document.querySelector('main'));
 });
 const dialog = $('viewer'), viewport = $('viewport'), img = $('zoom-image');
 const selection = $('selection'), pointers = new Map();
 let scale = 1, fitScale = 1, x = 0, y = 0, ready = false;
 let ink = null, trails = null;
 let boxMode = false, gesture = null, opener = null;
 function local(e) { const r = viewport.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
 function draw() {
   const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
   x = Math.max(32-w, Math.min(viewport.clientWidth-32, x));
   y = Math.max(32-h, Math.min(viewport.clientHeight-32, y));
   img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
   $('zoom-label').value = Math.round(scale / fitScale * 100) + '%';
   ink?.renderViewer();
   trails?.renderViewer();
 }
 function setBox(value) {
   if (value) ink?.setEnabled(false);
   boxMode = value; $('box-zoom').setAttribute('aria-pressed',String(value));
   viewport.classList.toggle('selecting', value);
 }
 function clearGesture() {
   pointers.clear(); gesture = null; selection.style.display = 'none'; viewport.classList.remove('dragging');
 }
 function fit() {
   if (!ready) return;
   clearGesture();
   fitScale = Math.min((viewport.clientWidth-32)/img.naturalWidth, (viewport.clientHeight-32)/img.naturalHeight);
   scale = fitScale;
   x = (viewport.clientWidth-img.naturalWidth*scale)/2;
   y = (viewport.clientHeight-img.naturalHeight*scale)/2;
   draw();
 }
 function zoom(next, anchor) {
   if (!ready) return;
   const s = Math.max(fitScale*.5, Math.min(fitScale*32,next));
   x = anchor.x - (anchor.x-x)*s/scale;
   y = anchor.y - (anchor.y-y)*s/scale;
   scale = s; draw();
 }
 const center = () => ({x:viewport.clientWidth/2,y:viewport.clientHeight/2});
 function close() { dialog.close(); }
 dialog.addEventListener('close', () => {
   document.body.style.overflow = ''; ready=false; clearGesture(); setBox(false); trails.clearViewer();
   hideLaser(); if (opener) opener.focus({preventScroll:true});
 });
 img.onload = () => { ready=true; img.style.visibility='visible'; $('image-status').hidden=true; fit(); };
 img.onerror = () => { ready=false; $('image-status').textContent='Image could not be loaded. Check the image path.'; $('image-status').hidden=false; };
 document.querySelectorAll('.figure-open').forEach(button => {
   button.addEventListener('click', () => {
     const source = button.querySelector('img'); opener=button; ready=false;
     img.style.visibility='hidden'; $('image-status').hidden=false; $('image-status').textContent='Loading image…';
     $('viewer-title').textContent = source.alt || 'Image viewer';
  $('viewer-title').title = source.alt || 'Image viewer';
     dialog.showModal(); document.body.style.overflow='hidden';
     img.alt=source.alt; img.src=source.dataset.full || source.currentSrc || source.src;
     viewport.focus(); hideLaser();
   });
 });
 $('close-viewer').onclick=close;
 $('fit').onclick=fit;
 $('zoom-in').onclick=()=>zoom(scale*1.5,center());
 $('zoom-out').onclick=()=>zoom(scale/1.5,center());
 $('box-zoom').onclick=()=>setBox(!boxMode);
 viewport.addEventListener('wheel', e => {
   e.preventDefault(); if (gesture || ink?.drawing) return;
   zoom(scale*Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.0025),local(e));
 }, {passive:false});
 viewport.addEventListener('dblclick', e => { if (!boxMode) zoom(scale*2,local(e)); });
 function pinch() {
   const [a,b]=[...pointers.values()];
   return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
 }
 viewport.addEventListener('pointerdown', e => {
   if (!ready || (e.pointerType==='mouse' && e.button!==0)) return;
   e.preventDefault(); viewport.setPointerCapture(e.pointerId);
   // With the laser on, a primary drag draws a trail instead of panning; Shift or box mode still box-zooms.
   if (laser && !boxMode && !e.shiftKey && e.pointerType!=='touch' && !pointers.size && !trails.active) { trails.start(e, true); return; }
   const p=local(e); pointers.set(e.pointerId,p);
   if (pointers.size===2) {
     selection.style.display='none';
     const c=pinch(); gesture={type:'pinch',distance:c.d,scale,ix:(c.x-x)/scale,iy:(c.y-y)/scale};
   } else if (pointers.size===1) {
     const isBox=boxMode || e.shiftKey;
     gesture={type:isBox?'box':'pan',start:p,x,y};
     viewport.classList.toggle('dragging',!isBox);
   }
 });
 viewport.addEventListener('pointermove', e => {
   if (trails.active?.inViewer) { trails.extend(e); return; }
   if (!pointers.has(e.pointerId) || !gesture) return;
   const p=local(e); pointers.set(e.pointerId,p);
   if (gesture.type==='pinch' && pointers.size>=2) {
     const c=pinch(); scale=Math.max(fitScale*.5,Math.min(fitScale*32,gesture.scale*c.d/gesture.distance));
     x=c.x-gesture.ix*scale; y=c.y-gesture.iy*scale; draw();
   } else if (gesture.type==='pan') {
     x=gesture.x+p.x-gesture.start.x; y=gesture.y+p.y-gesture.start.y; draw();
   } else if (gesture.type==='box') {
     const a=gesture.start;
     Object.assign(selection.style,{display:'block',left:Math.min(a.x,p.x)+'px',top:Math.min(a.y,p.y)+'px',width:Math.abs(a.x-p.x)+'px',height:Math.abs(a.y-p.y)+'px'});
   }
 });
 function endPointer(e) {
   if (trails.active?.inViewer && trails.active.id === e.pointerId) { trails.end(); return; }
   if (!pointers.has(e.pointerId)) return;
   if (gesture?.type==='box' && e.type==='pointerup') {
     const a=gesture.start, b=local(e), w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
     if (w>12 && h>12) {
       const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,ix=(cx-x)/scale,iy=(cy-y)/scale;
       scale=Math.min(fitScale*32,scale*Math.min(viewport.clientWidth/w,viewport.clientHeight/h)*.94);
       x=viewport.clientWidth/2-ix*scale; y=viewport.clientHeight/2-iy*scale; draw();
       setBox(false);
     }
   }
   pointers.delete(e.pointerId); selection.style.display='none'; viewport.classList.remove('dragging');
   if (pointers.size===1) gesture={type:'pan',start:[...pointers.values()][0],x,y};
   else if (pointers.size===0) gesture=null;
 }
 viewport.addEventListener('pointerup',endPointer);
 viewport.addEventListener('pointercancel',endPointer);
 new ResizeObserver(() => { if(dialog.open) fit(); }).observe(viewport);

 let laser=false;
 const dots=[...document.querySelectorAll('.laser-dot')];
 function hideLaser() { dots.forEach(d=>d.style.display='none'); }
 function setLaser(value) {
   if (value) ink?.setEnabled(false);
   laser=value; document.body.classList.toggle('laser-on',value);
   document.querySelectorAll('.laser-button').forEach(b=>b.setAttribute('aria-pressed',String(value)));
   if(!value) hideLaser();
 }
 trails = createLaserTrails({viewport,image:img,getView:()=>({x,y,scale})});
 ink = createAnnotations({dialog,viewport,image:img,getView:()=>({x,y,scale}),
   evidence:evidence?.pane || null,
   onEnable:()=>{setLaser(false);setBox(false);clearGesture();}});
 document.querySelectorAll('.laser-button').forEach(b=>b.onclick=()=>setLaser(!laser));
 // Page trails: a drag on content draws; a click without movement still reaches links and figures.
 const NO_TRAIL = 'input, select, textarea, [contenteditable], .pane, .pane-rail, .toolbar, dialog, .ink-menu, #toc-toggle, #ev-toggle, .figure-resize, .code-copy-button';
 let swallowClick = false;
 document.addEventListener('pointerdown', e => {
   swallowClick = false;
   if (!laser || dialog.open || e.button!==0 || e.pointerType==='touch' || e.target.closest(NO_TRAIL)) return;
   e.preventDefault();
   trails.start(e, false);
 }, true);
 const endTrail = e => {
   const t = trails.active;
   if (t && !t.inViewer && (!e || e.pointerId === t.id)) swallowClick = trails.end();
 };
 document.addEventListener('pointerup', endTrail, true);
 document.addEventListener('pointercancel', endTrail, true);
 document.addEventListener('click', e => { if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
 document.addEventListener('pointermove',e=>{
   if (trails.active && !trails.active.inViewer) trails.extend(e);
   if(!laser || e.pointerType==='touch') return;
   dots.forEach(d=>{
     const visible=dialog.open ? dialog.contains(d) : !dialog.contains(d);
     d.style.display=visible?'block':'none'; d.style.left=e.clientX+'px'; d.style.top=e.clientY+'px';
   });
 },{passive:true});
 document.documentElement.addEventListener('pointerleave',hideLaser);
 window.addEventListener('blur',()=>{hideLaser();clearGesture();endTrail();});
 document.addEventListener('keydown',e=>{
   if(e.ctrlKey||e.metaKey||e.altKey||e.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
   if(e.key.toLowerCase()==='l' && !e.repeat) { e.preventDefault();setLaser(!laser); }
   if(dialog.open) {
     if(e.key==='+'||e.key==='=') {e.preventDefault();zoom(scale*1.5,center());}
     if(e.key==='-') {e.preventDefault();zoom(scale/1.5,center());}
     if(e.key==='0') {e.preventDefault();fit();}
     if(e.key==='Escape' && (gesture||boxMode)) {e.preventDefault();clearGesture();setBox(false);}
   } else if(e.key==='Escape') {
     setLaser(false); trails.clear();
     if(mobile.matches) panes.forEach(pane => pane.set(false));
     else if(overlayEvidence.matches) evidence?.controller.set(false);
   }
 });
})();
