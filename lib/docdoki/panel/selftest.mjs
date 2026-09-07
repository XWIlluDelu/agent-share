#!/usr/bin/env node
/* State checks and real-browser journeys against the temporary Python fixture.
   No fixture projects, traces, screenshots or results are stored in this skill. */
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import vm from 'node:vm';
const here = dirname(fileURLToPath(import.meta.url)), sandbox = { globalThis: {}, console };
vm.runInNewContext(await readFile(join(here, 'state.js'), 'utf8'), sandbox);
const { DraftStore, diffOps, diffHTML } = sandbox.globalThis.DocDokiState;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS', name); }
const docs = { A: { source: 'A0', path: 'A' }, B: { source: 'B0', path: 'B' } };
check('A1 → B1 → A2 undo is chronological', () => {
  const s = new DraftStore(docs); s.set('A', 'A1'); s.set('B', 'B1'); s.set('A', 'A2');
  assert.equal(s.undo(), 'A'); assert.equal(s.source('A'), 'A1'); assert.equal(s.source('B'), 'B1');
  assert.equal(s.undo(), 'B'); assert.equal(s.source('B'), 'B0'); s.undo(); assert.equal(s.drafts.size, 0);
});
check('Saved history accumulates separately from current disk preconditions', () => {
  const s = new DraftStore(docs);
  for (const [path, to] of [['A', 'A1'], ['B', 'B1'], ['A', 'A2']]) {
    s.set(path, to); const edits = s.startSave();
    s.finishSave({ ok: true, documents: { [path]: { path, source: to } }, receipt: edits });
  }
  s.set('A', 'A3');
  assert.deepEqual(Array.from(s.receipt, e => [e.path, e.from, e.to]), [['A', 'A0', 'A1'], ['B', 'B0', 'B1'], ['A', 'A1', 'A2']]);
  assert.equal(s.edits()[0].from, 'A2'); assert.equal(s.edits()[0].to, 'A3');
});
check('Save locks mutations and adopts actual stored sources', () => {
  const s = new DraftStore(docs); s.set('A', 'A1'); assert.equal(s.startSave()[0].to, 'A1'); assert.equal(s.startSave(), null);
  assert.equal(s.set('A', 'A2'), false); s.undo(); s.discard('A', docs.A); assert.equal(s.source('A'), 'A1');
  s.finishSave({ ok: true, documents: { A: { source: 'A1 normalized', path: 'A' } }, receipt: [{ path: 'A', from: 'A0', to: 'A1 normalized' }] });
  assert.equal(s.drafts.size, 0); s.set('A', 'A2'); assert.equal(s.edits()[0].from, 'A1 normalized'); assert.equal(s.receipt.length, 1);
});
check('Failed saves retain drafts, history and original source', () => {
  const s = new DraftStore(docs); s.set('A', 'A1'); s.startSave(); s.finishSave({ ok: false });
  assert.equal(s.source('A'), 'A1'); assert.equal(s.edits()[0].from, 'A0'); s.undo(); assert.equal(s.drafts.size, 0);
});
check('Discard invalidates even equal-text sources and cannot undo across adoption', () => {
  const s = new DraftStore(docs); let version = s.version;
  assert.equal(s.discard('A', docs.A), true); assert.ok(s.version > version);
  s.set('A', 'A1'); s.set('B', 'B1'); version = s.version; s.discard('A', { path: 'A', source: 'A1' });
  assert.ok(s.version > version); assert.equal(s.drafts.has('A'), false); assert.equal(s.undo(), 'B'); assert.equal(s.undo(), null);
  s.set('A', 'A2'); s.discard('A', { path: 'A', source: 'external A' }); assert.equal(s.source('A'), 'external A');
  s.set('A', 'A3'); s.startSave(); version = s.version; assert.equal(s.discard('A', null), false); assert.equal(s.version, version);
  s.finishSave({ ok: false }); s.discard('A', null); assert.equal(s.base.has('A'), false);
});
check('Staged sources preserve mixed line endings exactly', () => {
  const s = new DraftStore({ A: { source: 'A\r\nB\n' } }); s.set('A', 'A\r\nC\n');
  assert.equal(s.source('A'), 'A\r\nC\n'); s.undo(); assert.equal(s.source('A'), 'A\r\nB\n');
});
check('Diff is bounded, complete and HTML-safe', () => {
  const a = Array.from({ length: 4000 }, (_, i) => 'old ' + i).join('\n'), b = Array.from({ length: 4000 }, (_, i) => 'new ' + i).join('\n');
  const start = performance.now(), html = diffHTML(a, b); assert.ok(performance.now() - start < 1000);
  assert.ok(html.includes('<details open')); assert.ok(html.includes('new 3999')); assert.ok(html.includes('old 3999'));
  assert.ok(diffHTML('a\nb', 'a\n<script>').includes('&lt;script&gt;'));
  assert.ok(diffHTML('same words old', 'same words new').includes('<ins>new</ins>')); assert.equal(diffOps(['x'], ['x']).length, 1);
});

if (process.argv.includes('--browser')) {
  const engines = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
  const engine = process.env.PANEL_BROWSER || 'chromium';
  assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
  const browser = await engines[engine].launch({ headless: true });
  const helper = spawn(process.env.PYTHON || 'python3', ['-B', join(here, 'selftest.py'), '--serve'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const info = await new Promise((resolve, reject) => {
    createInterface({ input: helper.stdout }).once('line', line => { try { resolve(JSON.parse(line)); } catch (e) { reject(e); } });
    helper.once('error', reject); helper.once('exit', code => reject(new Error('Fixture exited: ' + code)));
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: engine !== 'firefox' });
  const page = await context.newPage(), errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  page.on('request', r => { if (!r.url().startsWith(info.url)) network.push(r.url()); });
  const A = 'docdoki/specs/a.md', B = 'docdoki/specs/b.md', C = 'docdoki/specs/c.md';
  const originals = new Map(await Promise.all([A, B].map(async p => [p, await readFile(join(info.root, p), 'utf8')])));
  const rich = '---\r\npurpose: "Body editing" # keep this comment\r\nafter: []\r\n---\r\n# Body\r\n\r\nA plain paragraph.\r\n\r\n## Repeated\r\n\r\nKeep *this* spelling &amp; entity.\r\n\r\n## Repeated\r\n\r\n- First item\r\n- Second item\r\n\r\n```js\r\nconst value = 1;\r\n```\r\n\r\n<!-- preserve this comment -->\r\n\r\n| Name | Value |\r\n| --- | --- |\r\n| x | 1 |\r\n\r\nA [[b|validation]] and [reference][ref].\r\n\r\n[ref]: b.md "Reference title"\r\n';
  async function test(name, fn) { await fn(); assert.deepEqual(errors, [], 'No browser exceptions'); checks++; console.log(`PASS ${engine}:`, name); }
  async function settled() { await page.waitForFunction(() => !store.busy && !previewPending && !bodyEditor?.pending && !fieldEditor?.pending); }
  async function closeChanges() { if (await page.locator('#changes').isVisible()) await page.locator('#changes-close').click(); }
  async function changes() { if (!(await page.locator('#changes').isVisible())) await page.locator('#changes-toggle').click(); }
  async function showLibrary() {
    await page.waitForFunction(() => $('library-toggle').getAttribute('aria-expanded') === String(innerWidth <= 760 ? $('app').classList.contains('library-open') : !$('app').classList.contains('library-closed')));
    if (await page.locator('#library-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#library-toggle').click();
  }
  async function sidebar(name) {
    await closeChanges(); await showLibrary();
    await page.locator(`[data-nav="${name}"]`).click(); await settled();
  }
  async function board() { await sidebar('dashboard'); await page.waitForFunction(() => view === 'graph'); }
  async function open(path = A) {
    await closeChanges(); await showLibrary();
    await page.locator(`#catalog [data-doc="${path}"]`).first().click(); await page.waitForFunction(p => current === p && view === 'doc', path);
  }
  async function mode(value) {
    await closeChanges(); if (await page.evaluate(() => sourceMode) !== value) {
      // Use the visible sticky control, without Playwright's scrollIntoView
      // prelude (which moves sticky descendants in mobile Chromium).
      const box = await page.locator('#source-view').boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await page.waitForFunction(v => sourceMode === v, value); await settled();
  }
  async function fixture(source = rich) { await writeFile(join(info.root, A), source); await page.reload(); await open(); }
  const source = () => page.evaluate(() => bodySurface.model.source);
  async function leave() { await page.locator('#document-path').click(); await page.waitForFunction(() => !bodyEditor && !fieldEditor); await settled(); }
  async function fillSource(text) {
    await mode(true); await page.locator('#source').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.insertText(text.replace(/\r\n?/g, '\n'));
    assert.equal((await source()).replace(/\r\n?/g, '\n'), text.replace(/\r\n?/g, '\n'), 'Full-source replacement is exact, not a duplicate body insertion');
  }
  async function edit(path, transform) { await open(path); await fillSource(transform(await source())); await leave(); }
  async function selectText(text) {
    await page.evaluate(text => {
      const v = bodySurface.model.view, at = v.state.doc.toString().indexOf(text); if (at < 0) throw new Error('Missing text: ' + text);
      v.dispatch({ selection: { anchor: at, head: at + text.length }, scrollIntoView: true }); v.focus();
    }, text);
  }
  async function replaceText(text, replacement) { await selectText(text); await page.keyboard.insertText(replacement); }
  async function saved() { await changes(); await page.locator('#save').click(); await page.waitForFunction(() => !store.busy && !store.drafts.size); await settled(); }
  async function discard(path = A) { await changes(); await page.locator(`[data-discard="${path}"]`).click(); await page.waitForFunction(p => !store.drafts.has(p), path); await settled(); }
  async function undo() { await closeChanges(); await page.locator('#workspace').focus(); await page.keyboard.press('ControlOrMeta+z'); await settled(); }
  async function field(name, path = A) { await page.locator(`[data-node="${path}"] [data-field="${name}"]`).click(); await page.waitForFunction(([name, path]) => fieldEditor?.field === name && fieldEditor.path === path, [name, path]); }
  const input = () => page.locator('#card-field-form [name="value"]');
  async function fieldDone() { await input().press('ControlOrMeta+Enter'); await page.waitForFunction(() => !fieldEditor); await settled(); }
  async function shot(name) { if (process.env.PANEL_SCREENSHOT) await page.screenshot({ path: process.env.PANEL_SCREENSHOT.replace(/\.png$/, `-${engine}-${name}.png`), fullPage: true }); }
  async function language(value) { if (await page.evaluate(() => lang) !== value) await page.locator('#language').click(); }
  async function hold(pattern, predicate = () => true) {
    let release, arrived = false, failure;
    const gate = new Promise(resolve => { release = resolve; });
    const handler = async route => {
      if (!predicate(route.request())) return route.continue();
      try { const response = await route.fetch({ timeout: 10000 }); arrived = true; await gate; await route.fulfill({ response }); }
      catch (error) { failure = error; }
    };
    await page.route(pattern, handler);
    return { release, async wait() {
      const deadline = Date.now() + 10000;
      while (!arrived && !failure && Date.now() < deadline) await page.waitForTimeout(10);
      if (failure) throw failure; assert.ok(arrived, 'Held an actual backend response');
    }, async close() { release(); await page.unroute(pattern, handler); } };
  }
  async function equalWidths(selector) {
    const widths = await page.locator(selector).evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().width));
    assert.ok(widths.length > 1 && widths.every(w => Math.abs(w - widths[0]) < .15), selector); return widths[0];
  }
  try {
    await page.goto(info.url);
    await test('Offline first use: ordered navigation, pixel-heart and minimal board controls', async () => {
      assert.deepEqual(await page.locator('[data-nav]').evaluateAll(nodes => nodes.map(n => n.dataset.nav)), ['dashboard', 'work', 'northstar', 'overview']);
      assert.equal(await page.locator('#changes').isVisible(), false); assert.equal(await page.locator('#count').isVisible(), false);
      const href = await page.locator('link[rel="icon"]').getAttribute('href');
      assert.equal(decodeURIComponent(href.split(',')[1]), await readFile(join(here, 'favicon.svg'), 'utf8'));
      for (const id of ['mode-toggle', 'edit-body', 'body-toolbar', 'latest', 'rebase', 'refresh', 'editor']) assert.equal(await page.locator('#' + id).count(), 0);
      assert.deepEqual(await page.locator('.graph-tools button:not(#zoom-label)').allTextContents(), ['−', '+', '▣', '⟲', '⇄']);
      await shot('board');
    });
    await test('Initial fit contains cards; resizing and round trips preserve the camera', async () => {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 }); await page.reload(); await page.waitForFunction(() => graphReady);
        assert.equal(await page.evaluate(() => {
          const b = $('graph').getBoundingClientRect(); return [...$('graph-cards').children].every(el => {
            const c = el.getBoundingClientRect(); return c.x >= b.x && c.right <= b.right && c.y >= b.y && c.bottom <= b.bottom;
          });
        }), true);
        await page.evaluate(() => { pan = { x: 17, y: 29 }; scale = .7; transform(); });
        await sidebar('overview'); assert.equal(await page.evaluate(() => current), 'docdoki/spec_abstract.md');
        await board(); assert.deepEqual(await page.evaluate(() => [pan.x, pan.y, scale]), [17, 29, .7]);
      }
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.reload();
    });
    await test('Card frames select, field text edits and Open alone navigates', async () => {
      const card = page.locator(`[data-node="${A}"]`);
      await card.dblclick({ position: { x: 4, y: 4 } }); assert.equal(await page.evaluate(() => view), 'graph');
      assert.equal(await page.evaluate(() => selectedNode), A); assert.equal(await page.locator('#edge-detail').isVisible(), false);
      await card.focus(); await page.keyboard.press('Escape'); await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => selectedNode), A);
      await card.locator('[data-doc]').click(); assert.equal(await page.evaluate(() => view), 'doc');
      assert.match(await page.locator('#reading').innerText(), /An introduction[\s\S]*Second section/);
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      assert.equal(await page.getByRole('heading', { level: 1 }).evaluate(el => el === document.activeElement), true);
      await board();
    });
    await test('Native field editing has matching typography, no blue box or confirmation footer', async () => {
      await page.locator('#workspace').focus(); await page.keyboard.press('Escape');
      const title = page.locator(`[data-node="${A}"] .card-title`), box = await title.boundingBox();
      const font = await title.evaluate(el => { const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.fontWeight, parseFloat(s.lineHeight)]; });
      await field('title'); assert.equal(await page.locator('[data-apply-field],[data-cancel-field]').count(), 0);
      const editingFont = await input().evaluate(el => { const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.fontWeight, parseFloat(s.lineHeight)]; });
      assert.deepEqual(editingFont.slice(0, 3), font.slice(0, 3)); assert.ok(Math.abs(editingFont[3] - font[3]) < 1, 'Native input line-height rounding stays below one pixel');
      assert.equal(await input().evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      assert.ok(Math.abs((await input().boundingBox()).x - box.x) < 1);
      await input().fill('Cancelled'); await input().press('Escape'); assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await field('title'); await input().fill('A better title'); await input().press('Enter'); await page.waitForFunction(() => !fieldEditor);
      await field('purpose'); await input().fill('Keep this condition.\nAnd this one.');
      await page.evaluate(() => { window.nativeInput = fieldEditor.input; }); await language('zh');
      assert.equal(await page.evaluate(() => window.nativeInput === fieldEditor.input), true); assert.equal(await input().getAttribute('aria-label'), '摘要');
      await input().dispatchEvent('compositionstart'); await input().dispatchEvent('keydown', { key: 'Enter', isComposing: true });
      assert.equal(await input().isVisible(), true); await input().dispatchEvent('compositionend'); await shot('field');
      await changes(); await page.waitForFunction(() => !fieldEditor); assert.equal(await page.evaluate(() => store.drafts.size), 1);
      assert.equal(await readFile(join(info.root, A), 'utf8'), originals.get(A));
      await closeChanges(); await language('en'); await field('progress'); await input().selectOption('done'); await page.waitForFunction(() => !fieldEditor);
      assert.match(await page.locator(`[data-node="${A}"]`).innerText(), /Done/);
      await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /# A better title/);
      await writeFile(join(info.root, A), originals.get(A)); await page.reload();
    });
    await test('Blur stages a card edit without stealing focus; selecting a second field needs one click', async () => {
      await field('purpose'); await input().fill('A directly edited summary');
      await page.locator('#search').click(); await page.waitForFunction(() => !fieldEditor);
      assert.equal(await page.locator('#search').evaluate(el => el === document.activeElement), true);
      await field('title'); await input().fill('One click'); await field('purpose'); assert.equal(await input().inputValue(), 'A directly edited summary');
      await input().press('Escape'); await discard(); await closeChanges();
    });
    await test('Cancelled and refocused field responses cannot overwrite later input', async () => {
      await board(); const held = await hold('**/preview', r => !!r.postDataJSON().card);
      try {
        await field('title'); await input().fill('Late title'); await input().press('Enter'); await held.wait();
        await input().press('Escape'); held.release(); await page.waitForTimeout(50); assert.equal(await page.evaluate(() => store.drafts.size), 0);
      } finally { await held.close(); }
      const delayed = await hold('**/preview', r => !!r.postDataJSON().card);
      try {
        await field('title'); await input().fill('First input'); await input().press('Enter'); await delayed.wait();
        await input().fill('Second input'); delayed.release(); await page.waitForFunction(() => fieldEditor && !fieldEditor.pending);
        assert.equal(await input().inputValue(), 'Second input'); assert.equal(await page.evaluate(() => store.drafts.size), 0);
      } finally { await delayed.close(); }
      await fieldDone(); await discard(); await closeChanges();
    });
    await test('Failed field validation retains input and blocks navigation, Save and Copy', async () => {
      await board(); await field('purpose'); await input().fill('Keep this field');
      const fail = route => route.abort(); await page.route('**/preview', fail);
      try {
        await page.locator(`[data-node="${A}"] [data-doc]`).click(); await page.waitForFunction(() => fieldEditor?.input.hasAttribute('aria-invalid'));
        assert.equal(await page.evaluate(() => view), 'graph'); assert.equal(await input().inputValue(), 'Keep this field');
        await page.evaluate(() => save()); assert.equal(await page.evaluate(() => store.busy), false);
        await page.evaluate(() => copyPrompt()); assert.equal(await page.locator('#prompt').inputValue(), '');
      } finally { await page.unroute('**/preview', fail); }
      await fieldDone(); await discard(); await closeChanges();
    });
    await test('Real graph geometry, drag identity, direction, Connect cycles and explicit removal remain intact', async () => {
      await board();
      const card = page.locator(`[data-node="${B}"]`), box = await card.boundingBox();
      await page.mouse.move(box.x + 3, box.y + 3); await page.mouse.down(); await page.mouse.move(box.x + 43, box.y + 43, { steps: 4 });
      await page.evaluate(() => { window.dragNode = drag.element; }); await page.evaluate(() => updatePreview());
      assert.equal(await page.evaluate(() => drag.element === window.dragNode && drag.element.isConnected), true);
      await page.mouse.up(); assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await page.locator('#connect').click();
      await page.locator(`[data-node="${B}"]`).click({ position: { x: 4, y: 4 } }); await page.locator(`[data-node="${A}"]`).click({ position: { x: 4, y: 4 } });
      await page.waitForFunction(() => $('status').textContent.includes('cyc')); assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await page.keyboard.press('Escape'); await page.locator('#edge-lines .edge').first().dispatchEvent('click');
      assert.equal(await page.evaluate(() => store.drafts.size), 0); await page.locator('[data-remove-after]').click(); await page.waitForFunction(() => store.drafts.size === 1); await settled();
      assert.equal(await page.evaluate(() => store.drafts.size), 1); await undo();
      const routes = await page.evaluate(() => {
        const boxes = new Map([['a', {x:0,y:0,w:300,h:180}], ['b', {x:500,y:-120,w:300,h:180}], ['c', {x:500,y:140,w:300,h:180}]]);
        const fan = routeEdges([{from:'a',to:'b'}, {from:'a',to:'c'}], boxes); boxes.set('c', {x:0,y:400,w:300,h:180});
        const down = routeEdges([{from:'a',to:'c'}], boxes)[0]; return [fan[0].fromOffset !== fan[1].fromOffset, down.fromSide, down.toSide];
      }); assert.deepEqual(routes, [true, 'bottom', 'top']);
    });
    await test('Continuous live document keeps headings and inline styles while typing, without block inputs', async () => {
      await fixture(); const h = page.getByRole('heading', { level: 1 }), font = await h.evaluate(el => getComputedStyle(el).font);
      assert.equal(await page.locator('textarea.body-source').count(), 0); assert.equal(await page.locator('#source').getAttribute('contenteditable'), 'true');
      await replaceText('# Body', '# Human design'); assert.equal(await h.evaluate(el => getComputedStyle(el).font), font);
      await replaceText('A plain paragraph.', 'A **bold** paragraph with *emphasis*.');
      assert.equal(await page.locator('.md-strong').first().evaluate(el => getComputedStyle(el).fontWeight), '700');
      assert.equal(await page.locator('#source').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      assert.equal(await page.locator('#changes').isVisible(), false); assert.equal(await page.locator('#count').textContent(), '1');
      await leave(); assert.match(await source(), /# Human design/); assert.equal(await readFile(join(info.root, A), 'utf8'), rich);
      await shot('live-document');
    });
    await test('Real pointer selection crosses rendered paragraphs without exposing an input box', async () => {
      await fixture();
      const points = await page.evaluate(() => {
        const v = bodySurface.model.view, text = v.state.doc.toString();
        return [v.coordsAtPos(text.indexOf('plain paragraph.')), v.coordsAtPos(text.indexOf('Keep *this*'))];
      });
      await page.mouse.move(points[0].left, (points[0].top + points[0].bottom) / 2); await page.mouse.down();
      await page.mouse.move(points[1].left, (points[1].top + points[1].bottom) / 2, { steps: 12 }); await page.mouse.up();
      const selected = await page.evaluate(() => { const v = bodySurface.model.view, r = v.state.selection.main; return v.state.sliceDoc(r.from, r.to); });
      assert.equal(selected, 'plain paragraph.\n\n## Repeated\n\n');
      await page.keyboard.insertText('continuous text '); assert.match(await source(), /A continuous text Keep \*this\*/);
      await page.keyboard.press('ControlOrMeta+z'); assert.equal(await source(), rich);
    });
    await test('Formatting shortcuts and live task checkboxes make exact undoable source edits', async () => {
      await fixture(rich + '\r\n- [ ] Review design\r\n');
      await selectText('plain'); await page.keyboard.press('ControlOrMeta+b'); assert.match(await source(), /A \*\*plain\*\* paragraph/);
      await page.keyboard.press('ControlOrMeta+b'); assert.match(await source(), /A plain paragraph/);
      const task = page.getByRole('checkbox', { name: 'Review design' }); await task.check();
      assert.equal(await task.isChecked(), true); assert.match(await source(), /- \[x\] Review design/);
      await page.keyboard.press('ControlOrMeta+z'); assert.match(await source(), /- \[ \] Review design/);
      await leave(); assert.equal(await readFile(join(info.root, A), 'utf8'), rich + '\r\n- [ ] Review design\r\n');
    });
    await test('Cross-paragraph selection, undo and redo share one native editor through source switches', async () => {
      await fixture(); const selected = 'A plain paragraph.\n\n## Repeated\n\nKeep *this* spelling &amp; entity.';
      await replaceText(selected, 'A continuous replacement.'); assert.doesNotMatch(await source(), /Keep \*this\*/);
      await page.keyboard.press('ControlOrMeta+z'); assert.equal(await source(), rich);
      await page.keyboard.press('ControlOrMeta+Shift+z'); assert.match(await source(), /A continuous replacement/);
      await page.evaluate(() => { window.editorIdentity = bodySurface.model.view; window.selectionBeforeMode = bodySurface.model.view.state.selection.toJSON(); });
      await mode(true); assert.equal(await page.evaluate(() => bodySurface.model.view === window.editorIdentity), true);
      assert.deepEqual(await page.evaluate(() => bodySurface.model.view.state.selection.toJSON()), await page.evaluate(() => window.selectionBeforeMode));
      await page.locator('#source').focus(); await page.keyboard.press('ControlOrMeta+z'); assert.equal(await source(), rich);
      await mode(false); assert.equal(await page.evaluate(() => bodySurface.model.view === window.editorIdentity), true); await leave();
    });
    await test('Table cells stay laid out during real typing and keep exact Markdown delimiters', async () => {
      await fixture(); const cell = page.getByRole('cell').filter({ hasText: /^ 1 $/ });
      assert.equal(await cell.count(), 1); const box = await cell.boundingBox();
      await cell.click(); await page.keyboard.type('2');
      assert.equal(await page.getByRole('cell').count(), 2); assert.equal(await page.locator('.md-table-row').count(), 2);
      assert.ok(Math.abs((await page.getByRole('cell').last().boundingBox()).width - box.width) < 1);
      assert.match(await source(), /\| x \|[^\r\n]*2[^\r\n]*\|/);
      await leave(); assert.equal(await readFile(join(info.root, A), 'utf8'), rich); await shot('table');
    });
    await test('List continuation, literal Markdown paste and byte-preserving CRLF edits', async () => {
      await fixture(); await selectText('Second item'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await page.keyboard.type('Third item');
      assert.match(await source(), /- Second item\r\n- Third item/);
      await replaceText('A plain paragraph.', '中文 **加粗** 与 [链接](b.md).'); await leave();
      const text = await source(); assert.equal(text.slice(0, text.indexOf('中文')), rich.slice(0, rich.indexOf('A plain')));
      assert.equal(text.slice(text.indexOf('<!--')), rich.slice(rich.indexOf('<!--')));
      assert.equal(text.replace(/\r\n/g, '').includes('\n'), false);
      await saved(); assert.equal(await readFile(join(info.root, A), 'utf8'), text);
    });
    await test('Mixed line endings and source cancellation retain exact captured bytes', async () => {
      const mixed = rich.replace('A plain paragraph.\r\n\r\n', 'A plain paragraph.\n\n');
      await fixture(mixed); await replaceText('Second item', 'Changed item');
      assert.equal(await source(), mixed.replace('Second item', 'Changed item')); await mode(true);
      const before = await source(); await replaceText('Body editing', 'Temporary intent');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !bodyEditor);
      assert.equal(await source(), before); assert.equal(await readFile(join(info.root, A), 'utf8'), mixed);
    });
    await test('Live select-all cannot silently delete hidden frontmatter; full source can edit it', async () => {
      await fixture(); await page.locator('#source').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.insertText('Replacement body');
      assert.equal((await source()).split('# Body')[0].startsWith(rich.slice(0, rich.indexOf('# Body'))), true);
      assert.match(await source(), /Replacement body/); await mode(true);
      await replaceText('purpose: "Body editing"', 'purpose: "New intent"'); await leave(); assert.match(await source(), /purpose: "New intent" # keep this comment/);
    });
    await test('Shared frontmatter forms are protected in the real live editor, including unclosed metadata', async () => {
      const cases = JSON.parse(await readFile(join(here, 'frontmatter-cases.json'), 'utf8'));
      for (const c of cases) {
        await fixture(c.source);
        const before = await source();
        const start = await page.evaluate(() => DocDokiBody.bodyStart(bodySurface.model.view.state.doc.toString()));
        const expected = c.error ? c.source.length : c.source.length - c.body.length;
        assert.equal(start, c.source.slice(0, expected).replace(/\r\n/g, '\n').length, c.name);
        if (start) {
          await page.locator('#source').focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Backspace');
          assert.equal((await source()).slice(0, expected), before.slice(0, expected), c.name + ' metadata bytes protected');
        }
        await mode(true);
        assert.equal(await page.evaluate(() => sourceMode), true);
      }
    });
    await test('Literal underscore and formatted heading anchors agree; empty cells retain real column geometry', async () => {
      await fixture('# Body\n\n## API_v2\n\n## **API_v2**\n\n|A|B|C|\n|---|---|---|\n|one||three|\n||two||\n');
      assert.equal(await page.locator('#heading-api_v2').count(), 1);
      assert.equal(await page.locator('#heading-api_v2-1').count(), 1);
      assert.equal(await page.evaluate(() => bodySurface.model.jump('api_v2-1')), true);
      const rows = page.locator('.md-table-row');
      for (let i = 0; i < 3; i++) assert.equal(await rows.nth(i).locator('.md-table-cell').count(), 3, 'three cells in row ' + i);
      const geometry = await rows.evaluateAll(rows => rows.map(row => [...row.querySelectorAll('.md-table-cell')].map(c => ({ x: c.getBoundingClientRect().x, width: c.getBoundingClientRect().width }))));
      for (const row of geometry.slice(1)) for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(row[i].x - geometry[0][i].x) < 1); assert.ok(Math.abs(row[i].width - geometry[0][i].width) < 1);
      }
      await rows.nth(1).locator('.md-table-cell').nth(1).click(); await page.keyboard.insertText('middle');
      assert.match(await source(), /\|one\|middle\|three\|/);
      await leave(); await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /\|one\|middle\|three\|/);
    });
    await test('Real editor links and dependency removal have keyboard equivalents', async () => {
      await fixture('# Body\n\n[validation](b.md)\n');
      const link = page.locator('#reading [role="link"]').first(); await link.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(p => current === p, B);
      await fixture('# Body\n\n[validation](b.md)\n');
      await selectText('validation'); await page.keyboard.insertText('checks');
      assert.equal(await source(), '# Body\n\n[checks](b.md)\n');
      assert.equal(await page.evaluate(() => current), A, 'Editing link text is not navigation');
      await leave(); await discard(); await board();
      const edge = page.locator('.edge-hit').first();
      assert.equal(await edge.getAttribute('role'), 'button'); await edge.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.hasAttribute('data-remove-after'));
      await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.matches('.edge-hit')), true);
      await page.keyboard.press('Space'); await page.waitForFunction(() => document.activeElement?.hasAttribute('data-remove-after'));
      const path = await page.locator('[data-remove-after]').getAttribute('data-path');
      await page.keyboard.press('Enter'); await settled();
      await page.waitForFunction(p => store.drafts.has(p), path);
      assert.equal(await page.locator('#edge-detail').isVisible(), false); await discard(path);
    });
    await test('Source and live views use the same paper width and preserve the visible content anchor', async () => {
      const long = rich + Array.from({ length: 35 }, (_, i) => `\r\n## Section ${i}\r\n\r\nLong paragraph ${i} with readable content.\r\n`).join('');
      await fixture(long);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => { $('workspace').scrollTop = 650; }); await page.waitForTimeout(100);
        const paper = await page.locator('#reading').boundingBox();
        const mark = await page.evaluate(() => bodySurface.model.bookmark());
        await mode(true); await page.waitForTimeout(100);
        const after = await page.locator('#reading').boundingBox(); assert.equal(after.x, paper.x); assert.equal(after.width, paper.width);
        const y = await page.evaluate(pos => bodySurface.model.view.coordsAtPos(pos)?.top, mark.pos); assert.ok(Math.abs(y - mark.top) < 5, `Anchor at ${width}: ${y} vs ${mark.top}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('source-' + width);
        await mode(false); await shot('live-' + width);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      assert.equal(await page.evaluate(() => bodySurface.model.jump('Section 34')), true); await page.waitForTimeout(150);
      const heading = await page.locator('#heading-section-34').boundingBox(), bar = await page.locator('.source-bar').boundingBox();
      assert.ok(heading.y >= bar.y + bar.height - 1 && heading.y < 1000, 'Offscreen anchors scroll into the reading viewport');
    });
    await test('Document endings stay compact and related navigation is visibly outside the editor', async () => {
      const short = '# End boundary\n\nFinal sentence.\n', before = await readFile(join(info.root, B), 'utf8');
      try {
        await writeFile(join(info.root, B), short); await fixture(); await open(B);
        for (const width of [1440, 320]) {
          await page.setViewportSize({ width, height: 900 });
          for (const isSource of [false, true]) {
            await mode(isSource);
            const metrics = await page.evaluate(() => {
              const reading = $('reading').getBoundingClientRect(), related = $('related').getBoundingClientRect();
              return { height: reading.height, gap: related.top - reading.bottom,
                outside: !$('reading').contains($('related')) && !$('related').querySelector('[contenteditable]'),
                tag: $('related').tagName, background: getComputedStyle($('related')).backgroundColor,
                overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.ok(metrics.height < 200, 'Short documents do not get artificial blank pages');
            assert.ok(metrics.gap >= 12 && metrics.gap <= 20, 'Compact, explicit document/navigation boundary');
            assert.equal(metrics.outside, true); assert.equal(metrics.tag, 'ASIDE');
            assert.equal(metrics.background, 'rgb(241, 241, 236)'); assert.equal(metrics.overflow, false);
            await page.locator('#related summary').click(); assert.equal(await page.locator('#related details').getAttribute('open'), '');
            await page.locator('#related summary').click(); assert.equal(await source(), short);
          }
        }
        await page.locator('#related summary').click(); await page.locator(`#related [data-doc="${A}"]`).click();
        await page.waitForFunction(p => current === p, A);
        assert.equal(await page.evaluate(() => store.drafts.size), 0);
      } finally {
        await writeFile(join(info.root, B), before); await page.setViewportSize({ width: 1440, height: 1000 });
      }
    });
    await test('IME boundaries and localization never replace the focused editor or save composition', async () => {
      await fixture(); await selectText('A plain paragraph.'); await page.evaluate(() => { window.inputIdentity = $('source'); });
      await page.locator('#source').dispatchEvent('compositionstart'); await page.locator('#source').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
      await page.evaluate(() => save()); assert.equal(await page.evaluate(() => store.busy), false);
      await page.locator('#source').dispatchEvent('compositionend'); await page.keyboard.insertText('输入法边界');
      await language('zh'); assert.equal(await page.evaluate(() => $('source') === window.inputIdentity), true);
      await language('en'); await leave(); assert.match(await source(), /输入法边界/);
    });
    await test('One-click document links and repeated/Unicode anchors survive editing; HTML and images stay inert', async () => {
      await fixture(rich + '\r\n## 目标\r\n\r\n[Jump](#%E7%9B%AE%E6%A0%87)\r\n\r\n[Second](#repeated-1)\r\n\r\n<img src="https://example.org/no">\r\n\r\n![remote](https://example.org/no.png)\r\n');
      await page.locator('#reading [role="link"]').filter({ hasText: 'Jump' }).click();
      await page.waitForTimeout(100); assert.ok(await page.locator('#heading-目标').isVisible());
      await page.locator('#reading [role="link"]').filter({ hasText: 'Second' }).click(); assert.ok(await page.locator('#heading-repeated-1').isVisible());
      assert.equal(await page.locator('#reading img:not(.cm-widgetBuffer), #reading script').count(), 0); assert.equal(network.length, 0);
      await page.locator('#reading [role="link"]').filter({ hasText: 'validation' }).click(); await page.waitForFunction(p => current === p, B);
      await open(); await page.locator('#reading [role="link"]').filter({ hasText: 'reference' }).click(); await page.waitForFunction(p => current === p, B);
    });
    await test('Delayed body application rejects continued input and refocus, including equal text', async () => {
      for (const action of ['type', 'refocus']) {
        await fixture(); await replaceText('A plain paragraph.', 'First body edit');
        const held = await hold('**/preview');
        try {
          await page.locator('#document-path').click(); await held.wait(); await page.locator('#source').focus();
          if (action === 'type') await page.keyboard.insertText(' newer');
          held.release(); await page.waitForFunction(() => bodyEditor && !bodyEditor.pending);
          assert.equal(await page.evaluate(() => store.drafts.size), 0); assert.equal(await page.locator('#source').evaluate(el => el === document.activeElement), true);
        } finally { await held.close(); }
        await leave(); assert.equal(await page.evaluate(() => store.drafts.size), 1);
      }
    });
    await test('Preview failure retains exact text and blocks navigation, presentation changes, Copy and Save', async () => {
      await fixture(); await replaceText('A plain paragraph.', 'Retained on error'); const fail = route => route.abort(); await page.route('**/preview', fail);
      try {
        await page.locator('#source-view').click(); await page.waitForFunction(() => $('reading').hasAttribute('aria-invalid'));
        assert.equal(await page.evaluate(() => sourceMode), false); assert.match(await source(), /Retained on error/);
        await page.evaluate(p => openDocument(p), B); assert.equal(await page.evaluate(() => current), A);
        await page.evaluate(() => copyPrompt()); assert.equal(await page.locator('#prompt').inputValue(), '');
        await page.evaluate(() => save()); assert.equal(await readFile(join(info.root, A), 'utf8'), rich);
      } finally { await page.unroute('**/preview', fail); }
      await leave(); await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /Retained on error/);
    });
    await test('Navigation waits for the captured full-source preview and does not steal newer focus', async () => {
      await fixture(); await replaceText('A plain paragraph.', 'Before navigation'); const held = await hold('**/preview');
      try {
        await page.locator(`#catalog [data-doc="${B}"]`).click(); await held.wait(); assert.equal(await page.evaluate(() => current), A);
        held.release(); await page.waitForFunction(p => current === p && !bodyEditor, B); assert.match(await page.evaluate(p => store.source(p), A), /Before navigation/);
      } finally { await held.close(); }
    });
    await test('Active buffers block automatic adoption, and conflicts preserve all three full sources', async () => {
      await fixture(); const held = await hold('**/snapshot');
      try {
        await page.evaluate(() => { window.oldStore = store; window.sync = syncDocuments(); }); await held.wait();
        await replaceText('A plain paragraph.', 'Human body'); held.release(); await page.evaluate(() => window.sync);
        assert.equal(await page.evaluate(() => store === window.oldStore), true); assert.match(await source(), /Human body/);
      } finally { await held.close(); }
      const external = rich + '\r\nExternal requirement.\r\n'; await writeFile(join(info.root, A), external);
      await page.evaluate(() => syncDocuments()); assert.match(await source(), /Human body/);
      await leave(); await page.evaluate(() => syncDocuments()); await changes();
      assert.equal(await page.locator('.conflict').isVisible(), true); assert.equal(await page.locator('#save').isDisabled(), true);
      const prompt = await page.evaluate(() => buildPrompt()); assert.match(prompt, /Human body/); assert.match(prompt, /EXTERNAL VERSION[\s\S]*External requirement/);
      assert.equal(await readFile(join(info.root, A), 'utf8'), external); await discard(); assert.equal(await source(), external); assert.equal(await page.evaluate(() => store.undo()), null);
    });
    await test('A pending document response cannot cross a DraftStore or equal-text adoption', async () => {
      for (const swap of [true, false]) {
        await fixture(); await replaceText('A plain paragraph.', 'Pending source'); const held = await hold('**/preview');
        try {
          await page.locator('#document-path').click(); await held.wait();
          await page.evaluate(swap => { if (swap) store = new DraftStore(graph.documents); else store.discard(current, store.base.get(current)); }, swap);
          held.release(); await page.waitForFunction(() => bodyEditor && !bodyEditor.pending);
          assert.equal(await page.evaluate(() => store.drafts.size), 0); assert.match(await source(), /Pending source/);
        } finally { await held.close(); }
      }
    });
    await test('Saving locks editor transactions, adopts disk sources and retains the follow receipt', async () => {
      await fixture(); await replaceText('A plain paragraph.', 'Saved source'); await leave(); const held = await hold('**/save');
      try {
        await changes(); await page.locator('#save').click(); await held.wait();
        assert.equal(await page.evaluate(() => store.busy), true);
        const before = await source(); await page.evaluate(() => bodySurface.model.view.dispatch({ changes: { from: 0, insert: 'Rejected' } })); assert.equal(await source(), before);
        assert.equal(await page.locator('#connect').isDisabled(), true); assert.equal(await page.evaluate(p => store.set(p, 'lost'), A), false);
        held.release(); await page.waitForFunction(() => !store.busy && !store.drafts.size); await settled();
        assert.equal(await source(), await readFile(join(info.root, A), 'utf8')); assert.match(await page.evaluate(() => buildPrompt()), /SAVED — chronological/);
      } finally { await held.close(); }
      await page.evaluate(() => syncDocuments()); assert.match(await page.evaluate(() => buildPrompt()), /SAVED — chronological/);
    });
    await test('Copy includes all saved changes plus unsaved edits with the latest disk preconditions', async () => {
      await fixture();
      await edit(A, s => s + '\nSaved A first\n'); await saved();
      await edit(B, s => s + '\nUnsaved B\n');
      let prompt = await page.evaluate(() => buildPrompt());
      assert.match(prompt, /SAVED — chronological/); assert.match(prompt, /Saved A first/); assert.match(prompt, /UNSAVED —/); assert.match(prompt, /Unsaved B/);
      await saved(); await edit(A, s => s + '\nSaved A second\n'); await saved();
      const baseline = await readFile(join(info.root, A), 'utf8');
      await edit(A, s => s + '\nUnsaved A third\n');
      prompt = await page.evaluate(() => buildPrompt());
      assert.match(prompt, /Saved A first/); assert.match(prompt, /Saved A second/); assert.match(prompt, /Unsaved B/);
      assert.ok(prompt.includes('--- CAPTURED DISK BASELINE (CHECK BEFORE WRITING) ---\n' + baseline + '\n--- AFTER ---'));
      await page.evaluate(() => { store.receipt.push({ path: 'docdoki/private/notes/x.md', from: 'old', to: 'new', private: true }); warnPrivate(); });
      assert.equal(await page.locator('#private-warning').getAttribute('hidden'), null);
      await discard();
    });
    await test('Unknown save outcomes and clipboard failures expose recovery without dropping drafts', async () => {
      await edit(A, s => s + '\r\nUnconfirmed save.\r\n'); const fail = async route => { await route.fetch(); await route.abort(); }; await page.route('**/save', fail);
      try { await changes(); await page.locator('#save').click(); await page.waitForFunction(() => !store.busy && saveFailure?.unknown); }
      finally { await page.unroute('**/save', fail); }
      assert.equal(await page.locator('#export').isVisible(), true); assert.match(await page.evaluate(() => buildPrompt()), /some edits may already be on disk/);
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
      await page.locator('#copy-agent').click(); assert.equal(await page.locator('#prompt').isVisible(), true); assert.match(await page.locator('#prompt').inputValue(), /Unconfirmed save/);
      await discard();
    });
    await test('Stale clipboard results and path feedback never label a newer edit or document', async () => {
      await fixture(); await edit(A, s => s + '\r\nDraft one.\r\n'); await changes();
      await page.evaluate(() => { navigator.clipboard.writeText = () => new Promise((_, reject) => { window.rejectCopy = reject; }); });
      await page.locator('#copy-agent').click(); await page.waitForFunction(() => !!window.rejectCopy); await closeChanges();
      await page.locator('#source').focus(); await page.keyboard.type('New typing'); await page.evaluate(() => window.rejectCopy(new Error('late')));
      assert.equal(await page.locator('#prompt').isVisible(), false); await leave();
      await page.evaluate(() => { navigator.clipboard.writeText = () => new Promise(resolve => { window.copyPath = resolve; }); });
      await page.locator('#document-path').click(); await open(B); await page.evaluate(() => window.copyPath());
      assert.equal(await page.locator('#document-path').evaluate(el => el.classList.contains('copied')), false);
      await page.evaluate(() => { navigator.clipboard.writeText = async () => {}; });
      await page.locator('#document-path').click(); await page.waitForFunction(() => $('document-path').classList.contains('copied'));
    });
    await test('Discard refuses to erase typing that began while the latest-source read was pending', async () => {
      await fixture(); await edit(A, s => s + '\r\nDiscard candidate.\r\n'); const held = await hold('**/document?path=**');
      try {
        await changes(); await page.locator(`[data-discard="${A}"]`).click(); await held.wait(); await closeChanges();
        await replaceText('A plain paragraph.', 'Newer human text'); held.release();
        await page.waitForFunction(() => $('status').textContent.includes('Editing continued')); assert.match(await source(), /Newer human text/);
      } finally { await held.close(); }
      await leave(); await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /Newer human text/);
    });
    await test('Dependency responses cannot cross snapshot replacement, typing or equal-text discard', async () => {
      for (const action of ['snapshot', 'typing', 'discard']) {
        await fixture('---\nafter: []\n---\n# Export\n\nKeep original.\n');
        await writeFile(join(info.root, C), '---\nafter: []\n---\n# Publication\n'); await page.reload();
        if (action === 'discard') await edit(A, s => s + '\nDraft\n');
        const held = await hold('**/preview', r => !!r.postDataJSON().after);
        try {
          await page.evaluate(p => { window.dependencyRequest = changeDependency(p, 'c', false); }, A); await held.wait();
          if (action === 'snapshot') { await writeFile(join(info.root, A), (await readFile(join(info.root, A), 'utf8')) + '\nExternal retention\n'); await page.evaluate(() => syncDocuments()); }
          else if (action === 'typing') await edit(A, s => s + '\nLater typing\n');
          else { await writeFile(join(info.root, A), await page.evaluate(p => store.source(p), A)); await discard(); }
          held.release(); await page.evaluate(() => window.dependencyRequest); assert.match(await page.evaluate(p => store.source(p), A), /after: \[\]/);
          if (action === 'snapshot') assert.match(await page.evaluate(p => store.source(p), A), /External retention/);
          if (action === 'typing') assert.match(await page.evaluate(p => store.source(p), A), /Later typing/);
        } finally { await held.close(); }
      }
      await rm(join(info.root, C), { force: true });
    });
    await test('Fields and dependencies use canonical drafts even when a background graph preview is stale', async () => {
      await fixture('---\nafter: []\npurpose: Original\n---\n# Export\n');
      await writeFile(join(info.root, B), '---\nafter: []\n---\n# Validation\n');
      await writeFile(join(info.root, C), '---\nafter: []\n---\n# Publication\n'); await page.reload();
      await edit(A, s => s.replace('after: []', 'after: [b]').replace('purpose: Original', 'purpose: Typed in source'));
      assert.match(await page.evaluate(p => store.source(p), A), /purpose: Typed in source/);
      const held = await hold('**/preview', r => !r.postDataJSON().card && !r.postDataJSON().after);
      try {
        await page.evaluate(() => { window.backgroundPreview = updatePreview(); }); await held.wait(); await board();
        await field('purpose'); assert.equal(await input().inputValue(), 'Typed in source'); await input().fill('Card extension'); await fieldDone();
        await page.evaluate(p => changeDependency(p, 'c', false), A); held.release(); await page.evaluate(() => window.backgroundPreview);
        assert.match(await page.evaluate(p => store.source(p), A), /after: \["b", "c"\]/); assert.match(await page.evaluate(p => store.source(p), A), /Card extension/);
      } finally { await held.close(); }
      await rm(join(info.root, C), { force: true });
    });
    await test('Clean automatic updates preserve reading position; private notes and archives remain reachable', async () => {
      await fixture(rich + '\r\n' + 'More reading.\r\n\r\n'.repeat(30)); await leave();
      await page.evaluate(() => { $('workspace').scrollTop = 120; }); const scroll = await page.locator('#workspace').evaluate(el => el.scrollTop);
      await writeFile(join(info.root, A), (await source()) + '\r\nFresh on focus.\r\n'); await page.evaluate(() => syncDocuments());
      assert.equal(await page.locator('#workspace').evaluate(el => el.scrollTop), scroll); assert.match(await source(), /Fresh on focus/);
      await open('docdoki/notes/evidence.md'); assert.match(await page.locator('#reading').innerText(), /useful observation/);
      await page.locator('#catalog details summary').click(); await open('docdoki/stages/archive/follow-old.md'); assert.match(await page.locator('#reading').innerText(), /Archived knowledge/);
      await sidebar('work'); assert.match(await page.locator('#reading').innerText(), /Local work/);
      const path = 'docdoki/private/specs/local.md'; await edit(path, s => s + '\nPrivate adjustment\n'); await changes();
      await page.locator('#copy-agent').click(); assert.equal(await page.locator('#private-warning').isVisible(), true); assert.match(await page.evaluate(() => buildPrompt()), /\[PRIVATE\]/);
      assert.ok((await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])).every(k => k === 'ddpanel-lang')); await discard(path);
    });
    await test('Phone/landscape layouts, equal-width peer controls, keyboard focus and touch remain usable', async () => {
      for (const [width, height] of [[1440, 1000], [844, 390], [390, 900], [320, 900]]) {
        await page.setViewportSize({ width, height }); await board();
        for (const locale of ['zh', 'en']) {
          await language(locale); const w = await equalWidths('#zoom-out,#zoom-in,#fit,#reset-layout,#connect');
          await equalWidths('.card-foot>[data-doc]'); await equalWidths('.card-foot>.progress-label');
          await page.locator('#zoom-label').click(); assert.equal(await page.locator('#fit').isDisabled(), true);
          assert.equal(await page.locator('#zoom-label').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)');
          await page.locator('#zoom-label').click(); assert.equal(await equalWidths('#zoom-out,#zoom-in,#fit,#reset-layout,#connect'), w);
          assert.equal(await page.locator('.graph-tools').evaluate(el => { const b = el.getBoundingClientRect(); return b.x >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }), true);
          await open(); await mode(true); const path = await page.locator('#document-path').boundingBox(), icon = await page.locator('#source-view').boundingBox();
          assert.ok(Math.abs(icon.x - path.x - path.width - 8) < 1); assert.ok(icon.x + icon.width <= width);
          await mode(false); assert.equal(await page.locator('#source').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
          await changes(); assert.equal(await page.locator('#workspace').evaluate(el => el.inert), true);
          await page.keyboard.press('Escape'); assert.equal(await page.locator('#changes-toggle').evaluate(el => el === document.activeElement), true);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await board();
        }
      }
      if (engine !== 'firefox') {
        await open(); const before = await source(); await page.locator('#source').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 17, clientX: 100, clientY: 300 });
        await page.locator('#source').dispatchEvent('pointercancel', { pointerType: 'touch', pointerId: 17 }); assert.equal(await source(), before);
      }
      await shot('phone');
    });
    await test('A library above 1 MiB can stage and save fields, body and dependencies with bounded requests', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const large = Array.from({ length: 65 }, (_, i) => `docdoki/stages/large-${i}.md`);
      try {
        await Promise.all(large.map((p, i) => writeFile(join(info.root, p), `# Stage ${i}\n\n` + 'ordinary content '.repeat(1024))));
        await writeFile(join(info.root, B), originals.get(B)); await fixture(); await board();
        assert.ok(await page.evaluate(() => [...store.base.values()].reduce((n, d) => n + d.source.length, 0) > 1048576));
        const sizes = [], capture = r => { if (r.url().endsWith('/preview')) sizes.push(r.postDataBuffer().length); };
        page.on('request', capture);
        try {
          await field('title'); await input().fill('Large-library field'); await fieldDone();
          await open(); await replaceText('A plain paragraph.', 'Large-library body.'); await leave();
          await board();
          const edgeIndex = await page.evaluate(p => edgeViews.findIndex(e => e.to === p), B);
          await page.locator(`.edge-hit[data-edge="${edgeIndex}"]`).focus(); await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.activeElement?.hasAttribute('data-remove-after'));
          await page.keyboard.press('Enter'); await page.waitForFunction(p => store.drafts.has(p), B); await settled();
          await saved();
          assert.match(await readFile(join(info.root, A), 'utf8'), /Large-library field/);
          assert.match(await readFile(join(info.root, A), 'utf8'), /Large-library body/);
          assert.ok(!(await readFile(join(info.root, B), 'utf8')).includes("after: ['a']"));
          assert.ok(sizes.length >= 3 && Math.max(...sizes) < 30000, 'preview bytes depend on refs and edits, not repeated library text');
          console.log('MEASURE large-library preview max bytes:', Math.max(...sizes));
        } finally { page.off('request', capture); }
      } finally { await Promise.all(large.map(p => rm(join(info.root, p)))); }
    });
    await test('Long-document cursor and input work is measured in the real editor', async () => {
      const text = '# Long document\n\n' + Array.from({ length: 800 }, (_, i) => `## Section ${i}\n\nParagraph ${i}: ` + 'ordinary words '.repeat(12) + '[[b|validation]] and [reference][ref].\n\n').join('') + '[ref]: b.md\n';
      await fixture(text); await page.waitForTimeout(500);
      const timing = await page.evaluate(async () => {
        const v = bodySurface.model.view, cursor = [], input = [], lexer = markdown.lexer;
        let lexerCalls = 0;
        markdown.lexer = (...args) => { lexerCalls++; return lexer.apply(markdown, args); };
        v.focus();
        let cursorLexerCalls;
        try {
          for (let i = 0; i < 30; i++) {
            const start = performance.now(); v.dispatch({ selection: { anchor: 25 + i } }); cursor.push(performance.now() - start);
            await new Promise(requestAnimationFrame);
          }
          cursorLexerCalls = lexerCalls;
          for (let i = 0; i < 30; i++) {
            const start = performance.now(); v.dispatch({ changes: { from: 25 + i, insert: 'x' } }); input.push(performance.now() - start);
            await new Promise(requestAnimationFrame);
          }
        } finally { markdown.lexer = lexer; }
        const stats = values => { values.sort((a, b) => a - b); return { p50: values[15], p95: values[28] }; };
        return { chars: v.state.doc.length, cursor: stats(cursor), input: stats(input), cursorLexerCalls };
      });
      console.log('MEASURE long document dispatch ms:', JSON.stringify(timing));
      assert.equal(timing.cursorLexerCalls, 0, 'Cursor movement reuses unchanged reference definitions');
      assert.ok((await source()).length > text.length);
    });
    assert.deepEqual(network, [], 'All runtime assets and document rendering stay offline');
  } finally {
    for (const [path, source] of originals) await writeFile(join(info.root, path), source);
    await context.close(); await browser.close(); helper.kill();
  }
}
console.log(`\n${checks} checks passed.`);
