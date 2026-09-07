#!/usr/bin/env node
/* Pure state checks; --browser exercises the real local server in temporary
   libraries. Optional Playwright, fixtures and screenshots are not skill assets. */
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const sandbox = { globalThis: {}, console };
vm.runInNewContext(await readFile(join(here, 'state.js'), 'utf8'), sandbox);
const { DraftStore, diffOps, diffHTML } = sandbox.globalThis.DocDokiState;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS', name); }
const docs = { A: { source: 'A0', path: 'A' }, B: { source: 'B0', path: 'B' } };
check('A1 → B1 → A2 undo is chronological', () => {
  const s = new DraftStore(docs);
  s.set('A', 'A1'); s.set('B', 'B1'); s.set('A', 'A2');
  assert.equal(s.undo(), 'A'); assert.equal(s.source('A'), 'A1'); assert.equal(s.source('B'), 'B1');
  assert.equal(s.undo(), 'B'); assert.equal(s.source('B'), 'B0');
  s.undo(); assert.equal(s.drafts.size, 0);
});
check('Escape cancels only the active editing session', () => {
  const s = new DraftStore(docs);
  s.set('A', 'A1'); s.begin('A'); s.update('A2'); s.end(true);
  assert.equal(s.source('A'), 'A1'); s.undo(); assert.equal(s.source('A'), 'A0');
});
check('Save locks mutations and adopts actual stored sources', () => {
  const s = new DraftStore(docs); s.set('A', 'A1');
  assert.equal(s.startSave()[0].to, 'A1'); assert.equal(s.startSave(), null);
  assert.equal(s.set('A', 'A2'), false); s.undo(); s.discard('A', docs.A); assert.equal(s.source('A'), 'A1');
  s.finishSave({ ok: true, documents: { A: { source: 'A1 normalized', path: 'A' } }, receipt: [{ path: 'A', from: 'A0', to: 'A1 normalized' }] });
  assert.equal(s.drafts.size, 0); assert.equal(s.source('A'), 'A1 normalized');
  s.set('A', 'A2'); assert.equal(s.edits()[0].from, 'A1 normalized'); assert.equal(s.receipt.length, 1);
});
check('Failed saves retain drafts, history and original source', () => {
  const s = new DraftStore(docs); s.set('A', 'A1'); s.startSave(); s.finishSave({ ok: false });
  assert.equal(s.source('A'), 'A1'); assert.equal(s.edits()[0].from, 'A0'); s.undo(); assert.equal(s.drafts.size, 0);
});
check('Discard adopts disk, advances version even for equal text, and cannot undo across adoption', () => {
  const s = new DraftStore(docs); let version = s.version;
  assert.equal(s.discard('A', docs.A), true); assert.ok(s.version > version);
  s.set('A', 'A1'); s.set('B', 'B1'); version = s.version;
  s.discard('A', { path: 'A', source: 'A1' }); assert.ok(s.version > version);
  assert.equal(s.source('A'), 'A1'); assert.equal(s.drafts.has('A'), false);
  assert.equal(s.undo(), 'B'); assert.equal(s.undo(), null); assert.equal(s.source('A'), 'A1');
  s.set('A', 'A2'); s.discard('A', { path: 'A', source: 'external A' });
  assert.equal(s.source('A'), 'external A'); assert.equal(s.drafts.size, 0);
  s.set('A', 'A3'); s.startSave(); version = s.version;
  assert.equal(s.discard('A', null), false); assert.equal(s.version, version);
  s.finishSave({ ok: false }); s.discard('A', null);
  assert.equal(s.base.has('A'), false); assert.equal(s.drafts.size, 0);
});
check('CRLF source edits preserve line endings', () => {
  const s = new DraftStore({ A: { source: 'A\r\nB\r\n' } }); s.begin('A'); s.update('A\nC\n'); s.end();
  assert.equal(s.source('A'), 'A\r\nC\r\n');
});
check('Diff is bounded, complete and HTML-safe', () => {
  const a = Array.from({ length: 4000 }, (_, i) => 'old ' + i).join('\n');
  const b = Array.from({ length: 4000 }, (_, i) => 'new ' + i).join('\n');
  const start = performance.now(), html = diffHTML(a, b);
  assert.ok(performance.now() - start < 1000); assert.ok(html.includes('<details open'));
  assert.ok(html.includes('new 3999')); assert.ok(html.includes('old 3999'));
  assert.ok(diffHTML('a\nb', 'a\n<script>').includes('&lt;script&gt;'));
  assert.ok(diffHTML('same words old', 'same words new').includes('<ins>new</ins>'));
  assert.equal(diffOps(['x'], ['x']).length, 1);
});

if (process.argv.includes('--browser')) {
  const engines = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
  const engine = process.env.PANEL_BROWSER || 'chromium';
  assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
  const browser = await engines[engine].launch({ headless: true });
  const helper = spawn(process.env.PYTHON || 'python3', ['-B', join(here, 'selftest.py'), '--serve'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = createInterface({ input: helper.stdout });
  const info = await new Promise((resolve, reject) => {
    lines.once('line', line => { try { resolve(JSON.parse(line)); } catch (error) { reject(error); } });
    helper.once('error', reject); helper.once('exit', code => reject(new Error('Fixture server exited: ' + code)));
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: engine !== 'firefox' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const A = 'docdoki/specs/a.md', B = 'docdoki/specs/b.md', C = 'docdoki/specs/c.md';
  async function test(name, fn) { await fn(); checks++; console.log(`PASS ${engine}:`, name); }
  async function closeChanges() { if (await page.locator('#changes').isVisible()) await page.locator('#changes-close').click(); }
  async function changes() { if (!(await page.locator('#changes').isVisible())) await page.locator('#changes-toggle').click(); }
  async function open(path) {
    await closeChanges();
    await page.waitForFunction(() => document.getElementById('library-toggle').getAttribute('aria-expanded') === String(innerWidth <= 760 ? document.getElementById('app').classList.contains('library-open') : !document.getElementById('app').classList.contains('library-closed')));
    if (await page.locator('#library-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#library-toggle').click();
    await page.locator(`#catalog [data-doc="${path}"]`).first().click();
    await page.waitForFunction(p => current === p && view === 'doc', path);
  }
  async function mode(value) {
    await closeChanges();
    assert.equal(await page.evaluate(() => view), 'doc', 'Source presentation is local to a document');
    if (await page.evaluate(() => sourceMode) !== value) await page.locator('#source-view').click();
    await page.waitForFunction(value => sourceMode === value && !previewPending, value);
  }
  async function language(value) {
    if (await page.evaluate(() => lang) !== value) await page.locator('#language').click();
    await page.waitForFunction(v => lang === v, value);
  }
  async function equalButtonWidths(selector) {
    const sizes = await page.locator(selector).evaluateAll(buttons => buttons.map(button => ({
      width: button.getBoundingClientRect().width, text: button.textContent,
      client: button.clientWidth, scroll: button.scrollWidth,
    })));
    assert.ok(sizes.length >= 2 && sizes.every(s => s.width > 0), selector);
    assert.ok(sizes.every(s => Math.abs(s.width - sizes[0].width) < .15), selector + ': ' + JSON.stringify(sizes));
    assert.ok(sizes.every(s => s.scroll <= s.client + 1), 'Button labels fit: ' + selector);
    return sizes[0].width;
  }
  async function edit(path, transform) {
    await open(path); await mode(true);
    await page.locator('#source').fill(transform(await page.locator('#source').inputValue()));
    await page.locator('#document-path').click();
    await page.waitForFunction(() => !previewPending);
  }
  async function saved() {
    await changes(); await page.locator('#save').click();
    await page.waitForFunction(() => !store.busy && !store.drafts.size && !previewPending);
  }
  async function discard(path) {
    await changes(); await page.locator(`[data-discard="${path}"]`).click();
    await page.waitForFunction(p => !store.drafts.has(p) && !previewPending, path);
  }
  async function undo() { await closeChanges(); await page.locator('#workspace').focus(); await page.keyboard.press('ControlOrMeta+z'); await page.waitForFunction(() => !previewPending); }
  async function selectCard(path) { await page.locator(`#graph-cards [data-node="${path}"]`).click({ position: { x: 4, y: 4 } }); }
  async function sidebar(name) {
    await closeChanges();
    if (await page.locator('#library-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#library-toggle').click();
    await page.locator(`[data-nav="${name}"]`).click();
  }
  async function board() { await sidebar('dashboard'); await page.waitForFunction(() => view === 'graph'); }
  async function shot(name) {
    if (process.env.PANEL_SCREENSHOT) await page.screenshot({ path: process.env.PANEL_SCREENSHOT.replace(/\.png$/, `-${name}.png`), fullPage: true });
  }
  async function dependency(path, stem) {
    await board();
    await page.locator('#connect').click();
    const upstream = await page.evaluate(s => graph.nodes.find(n => n.stem === s).path, stem);
    await selectCard(upstream); await selectCard(path);
  }
  async function pickEdge(path, stem) {
    const index = await page.evaluate(([p, s]) => edgeViews.findIndex(e => e.to === p && e.stem === s), [path, stem]);
    await page.locator(`#edge-lines .edge[data-edge="${index}"]`).dispatchEvent('click');
  }
  async function hold(routePattern, predicate = () => true) {
    let release, arrived = false, failure;
    const gate = new Promise(resolve => { release = resolve; });
    const handler = async route => {
      if (!predicate(route.request())) return route.continue();
      try {
        const response = await route.fetch({ timeout: 10000 }); arrived = true;
        await gate; await route.fulfill({ response });
      } catch (error) { failure = error; }
    };
    await page.route(routePattern, handler);
    return { release, async wait() {
      const deadline = Date.now() + 10000;
      while (!arrived && !failure && Date.now() < deadline) await page.waitForTimeout(10);
      if (failure) throw failure;
      assert.ok(arrived, 'Held an actual backend response');
    }, async close() { release(); await page.unroute(routePattern, handler); } };
  }
  try {
    await page.goto(info.url);
    await test('Pixel-heart favicon is self-contained and decodes sharply at tab sizes', async () => {
      const icon = page.locator('link[rel="icon"]');
      assert.equal(await icon.count(), 1);
      assert.equal(await icon.getAttribute('type'), 'image/svg+xml');
      const href = await icon.getAttribute('href');
      assert.ok(href.startsWith('data:image/svg+xml,'));
      assert.equal(decodeURIComponent(href.split(',')[1]), await readFile(join(here, 'favicon.svg'), 'utf8'));
      assert.equal(await page.evaluate(async href => {
        const image = new Image(); image.src = href; await image.decode();
        return [16, 32].every(size => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, size, size);
          const pixels = ctx.getImageData(0, 0, size, size).data, colors = new Set();
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] !== 0 && pixels[i + 3] !== 255) return false;
            if (pixels[i + 3]) colors.add([...pixels.slice(i, i + 3)].join(','));
          }
          return pixels[3] === 0 && colors.has('233,29,42') && colors.has('0,0,0') && colors.has('255,255,255');
        });
      }, href), true, 'Transparent background, black outline, red fill and white pixel highlight under the real CSP');
    });
    await test('Path copy reports actual results, preserves selection and rejects stale feedback', async () => {
      await page.evaluate(() => {
        window.originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        window.pathWrites = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: async text => { window.pathWrites.push(text); },
        } });
      });
      try {
        await open(A);
        const path = page.locator('#document-path');
        assert.equal(await path.getAttribute('role'), 'button');
        await path.click(); await page.waitForFunction(() => $('document-path').classList.contains('copied'));
        assert.deepEqual(await page.evaluate(() => window.pathWrites), [A]);
        assert.match(await page.locator('#path-copy-status').textContent(), /copied/);
        await open(B);
        assert.equal(await path.evaluate(el => el.classList.contains('copied')), false);
        await page.evaluate(() => {
          const range = document.createRange(); range.selectNodeContents($('document-path'));
          getSelection().removeAllRanges(); getSelection().addRange(range);
        });
        await path.dispatchEvent('click');
        assert.equal(await page.evaluate(() => window.pathWrites.length), 1, 'Selecting the path does not copy');
        await path.focus(); await path.press('Enter');
        assert.deepEqual(await page.evaluate(() => window.pathWrites), [A, B], 'Explicit keyboard copy is not blocked by a selection');
        await page.evaluate(() => getSelection().removeAllRanges());
        await path.press('Space');
        assert.equal(await page.evaluate(() => window.pathWrites.length), 3);
        await path.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
        assert.equal(await page.evaluate(() => window.pathWrites.length), 3);
        await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
        await path.click();
        await page.waitForFunction(() => $('status').textContent.includes('Could not copy'));
        assert.equal(await path.evaluate(el => el.classList.contains('copied')), false);
        assert.equal(await page.locator('#path-copy-status').textContent(), '');
        await page.evaluate(() => { navigator.clipboard.writeText = async () => {}; });
        await path.click(); await page.waitForFunction(() => $('document-path').classList.contains('copied'));
        assert.equal(await page.locator('#status').textContent(), '', 'A successful retry clears its earlier copy failure');
        await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); });
        await path.click();
        await page.waitForFunction(() => $('status').textContent.includes('Could not copy'));
        assert.equal(await path.evaluate(el => el.classList.contains('copied')), false);
        await page.evaluate(() => {
          status(); window.pendingPathCopies = [];
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: () => new Promise((resolve, reject) => window.pendingPathCopies.push({ resolve, reject })),
          } });
        });
        await path.click(); await path.press('Enter');
        await page.evaluate(() => window.pendingPathCopies[1].resolve());
        await page.waitForFunction(() => $('document-path').classList.contains('copied'));
        await page.evaluate(() => window.pendingPathCopies[0].reject(new Error('old failure')));
        assert.equal(await path.evaluate(el => el.classList.contains('copied')), true, 'An older failure cannot override a newer success');
        assert.equal(await page.locator('#status').textContent(), '');
        await path.click(); await open(A);
        await page.evaluate(() => window.pendingPathCopies[2].resolve());
        assert.equal(await path.evaluate(el => el.classList.contains('copied')), false, 'A completion cannot label another document');
        await path.click(); await board(); await open(A);
        await page.evaluate(() => window.pendingPathCopies[3].resolve());
        assert.equal(await path.evaluate(el => el.classList.contains('copied')), false, 'Returning to the same path does not revive a stale copy');
        await board(); assert.equal(await path.getAttribute('role'), null);
        assert.equal(await path.getAttribute('tabindex'), null);
      } finally {
        await page.evaluate(() => {
          if (window.originalClipboard) Object.defineProperty(navigator, 'clipboard', window.originalClipboard);
          else delete navigator.clipboard;
          delete window.originalClipboard; delete window.pathWrites; delete window.pendingPathCopies;
          getSelection().removeAllRanges(); status();
        });
      }
    });
    await test('Initial board fits once on desktop and phones; later interactions preserve the camera', async () => {
      for (const width of [1440, 390, 320]) {
        const fresh = await context.newPage();
        fresh.on('pageerror', error => errors.push(error.message));
        try {
          await fresh.setViewportSize({ width, height: 900 });
          await fresh.goto(info.url);
          await fresh.waitForFunction(() => graphReady && graph.nodes.length === 3);
          const settled = () => fresh.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await settled();
          assert.equal(await fresh.evaluate(() => {
            const canvas = $('graph').getBoundingClientRect();
            return [...$('graph-cards').children].every(card => {
              const box = card.getBoundingClientRect();
              return box.x >= canvas.x && box.right <= canvas.right && box.y >= canvas.y && box.bottom <= canvas.bottom;
            });
          }), true, `First view contains every fixture card at ${width}px`);
          if (width < 760) assert.ok(await fresh.evaluate(() => scale < 1), 'Narrow first views actually zoom out');
          await fresh.evaluate(() => { pan = { x: 17, y: 29 }; scale = .7; transform(); });
          const camera = await fresh.evaluate(() => ({ pan: { ...pan }, scale }));
          await fresh.evaluate(async p => {
            await navigate('overview'); await navigate('dashboard');
            setLibrary(true); setLibrary(false);
            store.set(p, store.source(p) + '\nA temporary viewport check.\n');
            await updatePreview(); await undoEdit();
          }, A);
          await fresh.setViewportSize({ width: width + 20, height: 860 });
          await settled();
          assert.deepEqual(await fresh.evaluate(() => ({ pan: { ...pan }, scale })), camera);
        } finally { await fresh.close(); }
      }
    });
    await test('First use: diagram → complete document → diagram, without technical chrome', async () => {
      await page.waitForFunction(() => view === 'graph' && graph.nodes.length === 3);
      assert.equal(await page.locator('#changes').isVisible(), false);
      assert.equal(await page.locator('#count').isVisible(), false);
      assert.notEqual(await page.locator('#changes-toggle').evaluate(el => getComputedStyle(el).color), await page.locator('#changes-toggle').evaluate(el => getComputedStyle(el).backgroundColor), 'Changes label remains visible without hover');
      assert.equal(await page.locator('#catalog small').count(), 0);
      assert.equal(await page.locator('#catalog [data-doc="docdoki/notes/evidence.md"]').innerText(), 'Evidence', 'Show the document title before it is opened');
      for (const id of ['refresh', 'latest', 'rebase', 'spec-list', 'project-path', 'snapshot', 'copy-drafts', 'copy-receipt', 'undo', 'mode-toggle'])
        assert.equal(await page.locator('#' + id).count(), 0, id + ' removed, not hidden');
      assert.equal(await page.locator('[data-nav="specs"]').count(), 0);
      assert.match(await page.locator('#graph-cards').innerText(), /Not recorded/);
      assert.doesNotMatch(await page.locator('body').innerText(), /Includes private|Decided design contracts|Facts and next steps|Manual plan|Loaded \d/);
      await shot('board');
      await changes(); assert.match(await page.locator('#change-list').innerText(), /No unsaved changes/);
      assert.equal(await page.locator('#save-controls').isVisible(), false); await closeChanges();
      await page.evaluate(() => { pan = { x: 12, y: 16 }; scale = .9; transform(); });
      const card = page.locator(`#graph-cards [data-node="${A}"]`);
      for (const position of [{x:4,y:4}, {x:2,y:90}, {x:90,y:145}]) {
        await card.click({ position });
        assert.equal(await page.evaluate(p => view === 'graph' && selectedNode === p && !store.drafts.size, A), true);
        assert.equal(await page.locator('#edge-detail').isVisible(), false);
        assert.equal(await card.evaluate(el => el === document.activeElement), true);
      }
      await card.dblclick({ position: { x: 4, y: 4 } });
      assert.equal(await page.evaluate(() => view), 'graph', 'Double-click is not a hidden navigation shortcut');
      assert.ok(await page.locator('.edge.selected').count());
      for (const key of ['Enter', 'Space']) {
        await card.focus(); await page.keyboard.press(key);
        assert.equal(await page.evaluate(p => view === 'graph' && selectedNode === p, A), true);
      }
      await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => selectedNode), null);
      await selectCard(A); await page.locator('#graph').click({ position: { x: 12, y: 12 } });
      assert.equal(await page.evaluate(() => selectedNode), null, 'A canvas click clears selection');
      await card.locator(`[data-doc="${A}"]`).click();
      await page.waitForFunction(p => view === 'doc' && current === p, A);
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      const text = await page.locator('#reading').innerText();
      for (const value of ['An introduction', 'Non-goals', 'First section.', 'Second section.']) assert.ok(text.includes(value));
      assert.equal(await page.locator('#reading pre').count(), 1);
      assert.equal(await page.locator('#reading h1').evaluate(el => el === document.activeElement), true);
      await shot('document');
      await board(); assert.deepEqual(await page.evaluate(() => [pan.x, pan.y, scale]), [12, 16, .9]);
      await card.focus(); await page.keyboard.press('Enter');
      await card.locator(`[data-doc="${A}"]`).focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(p => view === 'doc' && current === p, A);
      await board();
      await sidebar('overview');
      await page.waitForFunction(() => view === 'doc' && current === OVERVIEW);
      assert.equal(await page.locator('[data-nav="overview"]').getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('#overview-views,#cards-view,#document-view').count(), 0);
      assert.match(await page.locator('#reading').innerText(), /Atomic publication is not implemented/);
      assert.equal(await page.locator('#reading table').count(), 1);
      await board();
      assert.equal(await page.locator('[data-nav="dashboard"]').getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('[data-nav="overview"]').getAttribute('aria-current'), null);
      assert.deepEqual(await page.evaluate(() => [pan.x, pan.y, scale]), [12, 16, .9]);
      assert.equal(await page.locator('#source-view').isVisible(), false);
    });
    await test('Canvas refresh preserves keyboard targets and defers card replacement until drag release', async () => {
      await board();
      const card = page.locator(`[data-node="${A}"]`);
      for (const target of [card, card.locator('[data-field="title"]'), card.locator('[data-doc]')]) {
        await target.focus(); await page.evaluate(() => updatePreview());
        assert.equal(await target.evaluate(el => el === document.activeElement), true);
        await page.evaluate(() => syncDocuments());
        assert.equal(await target.evaluate(el => el === document.activeElement), true);
      }
      const original = await readFile(join(info.root, B), 'utf8');
      try {
        const box = await card.boundingBox();
        await page.mouse.move(box.x + 3, box.y + 3); await page.mouse.down();
        await page.mouse.move(box.x + 63, box.y + 33, { steps: 5 });
        await page.evaluate(() => { window.dragCard = drag.element; });
        await page.evaluate(() => updatePreview());
        assert.equal(await page.evaluate(() => drag.element === window.dragCard && drag.element.isConnected), true);
        await writeFile(join(info.root, B), original.replace(/^# .+$/m, '# Refreshed while dragging'));
        await page.evaluate(() => syncDocuments());
        assert.equal(await page.evaluate(() => drag.element === window.dragCard && drag.element.isConnected), true);
        await page.mouse.move(box.x + 103, box.y + 53, { steps: 5 }); await page.mouse.up();
        assert.equal(await page.locator(`[data-node="${B}"] .card-title`).innerText(), 'Refreshed while dragging');
        assert.equal(await card.evaluate(el => {
          const p = positions.get(el.dataset.node), matrix = new DOMMatrix(getComputedStyle(el).transform);
          return !drag && !graphRenderPending && Math.abs(matrix.e - p.x) < .001 && Math.abs(matrix.f - p.y) < .001;
        }), true, 'Released card matches the retained layout, including movement after refresh');
      } finally {
        await page.mouse.up(); await writeFile(join(info.root, B), original);
        await page.evaluate(async () => { await syncDocuments(); await resetLayout(); });
      }
    });
    await test('Landscape windows keep the complete canvas toolbar within the visible workspace', async () => {
      await board();
      for (const [width, height] of [[844, 390], [640, 360]]) {
        await page.setViewportSize({ width, height });
        await page.waitForFunction(() => {
          const box = $('graph').getBoundingClientRect(), tools = document.querySelector('.graph-tools').getBoundingClientRect();
          return tools.top >= box.top && tools.bottom <= innerHeight && tools.left >= box.left && tools.right <= box.right;
        });
        await page.locator('#zoom-in').click(); await page.locator('#zoom-out').click();
        await shot(`landscape-${width}`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test('One source icon stays next to the path, toggles both ways, and retains drafts across languages and widths', async () => {
      await open(A);
      assert.equal(await page.locator('#body-view,#document-views').count(), 0);
      const toggle = page.locator('#source-view');
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const locale of ['en', 'zh']) {
          await language(locale);
          for (const source of [false, true]) {
            await mode(source);
            assert.equal(await toggle.getAttribute('aria-pressed'), String(source));
            assert.equal(await toggle.getAttribute('aria-label'), locale === 'en' ? 'Source view' : '源码视图');
            assert.equal(await toggle.getAttribute('title'), locale === 'en' ? source ? 'Show rendered document' : 'Show source' : source ? '显示正文预览' : '显示源码');
            assert.equal((await toggle.textContent()).trim(), '');
            const path = await page.locator('#document-path').boundingBox(), icon = await toggle.boundingBox();
            assert.ok(Math.abs(icon.x - path.x - path.width - 8) < 1);
            assert.ok(Math.abs(icon.y + icon.height / 2 - path.y - path.height / 2) < 1);
            assert.ok(icon.x + icon.width <= width);
          }
        }
      }
      const baseline = await page.locator('#source').inputValue();
      await page.locator('#source').fill(baseline + '\nDraft through icon toggle\n');
      await toggle.click(); await page.waitForFunction(() => !sourceMode && !previewPending);
      assert.match(await page.locator('#reading').innerText(), /Draft through icon toggle/);
      await toggle.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => sourceMode);
      assert.match(await page.locator('#source').inputValue(), /Draft through icon toggle/);
      await page.locator('#source').fill(baseline); await mode(false);
      await page.setViewportSize({ width: 1440, height: 1000 }); await language('en'); await board();
    });
    await test('Sidebar control is in the content bar; zoom lock and layout reset are independent of drafts', async () => {
      assert.equal(await page.locator('.source-bar #library-toggle').count(), 1);
      const position = await page.locator('#library-toggle').boundingBox(), bar = await page.locator('.source-bar').boundingBox();
      assert.ok(position.x >= bar.x && position.y >= bar.y);
      const before = await page.evaluate(() => scale);
      await page.locator('#zoom-label').click();
      assert.equal(await page.locator('#fit').isDisabled(), true);
      await page.locator('#workspace').focus(); await page.keyboard.press('+'); await page.keyboard.press('0');
      assert.equal(await page.evaluate(() => scale), before);
      await page.locator('#graph').dispatchEvent('wheel', { deltaY: -80, ctrlKey: true });
      assert.equal(await page.evaluate(() => scale), before);
      await page.evaluate(p => { offsets.set(p, {x:50,y:20}); renderGraph(); }, A);
      await page.locator('#reset-layout').click(); await page.waitForFunction(() => !offsets.size);
      assert.equal(await page.evaluate(() => scale), before, 'Reset layout does not override a zoom lock');
      await page.locator('#zoom-label').click(); assert.equal(await page.locator('#fit').isDisabled(), false);
      await page.locator('#zoom-in').click(); assert.ok(await page.evaluate(s => scale > s, before));
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await page.locator('#fit').click();
    });
    const fieldInput = () => page.locator('#card-field-form [name="value"]');
    async function field(path, name) {
      await page.locator(`#graph-cards [data-node="${path}"] [data-field="${name}"]`).click();
      await fieldInput().waitFor();
    }
    async function applyField() {
      await page.locator('[data-apply-field]').click();
      await page.waitForFunction(() => !fieldEditor && !previewPending);
    }
    await test('Responsive navigation and native task/select affordances survive the visual reset', async () => {
      await page.evaluate(() => setLibrary(false));
      await page.setViewportSize({ width: 390, height: 900 });
      await page.locator('#library-toggle').click();
      const sidebarBox = await page.locator('#library').boundingBox();
      assert.ok(sidebarBox.width >= 280, 'Opening phone navigation after collapsing the desktop sidebar retains its width');
      assert.equal(await page.locator('#library').evaluate(el => getComputedStyle(el).borderRightWidth), '2px');
      await page.locator('[data-nav="northstar"]').click();
      await open('docdoki/stages/follow-export.md');
      assert.equal(await page.locator('#reading input[type="checkbox"]').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return getComputedStyle(el).appearance !== 'none' && rect.width >= 8 && rect.height >= 8;
      }), true, 'Markdown tasks keep a visible native checkbox');
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await board();
        await page.locator('#fit').click(); await field(A, 'progress');
        for (const locale of ['en', 'zh']) {
          await language(locale);
          assert.equal(await fieldInput().evaluate(el => {
            const style = getComputedStyle(el), ctx = document.createElement('canvas').getContext('2d');
            ctx.font = style.font;
            const labelWidth = Math.max(...[...el.options].map(option => ctx.measureText(option.text).width));
            return style.appearance !== 'none' && labelWidth + 28 <= el.clientWidth;
          }), true, 'Native arrow and every progress label fit, including 16px phone input');
          await equalButtonWidths('.field-actions button');
        }
        await fieldInput().press('Escape');
      }
      await language('en'); await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('#fit').click();
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
    });
    const fieldOriginal = await readFile(join(info.root, A), 'utf8');
    try {
      await test('Inline title, purpose and progress preserve complete source, native input, cancellation and undo', async () => {
        await field(A, 'title'); await fieldInput().fill('Cancelled title'); await fieldInput().press('Escape');
        assert.equal(await page.evaluate(() => store.drafts.size), 0);
        await field(A, 'title'); await fieldInput().fill('Revised export'); await fieldInput().press('Enter');
        await page.waitForFunction(() => !fieldEditor && !previewPending);
        await field(A, 'purpose'); await fieldInput().fill('Multi-line summary: #1\nDo not lose the condition.');
        await equalButtonWidths('.field-actions button');
        await page.evaluate(() => { window.nativeField = fieldEditor.input; });
        await page.evaluate(() => updatePreview());
        assert.equal(await page.evaluate(() => window.nativeField === fieldEditor.input), true);
        await language('zh');
        assert.equal(await fieldInput().getAttribute('aria-label'), '摘要');
        assert.equal(await fieldInput().inputValue(), 'Multi-line summary: #1\nDo not lose the condition.');
        await language('en');
        await fieldInput().dispatchEvent('compositionstart');
        await fieldInput().dispatchEvent('keydown', {key:'Enter', isComposing:true});
        assert.equal(await fieldInput().isVisible(), true);
        await fieldInput().dispatchEvent('compositionend');
        await fieldInput().press('ControlOrMeta+End'); await fieldInput().press('Enter');
        assert.match(await fieldInput().inputValue(), /condition\.\n$/);
        await shot('inline'); await fieldInput().press('ControlOrMeta+Enter');
        await page.waitForFunction(() => !fieldEditor && !previewPending);
        await field(A, 'progress'); await fieldInput().selectOption('done'); await applyField();
        const proposed = await page.evaluate(p => store.source(p), A);
        assert.match(proposed, /# Revised export/); assert.match(proposed, /progress: "done"/);
        assert.match(proposed, /Do not send rows\n  to any remote service/);
        assert.match(proposed, /First section\.[\s\S]*Second section\./);
        assert.equal(await readFile(join(info.root, A), 'utf8'), fieldOriginal);
        assert.equal(await page.evaluate(() => view === 'graph' && !document.getElementById('changes').checkVisibility()), true);
        await undo(); await undo(); await undo();
        assert.equal(await page.evaluate(p => store.source(p), A), fieldOriginal);
        await field(A, 'title'); await fieldInput().fill('Saved card title');
        // Opening Changes commits the local buffer; it must not present an empty drawer.
        await changes(); await page.waitForFunction(() => !fieldEditor && store.drafts.size === 1);
        await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /# Saved card title/);
        assert.match(await page.evaluate(() => buildPrompt()), /already been saved[\s\S]*Saved card title/);
      });
      await test('Cancelled field responses cannot overwrite a later edit; continued typing is retained', async () => {
        await board();
        const held = await hold('**/preview', r => r.postDataJSON().card?.field === 'title');
        try {
          await field(A, 'title'); await fieldInput().fill('Late title');
          await page.locator('[data-apply-field]').click(); await held.wait();
          await page.evaluate(() => { window.cancelledFieldRequest = fieldEditor.pending; });
          await page.locator('[data-cancel-field]').click();
          await field(A, 'purpose'); await fieldInput().fill('A later summary.'); await applyField();
          held.release(); await page.evaluate(() => window.cancelledFieldRequest);
          assert.match(await page.evaluate(p => store.source(p), A), /# Saved card title/);
          assert.match(await page.evaluate(p => store.source(p), A), /A later summary/);
        } finally { await held.close(); }
        const continued = await hold('**/preview', r => r.postDataJSON().card?.field === 'title');
        try {
          await field(A, 'title'); await fieldInput().fill('First input');
          await page.locator('[data-apply-field]').click(); await continued.wait();
          await page.evaluate(() => { window.fieldSave = save(); });
          await fieldInput().fill('Second input'); continued.release();
          await page.evaluate(() => window.fieldSave);
          assert.equal(await fieldInput().inputValue(), 'Second input');
          assert.doesNotMatch(await readFile(join(info.root, A), 'utf8'), /First input|Second input/);
          await applyField(); await saved();
          const disk = await readFile(join(info.root, A), 'utf8');
          assert.match(disk, /# Second input/); assert.match(disk, /A later summary/);
        } finally { await continued.close(); }
      });
      await test('A field opens from canonical source while an older summary preview is delayed', async () => {
        await open(A); await mode(true);
        let once = true;
        const held = await hold('**/preview', r => !r.postDataJSON().card && once && (once = false, true));
        try {
          await page.locator('#source').fill((await page.locator('#source').inputValue()).replace('A later summary.', 'Typed directly in source.') + '\nAn unseen source condition.\n');
          await held.wait(); await board(); await field(A, 'purpose');
          assert.equal(await fieldInput().inputValue(), 'Typed directly in source.');
          await fieldInput().fill('Typed directly in source. Then extended on the card.');
          await page.locator('[data-apply-field]').click(); held.release();
          await page.waitForFunction(() => !fieldEditor && !previewPending);
          await saved(); const disk = await readFile(join(info.root, A), 'utf8');
          assert.match(disk, /Then extended on the card/); assert.match(disk, /An unseen source condition/);
        } finally { await held.close(); }
      });
      await test('Automatic updates cannot replace an active field buffer; failed application retains text', async () => {
        await board();
        const external = (await readFile(join(info.root, A), 'utf8')) + '\nExternal field condition.\n';
        await writeFile(join(info.root, A), external);
        const held = await hold('**/snapshot');
        try {
          await page.evaluate(() => { window.fieldSync = syncDocuments(); }); await held.wait();
          await field(A, 'title'); await fieldInput().fill('Uncommitted field text');
          held.release(); await page.evaluate(() => window.fieldSync);
          assert.equal(await fieldInput().inputValue(), 'Uncommitted field text');
          const fail = route => route.request().postDataJSON().card ? route.abort() : route.continue();
          await page.route('**/preview', fail);
          await page.locator('[data-apply-field]').click();
          await page.waitForFunction(() => fieldEditor?.input.getAttribute('aria-invalid') === 'true');
          assert.equal(await fieldInput().inputValue(), 'Uncommitted field text');
          await page.unroute('**/preview', fail);
          await applyField(); await changes(); await page.locator('#save').click();
          await page.waitForFunction(p => !store.busy && conflicts.has(p), A);
          assert.equal(await readFile(join(info.root, A), 'utf8'), external);
          assert.match(await page.evaluate(() => buildPrompt()), /Uncommitted field text[\s\S]*External field condition/);
          await discard(A);
        } finally { await held.close(); }
      });
    } finally { await writeFile(join(info.root, A), fieldOriginal); await page.reload(); }
    await test('Board hierarchy, directional ports and fixed-size arrow highlights survive dragging', async () => {
      await page.locator('#fit').click();
      assert.equal(await page.evaluate(() => Number.isFinite(scale) && Number.isFinite(pan.x) && Number.isFinite(pan.y)), true);
      assert.doesNotMatch(await page.locator('#zoom-label').innerText(), /NaN/);
      const frameFits = () => page.evaluate(() => {
        const map = $('minimap').viewBox.baseVal, frame = $('mini-view').getBBox();
        return frame.x >= map.x && frame.y >= map.y && frame.x + frame.width <= map.x + map.width && frame.y + frame.height <= map.y + map.height;
      });
      assert.equal(await frameFits(), true, 'The minimap viewport is a complete frame, not a clipped line');
      const originalPan = await page.evaluate(() => ({...pan})), mini = await page.locator('#minimap').boundingBox();
      await page.mouse.move(mini.x + mini.width / 2, mini.y + mini.height / 2); await page.mouse.down();
      await page.mouse.move(mini.x + mini.width / 2 + 12, mini.y + mini.height / 2 + 6, {steps:4}); await page.mouse.up();
      await page.waitForFunction(() => miniDragId === null);
      assert.equal(await frameFits(), true);
      assert.notDeepEqual(await page.evaluate(() => pan), originalPan);
      await page.evaluate(p => { pan = p; transform(); }, originalPan);
      assert.ok((await page.locator('.catalog-group').evaluateAll(groups => groups.map(el => parseFloat(getComputedStyle(el).borderTopWidth)))).every(width => width >= 1));
      assert.equal(await page.locator('.spec-card header').first().evaluate(el => getComputedStyle(el).borderBottomWidth), '2px');
      assert.equal(await page.locator('.card-foot').first().evaluate(el => getComputedStyle(el).borderTopWidth), '2px');
      const routing = await page.evaluate(() => {
        const boxes = new Map([['a', {x:0,y:0,w:300,h:180}], ['b', {x:500,y:-120,w:300,h:180}], ['c', {x:500,y:140,w:300,h:180}]]);
        const fan = routeEdges([{from:'a',to:'b'}, {from:'a',to:'c'}], boxes);
        const repeat = routeEdges([{from:'a',to:'c'}, {from:'a',to:'b'}], boxes);
        boxes.set('c', {x:0,y:400,w:300,h:180});
        const vertical = routeEdges([{from:'a',to:'c'}], boxes)[0];
        boxes.set('b', {x:-500,y:0,w:300,h:180});
        const reverse = routeEdges([{from:'a',to:'b'}], boxes)[0];
        return { offsets: fan.map(e => e.fromOffset), repeat: repeat.map(e => e.fromOffset).reverse(),
          vertical: [vertical.fromSide, vertical.toSide], reverse: [reverse.fromSide, reverse.toSide],
          start: portAt(vertical.a, vertical.fromSide, vertical.fromOffset), end: portAt(vertical.b, vertical.toSide, vertical.toOffset) };
      });
      assert.notEqual(...routing.offsets); assert.deepEqual(routing.offsets, routing.repeat);
      assert.deepEqual(routing.vertical, ['bottom', 'top']); assert.deepEqual(routing.reverse, ['left', 'right']);
      assert.deepEqual(routing.start, {x:150,y:190}); assert.deepEqual(routing.end, {x:150,y:390});
      await selectCard(B);
      assert.ok(await page.locator('.edge.selected').count()); assert.ok(await page.locator('.edge.dim').count());
      assert.match(await page.locator('.edge.selected').first().evaluate(el => getComputedStyle(el).markerEnd), /#arrow-selected/);
      assert.equal(await page.locator('#arrow-selected').getAttribute('markerUnits'), 'userSpaceOnUse');
      assert.equal(await page.locator('#arrow-selected path').getAttribute('fill'), '#e91d2a');
      await page.evaluate(() => { window.routingRefs = [...document.querySelectorAll('#graph-cards .spec-card, #edge-lines path')]; selectNode(null); });
      const geometry = await page.evaluate(([a,b]) => ({ a:positions.get(a), b:positions.get(b), scale }), [A,B]);
      const header = await page.locator(`#graph-cards [data-node="${B}"] header`).boundingBox();
      await page.mouse.move(header.x + 4, header.y + 4); await page.mouse.down();
      await page.mouse.move(header.x + 4 + (geometry.a.x - geometry.b.x) * geometry.scale,
        header.y + 4 + (geometry.a.y + geometry.a.h + 70 - geometry.b.y) * geometry.scale, {steps:8});
      await page.mouse.up();
      assert.equal(await page.evaluate(([a,b]) => edgeViews.find(e => e.from === a && e.to === b).fromSide, [A,B]), 'bottom');
      assert.equal(await page.evaluate(() => window.routingRefs.every((el,i) => el === document.querySelectorAll('#graph-cards .spec-card, #edge-lines path')[i]) && !store.drafts.size), true);
      await page.evaluate(p => { offsets.delete(p); renderGraph(); }, B);
      await page.locator(`#graph-cards [data-doc="${A}"]`).click();
      await page.waitForFunction(p => view === 'doc' && current === p && !sourceMode, A);
      await board();
    });
    await test('Notes, archives, private work and complete anchored Markdown remain reachable', async () => {
      assert.match(await page.locator('#catalog').innerText(), /Local work/);
      await open(A);
      await page.locator('#reading [data-doc="docdoki/notes/evidence.md"]').click();
      await page.waitForFunction(() => current === 'docdoki/notes/evidence.md');
      assert.equal(await page.locator('#catalog [data-doc="docdoki/notes/evidence.md"]').innerText(), 'Evidence', 'Opening a note does not change its navigation label');
      assert.match(await page.locator('#reading').innerText(), /useful observation/);
      await page.locator('#catalog details summary').click();
      const archivedLink = page.locator('#catalog [data-doc="docdoki/stages/archive/follow-old.md"]');
      const archivedTitle = await archivedLink.innerText();
      assert.equal(archivedTitle, 'Previous work');
      await open('docdoki/stages/archive/follow-old.md');
      assert.equal(await archivedLink.innerText(), archivedTitle, 'Opening an archive does not change its navigation label');
      assert.match(await page.locator('#reading').innerText(), /Archived knowledge/);
      await page.locator('[data-nav="work"]').click();
      assert.match(await page.locator('#reading').innerText(), /Local work/);
    });
    await test('Typing keeps focus and the drawer closed; native multiline, IME and Escape survive', async () => {
      await open(A); await mode(true);
      const original = await page.locator('#source').inputValue();
      await page.locator('#source').press('ControlOrMeta+End'); await page.locator('#source').pressSequentially('XYZ', { delay: 40 });
      await page.waitForFunction(() => !previewPending);
      assert.equal(await page.locator('#changes').isVisible(), false);
      assert.equal(await page.locator('#source').evaluate(el => el === document.activeElement), true);
      assert.match(await page.locator('#source').inputValue(), /XYZ$/);
      await page.locator('#source').dispatchEvent('compositionstart');
      await page.locator('#source').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
      await page.locator('#source').dispatchEvent('compositionend');
      assert.equal(await page.evaluate(() => sourceMode), true);
      await page.locator('#source').fill(original + '\n中文草稿\nNext line\n');
      assert.match(await page.locator('#source').inputValue(), /中文草稿\nNext line/);
      await page.locator('#source').press('Escape');
      assert.equal(await page.locator('#source').inputValue(), original);
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
    });
    await test('View/mode switches retain edits; chronological undo and draft search remain', async () => {
      await edit(A, text => text.replace('Local export', 'SearchableDraft export'));
      await edit(B, text => text.replace('Validate local rows.', 'Validate typed rows.'));
      await edit(A, text => text.replace('Second section.', 'Second changed.'));
      await mode(false); assert.equal(await page.evaluate(() => store.drafts.size), 2);
      await board(); assert.equal(await page.evaluate(() => view), 'graph');
      await page.locator('#search').fill('SearchableDraft');
      assert.equal(await page.locator(`#catalog [data-doc="${A}"]`).count(), 1);
      await page.locator('#search').fill('');
      await undo(); assert.match(await page.evaluate(p => store.source(p), A), /Second section\./);
      assert.match(await page.evaluate(p => store.source(p), B), /Validate typed rows/);
      await undo(); assert.match(await page.evaluate(p => store.source(p), B), /Validate local rows/);
      const before = await page.locator('#graph').boundingBox();
      await changes(); assert.deepEqual(await page.locator('#graph').boundingBox(), before, 'Drawer overlays rather than resizing diagram');
      assert.equal(await page.locator('#export').isVisible(), false);
      assert.equal(await page.locator('.save-actions button:visible').count(), 2);
      const actionWidth = await equalButtonWidths('.save-actions button');
      await language('zh'); assert.equal(await equalButtonWidths('.save-actions button'), actionWidth);
      await language('en');
      assert.equal(await page.locator('.change-details').getAttribute('open'), null);
      await shot('changes');
    });
    await test('Delayed save locks mutations and keeps a canonical follow receipt', async () => {
      const held = await hold('**/save');
      try {
        await page.locator('#save').click(); await held.wait();
        assert.equal(await page.evaluate(() => store.busy), true);
        assert.equal(await page.locator('#connect').isDisabled(), true);
        assert.equal(await page.locator('[data-field]').first().isDisabled(), true);
        assert.equal(await page.evaluate(p => store.set(p, 'lost edit'), A), false);
        assert.equal(await page.evaluate(p => store.discard(p, null), A), false);
        held.release(); await page.waitForFunction(() => !store.busy && !store.drafts.size && !previewPending);
        assert.equal(await page.evaluate(p => store.source(p), A), await readFile(join(info.root, A), 'utf8'));
        assert.match(await page.evaluate(() => buildPrompt()), /already been saved/);
        assert.doesNotMatch(await page.evaluate(() => buildPrompt()), /UNSAVED/);
        assert.equal(await page.locator('#save').isVisible(), false);
        assert.equal(await page.locator('#copy-agent').isVisible(), true);
        const copy = await page.locator('#copy-agent').boundingBox(), actions = await page.locator('.save-actions').boundingBox();
        assert.ok(Math.abs(copy.width - actions.width) < .15, 'A sole remaining action fills its row, without an empty peer column');
      } finally { await held.close(); }
    });
    await test('One copy action handles unsaved and saved work, second saves and clipboard failure', async () => {
      await edit(A, text => text.replace('SearchableDraft export', 'Second export'));
      assert.match(await page.evaluate(() => buildPrompt()), /UNSAVED/);
      await saved();
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
      await page.locator('#copy-agent').click();
      assert.equal(await page.locator('#prompt').isVisible(), true);
      assert.match(await page.locator('#prompt').inputValue(), /already been saved[\s\S]*Second export/);
      const prompt = await page.locator('#prompt').inputValue();
      await page.evaluate(() => syncDocuments());
      assert.equal(await page.locator('#prompt').isVisible(), true, 'A focus check must not erase the manual-copy fallback');
      assert.equal(await page.locator('#prompt').inputValue(), prompt);
    });
    await test('External conflicts stay inside Changes; copy carries three sources and discard loads disk', async () => {
      await edit(A, text => text + '\nHuman draft.\n');
      assert.equal(await page.locator('#prompt').inputValue(), '');
      const external = (await readFile(join(info.root, A), 'utf8')) + '\nExternal obligation.\n';
      await writeFile(join(info.root, A), external);
      await changes(); await page.locator('#save').click();
      await page.waitForFunction(p => !store.busy && conflicts.has(p), A);
      assert.equal(await page.evaluate(() => store.drafts.size), 1);
      assert.equal(await page.locator('#save').isDisabled(), true);
      assert.equal(await page.locator('.conflict').isVisible(), true);
      assert.equal(await page.locator('#export').isVisible(), true);
      await page.locator('#copy-agent').click();
      const prompt = await page.locator('#prompt').inputValue();
      assert.match(prompt, /Human draft/); assert.match(prompt, /EXTERNAL VERSION[\s\S]*External obligation/);
      assert.equal(await readFile(join(info.root, A), 'utf8'), external);
      await shot('conflict');
      const newer = external + '\nAnother external condition.\n';
      await writeFile(join(info.root, A), newer);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(p => conflicts.get(p)?.source?.includes('Another external condition'), A);
      assert.match(await page.evaluate(p => store.source(p), A), /Human draft/);
      assert.equal(await page.locator('#prompt').inputValue(), '', 'New external content invalidates an older request');
      assert.match(await page.evaluate(() => buildPrompt()), /Another external condition/);
      await discard(A); assert.equal(await page.evaluate(p => store.source(p), A), newer);
      assert.equal(await page.evaluate(() => store.undo()), null, 'Discard cannot resurrect the old source');
    });
    await test('Unknown save outcome retains edits and accurately describes possible disk writes', async () => {
      await edit(A, text => text + '\nUnconfirmed save.\n');
      const fail = async route => { await route.fetch(); await route.abort(); };
      await page.route('**/save', fail);
      try {
        await changes(); await page.locator('#save').click();
        await page.waitForFunction(() => !store.busy && saveFailure?.unknown && conflicts.size > 0);
        assert.match(await readFile(join(info.root, A), 'utf8'), /Unconfirmed save/);
        assert.match(await page.evaluate(() => buildPrompt()), /some edits may already be on disk/);
        assert.equal(await page.evaluate(() => store.drafts.size), 1);
      } finally { await page.unroute('**/save', fail); }
      await discard(A);
    });
    await test('Connect rejects cycles; clicking a line never deletes it; removal is explicit', async () => {
      await board(); await pickEdge(B, 'a');
      assert.equal(await page.locator('#edge-detail [data-remove-after]').count(), 1);
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await dependency(A, 'b');
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('cyc'));
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => connectMode), false);
      await pickEdge(B, 'a');
      await page.locator('#edge-detail [data-remove-after]').click();
      await page.waitForFunction(() => store.drafts.size === 1 && !previewPending);
      assert.equal(await page.evaluate(p => graph.nodes.find(n => n.path === p).col, B), 1);
      await undo();
      await dependency(B, 'a');
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('already matches'));
      assert.equal(await page.evaluate(() => store.drafts.size), 0, 'Connecting an existing pair never toggles it off');
      await page.keyboard.press('Escape');
    });
    await test('Desktop and phone layout, translations and drawer keyboard exits', async () => {
      for (const width of [1440, 1024, 390, 320]) {
        const peerWidths = new Map();
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => { setLibrary(false); setChanges(false); navigate('dashboard'); status(); });
        if (width > 760) await page.locator('#library-toggle').click();
        for (const locale of ['zh', 'en']) {
          await page.locator('#language').click();
          await page.waitForFunction(l => lang === l, locale);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          const search = await page.locator('#search').boundingBox();
          assert.ok(search.width >= (width <= 390 ? width - 60 : 170), JSON.stringify(search));
          for (const selector of ['#zoom-out, #zoom-in, #fit, #reset-layout, #connect', '.card-foot>.progress-label', '.card-foot>[data-doc]']) {
            const measured = await equalButtonWidths(selector);
            if (peerWidths.has(selector)) assert.ok(Math.abs(measured - peerWidths.get(selector)) < .15, 'Peer widths stay stable across languages: ' + selector);
            else peerWidths.set(selector, measured);
          }
          assert.deepEqual(await page.locator('.graph-tools button:not(#zoom-label)').allTextContents(), ['−', '+', '▣', '⟲', '⇄']);
          assert.equal(await page.locator('#fit').getAttribute('aria-label'), locale === 'zh' ? '适配视图（0）' : 'Fit diagram (0)');
          assert.equal(await page.locator('.graph-tools button').evaluateAll(buttons => buttons.every(b => b.title && b.getAttribute('aria-label'))), true);
          const percentageWidth = (await page.locator('#zoom-label').boundingBox()).width;
          if (peerWidths.has('percentage')) assert.equal(percentageWidth, peerWidths.get('percentage'));
          else peerWidths.set('percentage', percentageWidth);
          assert.equal(await page.locator('.graph-tools').evaluate(toolbar => {
            const outer = getComputedStyle(toolbar), buttons = [...toolbar.children];
            return ['Top', 'Right', 'Bottom', 'Left'].every(side => outer[`border${side}Width`] === '2px') &&
              buttons.every((button, i) => {
                const style = getComputedStyle(button);
                return style.borderLeftWidth === '0px' && style.borderRightWidth === (i < buttons.length - 1 ? '1px' : '0px');
              });
          }), true, 'Toolbar dividers are single 1px seams inside a 2px frame');
          const beforeLock = await page.locator('.graph-tools').boundingBox();
          await page.locator('#zoom-label').click();
          const tools = await page.locator('.graph-tools').boundingBox();
          assert.ok(tools.x >= 0 && tools.x + tools.width <= width, 'Complete toolbar stays in view, including its lock indicator');
          assert.equal(tools.width, beforeLock.width, 'Lock status does not change the toolbar width');
          assert.equal((await page.locator('#zoom-label').boundingBox()).width, percentageWidth);
          assert.match(await page.locator('#zoom-label').innerText(), /^\d+%$/);
          assert.equal(await page.locator('#zoom-label').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)', 'Locked zoom stays visibly active even while hovered');
          await page.locator('#zoom-label').click();
          await page.locator('#connect').click();
          assert.equal(await page.locator('#connect').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)');
          assert.equal((await page.locator('.graph-tools').boundingBox()).width, beforeLock.width);
          await page.keyboard.press('Escape');
          await sidebar('overview'); await page.waitForFunction(() => view === 'doc' && current === OVERVIEW);
          assert.equal(await page.locator('#overview-views').count(), 0);
          assert.equal(await page.locator('#source-view').evaluate(button => {
            const box = button.getBoundingClientRect(); return box.x >= 0 && box.right <= innerWidth;
          }), true);
          await page.locator('#source-view').click(); await page.waitForFunction(() => sourceMode);
          await board();
          if (width <= 760) assert.equal(await page.locator('#library-toggle').getAttribute('aria-expanded'), 'false');
          await shot(`${width}-${locale}`);
          await changes();
          const drawer = await page.locator('#changes').boundingBox(), top = await page.locator('.top').boundingBox();
          assert.ok(drawer.width >= Math.min(320, width - 8) && drawer.x >= 0 && drawer.x + drawer.width <= width);
          assert.ok(Math.abs(drawer.y - top.y - top.height) < 2);
          assert.equal(await page.locator('#workspace').evaluate(el => el.inert), true);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#changes-toggle').evaluate(el => el === document.activeElement), true);
          assert.equal(await page.locator('#workspace').evaluate(el => el.inert), false);
        }
      }
      await page.locator('#library-toggle').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#library-close').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => view), 'graph');
      assert.equal(await page.locator('#workspace').evaluate(el => el === document.activeElement), true);
      if (engine !== 'firefox') { await page.locator('#library-toggle').tap(); await page.locator('#library-close').tap(); }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test('Diff expansion is stable and stale clipboard failures cannot expose old requests', async () => {
      await edit(A, text => text + '\nPreview draft.\n'); await changes();
      await page.evaluate(() => { navigator.clipboard.writeText = () => new Promise((_, reject) => { window.rejectCopy = reject; }); });
      await page.locator('#copy-agent').click(); await page.waitForFunction(() => !!window.rejectCopy);
      await page.locator('.change-details > summary').click();
      await page.locator('.full-diff > summary').click();
      await closeChanges();
      await page.locator('#source').fill((await page.locator('#source').inputValue()) + '\nSecond draft.\n');
      await page.waitForFunction(() => !previewPending);
      await page.evaluate(() => window.rejectCopy(new Error('late rejection')));
      assert.equal(await page.locator('#prompt').isVisible(), false);
      await changes(); assert.equal(await page.locator('.full-diff').getAttribute('open'), '');
      await page.locator('#language').click(); assert.match(await page.locator('.full-diff > summary').innerText(), /完整修改前后/);
      await page.locator('#language').click();
      await discard(A);
    });
    await test('Private content is marked at copy, never stored in browser persistence', async () => {
      const path = 'docdoki/private/specs/local.md';
      await edit(path, text => text + '\nPrivate adjustment.\n'); await changes();
      assert.equal(await page.locator('#private-warning').isVisible(), false);
      await page.evaluate(() => { navigator.clipboard.writeText = async () => {}; });
      await page.locator('#copy-agent').click();
      assert.equal(await page.locator('#private-warning').isVisible(), true);
      assert.equal(await page.locator('#prompt').isVisible(), false);
      assert.match(await page.evaluate(() => buildPrompt()), /\[PRIVATE\]/);
      assert.ok((await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])).every(k => k === 'ddpanel-lang'));
      await discard(path);
    });
    await test('Automatic focus checks keep clean reading position, layout and last save receipt', async () => {
      await open(A); await mode(false);
      await page.evaluate(() => { document.getElementById('workspace').scrollTop = 80; window.beforeScroll = document.getElementById('workspace').scrollTop; window.beforeReceipt = JSON.stringify(store.receipt); });
      const external = (await readFile(join(info.root, A), 'utf8')) + '\nFresh on focus.\n';
      await writeFile(join(info.root, A), external);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(p => store.source(p).includes('Fresh on focus'), A);
      assert.equal(await page.evaluate(() => view === 'doc' && !sourceMode && JSON.stringify(store.receipt) === window.beforeReceipt), true);
      assert.equal(await page.evaluate(() => document.getElementById('workspace').scrollTop === window.beforeScroll), true);
    });
    await test('A delayed automatic check cannot discard new typing', async () => {
      await open(A); await mode(true);
      const held = await hold('**/snapshot');
      try {
        await page.evaluate(() => { window.pendingSync = syncDocuments(); }); await held.wait();
        await page.locator('#source').fill((await page.locator('#source').inputValue()) + '\nTyped while checking.\n');
        held.release(); await page.evaluate(() => window.pendingSync);
        assert.match(await page.evaluate(p => store.source(p), A), /Typed while checking/);
      } finally { await held.close(); }
      await discard(A);
    });
    await test('Discard cannot erase edits typed while the latest-source read is pending', async () => {
      await edit(A, text => text + '\nDiscard candidate.\n');
      const held = await hold('**/document?path=**');
      try {
        await changes(); await page.locator(`[data-discard="${A}"]`).click(); await held.wait();
        await closeChanges();
        await page.locator('#source').fill((await page.locator('#source').inputValue()) + '\nNewer human text.\n');
        held.release();
        await page.waitForFunction(() => document.getElementById('status').textContent.includes('Editing continued'));
        assert.match(await page.evaluate(p => store.source(p), A), /Newer human text/);
      } finally { await held.close(); }
      await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /Newer human text/);
    });
    // These races use native UI actions and held responses from the actual backend.
    const originals = new Map(await Promise.all([A, B].map(async p => [p, await readFile(join(info.root, p), 'utf8')])));
    async function dependencyFixture(after = []) {
      for (const [path, title] of [[A, 'Export'], [B, 'Validation'], [C, 'Publication']])
        await writeFile(join(info.root, path), `---\nafter: ${JSON.stringify(path === A ? after : [])}\n---\n# ${title}\n\nKeep the original requirement.\n`);
      await page.reload();
      await page.evaluate(() => { const action = changeDependency; changeDependency = (...args) => (window.dependencyRequest = action(...args)); });
    }
    try {
      await test('A dependency response cannot cross automatic snapshot replacement and erase disk content', async () => {
        await dependencyFixture(); const held = await hold('**/preview', r => !!r.postDataJSON().after);
        try {
          await dependency(A, 'c'); await held.wait();
          await page.evaluate(() => { window.previousStore = store; });
          const external = (await readFile(join(info.root, A), 'utf8')) + '\nExternal audit retention.\n';
          await writeFile(join(info.root, A), external);
          await page.evaluate(() => window.dispatchEvent(new Event('focus')));
          await page.waitForFunction(() => store !== window.previousStore);
          assert.equal(await page.evaluate(() => store.version), 0);
          held.release(); await page.evaluate(() => window.dependencyRequest);
          assert.equal(await page.evaluate(() => store.drafts.size), 0);
          await edit(A, text => text + '\nNew local requirement.\n'); await saved();
          const actual = await readFile(join(info.root, A), 'utf8');
          assert.match(actual, /External audit retention/); assert.match(actual, /New local requirement/);
          assert.match(actual, /after: \[\]/);
        } finally { await held.close(); }
      });
      await test('Pending dependency responses cannot cross typing or equal-text discard adoption', async () => {
        for (const action of ['typing', 'discard']) {
          await dependencyFixture();
          if (action === 'discard') await edit(A, text => text + '\nExisting draft.\n');
          const held = await hold('**/preview', r => !!r.postDataJSON().after);
          try {
            await dependency(A, 'c'); await held.wait();
            await page.evaluate(() => { window.oldVersion = store.version; });
            if (action === 'typing') await edit(A, text => text + '\nLater typing.\n');
            else {
              await writeFile(join(info.root, A), await page.evaluate(p => store.source(p), A));
              await discard(A);
            }
            held.release(); await page.evaluate(() => window.dependencyRequest);
            assert.equal(await page.evaluate(() => store.drafts.size), action === 'typing' ? 1 : 0);
            await edit(A, text => text + '\nLater intent.\n'); await saved();
            const actual = await readFile(join(info.root, A), 'utf8');
            assert.match(actual, /after: \[\]/); assert.match(actual, /Later intent/);
            if (action === 'typing') assert.match(actual, /Later typing/);
          } finally { await held.close(); }
        }
      });
      await test('Adding during a delayed source preview preserves typed dependencies on disk', async () => {
        await dependencyFixture(); await open(A); await mode(true);
        const held = await hold('**/preview', r => !r.postDataJSON().after);
        try {
          await page.locator('#source').fill((await page.locator('#source').inputValue()).replace('after: []', 'after: [b]'));
          await held.wait();
          assert.deepEqual(await page.evaluate(p => graph.nodes.find(n => n.path === p).after, A), []);
          // Connect operates on the source draft even though its preview is old.
          await dependency(A, 'c');
          await page.evaluate(() => window.dependencyRequest);
          held.release(); await page.waitForFunction(() => !previewPending);
          await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /after: \["b", "c"\]/);
        } finally { await held.close(); }
      });
      await test('Removing after preview failure keeps other typed dependencies on disk', async () => {
        await dependencyFixture(['b']); await open(A); await mode(true);
        const fail = route => route.request().postDataJSON().after ? route.continue() : route.abort();
        await page.route('**/preview', fail);
        try {
          await page.locator('#source').fill((await page.locator('#source').inputValue()).replace('after: ["b"]', 'after: [b, c]'));
          await page.waitForFunction(() => !!previewError);
          await board(); await pickEdge(A, 'b');
          await page.locator('#edge-detail [data-remove-after="b"]').click(); await page.evaluate(() => window.dependencyRequest);
          await page.unroute('**/preview', fail); await saved();
          assert.match(await readFile(join(info.root, A), 'utf8'), /after: \["c"\]/);
        } finally { await page.unroute('**/preview', fail); }
      });
    } finally {
      for (const [path, source] of originals) await writeFile(join(info.root, path), source);
      await rm(join(info.root, C), { force: true }); await page.reload();
    }
    const bodyOriginal = await readFile(join(info.root, A), 'utf8');
    const bodySource = '---\r\npurpose: "Body editing" # keep this comment\r\nafter: []\r\n---\r\n# Body\r\n\r\nA plain paragraph.\r\n\r\n## Repeated\r\n\r\nKeep *this* spelling &amp; entity.\r\n\r\n## Repeated\r\n\r\n- First item\r\n- Second item\r\n\r\n```js\r\nconst value = 1;\r\n```\r\n\r\n<!-- preserve the hidden comment -->\r\n\r\n| Name | Value |\r\n| --- | --- |\r\n| x | 1 |\r\n\r\nA [[wiki|label]] and [reference][ref].\r\n\r\n[ref]: https://example.org "Reference title"\r\n';
    async function bodyFixture() {
      await writeFile(join(info.root, A), bodySource); await page.reload(); await open(A);
      assert.equal(await page.locator('#edit-body,#body-done,#body-cancel,#body-toolbar').count(), 0);
      await focusBody();
    }
    async function focusBody() {
      await page.locator('.body-block').first().click();
      await page.waitForFunction(() => !!bodyEditor?.model.active);
    }
    async function typeBody(index, text) {
      const root = page.locator(`.body-block[data-body-block="${index}"]`);
      if (!await root.locator('textarea').count()) await root.click();
      await root.locator('textarea').fill(text);
    }
    async function leaveBody() { await page.locator('#document-path').click(); }
    try {
      await test('Local Markdown no-op preserves complete CRLF source, special syntax and repeated headings', async () => {
        await bodyFixture();
        assert.equal(await page.evaluate(() => DocDokiBody.apply(bodyEditor.model, $('reading'))), bodySource);
        assert.equal(await page.evaluate(() => {
          const source = 'First\r\n', model = DocDokiBody.plan(source, source, markdown), root = document.createElement('div');
          DocDokiBody.mount(model, root, String); DocDokiBody.activate(model, model.append).value = 'Second';
          return DocDokiBody.apply(model, root);
        }), 'First\r\n\r\nSecond\r\n');
        assert.equal(await page.locator('#reading a[href="https://example.org"]').count(), 1);
        await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        assert.equal(await page.locator('.body-source').count(), 0);
        assert.equal(await page.evaluate(() => store.drafts.size), 0);
        assert.equal(await readFile(join(info.root, A), 'utf8'), bodySource);
        // Multiple newline conventions and Markdown structures remain byte-exact.
        assert.equal(await page.evaluate(() => {
          const samples = [
            '# Same\n\nSame\n\n[ref]: https://example.org\n\nSame\n',
            '# Tabs\r\n\r\n```text\r\n\tkeep &amp; <tag>\r\n```\r\n',
            '# Lists\n\n- [ ] task\n- nested\n  - item\n\n![image](pic.png)\n',
            '# Inline\n\n**bold** and *em* and `&amp;` and [link](https://example.org).\n',
          ];
          return samples.every(source => {
            const model = DocDokiBody.plan(source, source, markdown), root = document.createElement('article');
            DocDokiBody.mount(model, root, String);
            return DocDokiBody.apply(model, root) === source;
          });
        }), true);
      });
      await test('Returning from source cannot refocus over newer typing or navigation when the preview arrives late', async () => {
        await bodyFixture(); await mode(true);
        const held = await hold('**/preview');
        try {
          await page.locator('#source-view').click(); await held.wait();
          await typeBody(1, 'Typing after the view switch'); held.release();
          await page.waitForFunction(() => !previewPending);
          await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
          assert.equal(await page.locator('.body-source').evaluate(el => el === document.activeElement), true);
          assert.equal(await page.locator('.body-source').inputValue(), 'Typing after the view switch');
          assert.equal(await page.evaluate(() => store.drafts.size), 0);
        } finally { await held.close(); }
        await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /Typing after the view switch/);
        await bodyFixture(); await mode(true);
        const navigating = await hold('**/preview');
        try {
          await page.locator('#source-view').click(); await navigating.wait();
          await open(B); await page.locator('#search').focus(); navigating.release();
          await page.waitForFunction(() => !previewPending);
          await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
          assert.equal(await page.locator('#search').evaluate(el => el === document.activeElement), true);
          assert.equal(await page.evaluate(() => current), B);
        } finally { await navigating.close(); }
      });
      await test('Same-document anchors decode Unicode and survive no-op heading edits and source round trips', async () => {
        const source = bodySource + '\r\n## 目标\r\n\r\n[Jump](#%E7%9B%AE%E6%A0%87)\r\n\r\n[Second](#repeated-1)\r\n';
        await writeFile(join(info.root, A), source); await page.reload(); await open(A);
        await page.locator('#reading a').filter({ hasText: /^Jump$/ }).click();
        assert.equal(await page.getByRole('heading', { name: '目标', exact: true }).evaluate(el => el === document.activeElement), true);
        await page.getByRole('heading', { name: 'Repeated', exact: true }).last().click();
        await mode(true); await mode(false);
        assert.equal(await page.getByRole('heading', { name: 'Repeated', exact: true }).last().getAttribute('id'), 'heading-repeated-1');
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.locator('#reading a').filter({ hasText: /^Second$/ }).click();
          assert.equal(await page.getByRole('heading', { name: 'Repeated', exact: true }).last().evaluate(el =>
            el === document.activeElement && el.getBoundingClientRect().top >= document.querySelector('.source-bar').getBoundingClientRect().bottom
          ), true, 'Anchor targets stay below the sticky content bar on desktop and phones');
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(await page.evaluate(() => store.drafts.size), 0);
        assert.equal(await readFile(join(info.root, A), 'utf8'), source);
      });
      await test('Touch pans remain reading, taps enter local source, and phone input stays readable', async () => {
        await bodyFixture(); await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        const paragraph = page.locator('.body-block[data-body-block="1"]');
        await paragraph.click({ button: 'right' });
        assert.equal(await page.evaluate(() => !!bodyEditor), false, 'Context-menu presses do not enter editing');
        await page.keyboard.press('Escape');
        if (engine === 'chromium') {
          const cdp = await context.newCDPSession(page);
          try {
            const box = await paragraph.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 50 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 110 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            assert.equal(await page.evaluate(() => !!bodyEditor), false);
            await paragraph.tap(); await page.waitForFunction(() => !!bodyEditor?.model.active);
          } finally { await cdp.detach(); }
        } else {
          // Firefox's Playwright driver has no touch-enabled context. Verify the
          // pointerdown guard, leaving the native pan/tap sequence to Chromium.
          await paragraph.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 });
          await paragraph.focus(); assert.equal(await page.evaluate(() => !!bodyEditor), false);
          await paragraph.dispatchEvent('pointercancel', { pointerType: 'touch' });
          await paragraph.click(); await page.waitForFunction(() => !!bodyEditor?.model.active);
        }
        await page.setViewportSize({ width: 390, height: 900 });
        assert.equal(await page.locator('.body-source').evaluate(el => getComputedStyle(el).fontSize), '16px');
        await page.locator('.body-source').fill('Input after a deliberate tap');
        await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        assert.equal(await readFile(join(info.root, A), 'utf8'), bodySource);
        assert.match(await page.evaluate(p => store.source(p), A), /Input after a deliberate tap/);
        await page.setViewportSize({ width: 1440, height: 1000 });
      });
      await test('Local Markdown keeps literal syntax, previews on blur and saves only the captured source ranges', async () => {
        await bodyFixture();
        assert.equal(await page.locator('.body-source').inputValue(), '# Body');
        await typeBody(1, 'Updated **bold** and [link](https://example.org/guide).');
        const list = page.locator('.body-block').filter({ has: page.locator('ul') });
        await typeBody(await list.getAttribute('data-body-block'), '- First item\n- Second item\n- Third item');
        assert.equal(await page.locator('.body-block[data-body-block="1"] strong').textContent(), 'bold');
        assert.equal(await page.locator('.body-source').count(), 1);
        const code = page.locator('.body-block').filter({ has: page.locator('pre') });
        await typeBody(await code.getAttribute('data-body-block'), '```js\nconst value = 2;\n```');
        await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        const draft = await page.evaluate(p => store.source(p), A);
        assert.match(draft, /Updated \*\*bold\*\* and \[link\]\(https:\/\/example.org\/guide\)/);
        assert.match(draft, /Third item/); assert.match(draft, /```js\r\nconst value = 2;/);
        assert.equal(draft.slice(0, draft.indexOf('Updated')), bodySource.slice(0, bodySource.indexOf('A plain')));
        assert.ok(draft.includes('## Repeated\r\n\r\nKeep *this* spelling &amp; entity.\r\n\r\n## Repeated'));
        assert.equal(draft.slice(draft.indexOf('<!--')), bodySource.slice(bodySource.indexOf('<!--')));
        assert.equal(/(?<!\r)\n/.test(draft), false);
        assert.equal(await readFile(join(info.root, A), 'utf8'), bodySource);
        await saved(); assert.equal(await readFile(join(info.root, A), 'utf8'), draft);
        await closeChanges(); await mode(true); assert.equal((await page.locator('#source').inputValue()).replace(/\n/g, '\r\n'), draft);
      });
      await test('Body blur stages drafts without writing files; source transition, undo and language changes preserve input', async () => {
        await bodyFixture();
        const root = page.locator('.body-block[data-body-block="1"]');
        await typeBody(1, 'Kept through language change'); await language('zh');
        await page.waitForFunction(() => !bodyEditor && store.drafts.size === 1);
        assert.equal((await root.innerText()).trim(), 'Kept through language change');
        assert.equal(await readFile(join(info.root, A), 'utf8'), bodySource);
        await undo(); assert.equal(await page.evaluate(p => store.source(p), A), bodySource);
        await language('en'); await typeBody(1, 'One body edit');
        await root.dispatchEvent('compositionstart');
        await page.locator('#source-view').click(); assert.equal(await page.evaluate(() => sourceMode), false);
        assert.equal(await page.evaluate(() => bodyDirty()), true);
        await root.dispatchEvent('compositionend');
        await page.locator('#source-view').click(); await page.waitForFunction(() => sourceMode && !bodyEditor);
        assert.match(await page.locator('#source').inputValue(), /One body edit/);
        await undo(); assert.equal(await page.evaluate(p => store.source(p), A), bodySource);
      });
      await test('Composition finishing after blur and keyboard exit stage input without extra confirmation', async () => {
        await bodyFixture();
        const root = page.locator('.body-block[data-body-block="1"]');
        await typeBody(1, 'Keyboard input'); await root.dispatchEvent('compositionstart');
        await page.locator('#workspace').focus(); await page.waitForTimeout(30);
        assert.equal(await page.evaluate(() => !!bodyEditor && !store.drafts.size), true);
        await root.dispatchEvent('compositionend');
        try { await page.waitForFunction(() => !bodyEditor && store.drafts.size === 1, null, { timeout: 5000 }); }
        catch (error) {
          console.error(await page.evaluate(() => ({ composing, bodyPointerDown, focused: bodyFocused(), active: document.activeElement.outerHTML.slice(0, 300), pending: !!bodyEditor?.pending, status: $('preview-status').textContent, source: store.source(current) })));
          throw error;
        }
        assert.match(await page.evaluate(p => store.source(p), A), /Keyboard input/);
        assert.equal(await readFile(join(info.root, A), 'utf8'), bodySource);
        await typeBody(1, 'Second input'); await focusBody();
        await page.keyboard.press('Shift+Tab');
        await page.waitForFunction(() => !bodyEditor);
        assert.match(await page.evaluate(p => store.source(p), A), /Second input/);
        await undo(); assert.match(await page.evaluate(p => store.source(p), A), /Keyboard input/);
      });
      await test('Markdown headings, tables, tasks and references edit locally; code and unsafe HTML stay source-preserving', async () => {
        await bodyFixture();
        await typeBody(1, '## New heading\n\n**Bold** and *italic*');
        const table = page.locator('.body-block').filter({ has: page.locator('table') });
        await typeBody(await table.getAttribute('data-body-block'), '| Name | Value |\n| --- | --- |\n| x | 2 |');
        assert.equal(await page.locator('#reading h2').filter({ hasText: 'New heading' }).count(), 1);
        const code = page.locator('.body-block').filter({ has: page.locator('pre') });
        await typeBody(await code.getAttribute('data-body-block'), '```js\nline one\n\n\n```');
        await page.locator('.body-append').focus();
        await page.locator('.body-source').fill('## Added\n\n- [x] task\n  - nested\n\n[reference][ref]\n\n<script>not HTML</script>');
        await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        assert.equal(await page.locator('#reading table td').last().textContent(), '2');
        assert.equal(await page.locator('#reading input[type=checkbox][checked]').count(), 1);
        assert.equal(await page.locator('#reading script,#reading img').count(), 0);
        const draft = await page.evaluate(p => store.source(p), A);
        assert.match(draft, /## New heading\r\n\r\n\*\*Bold\*\*/);
        assert.match(draft, /```js\r\nline one\r\n\r\n\r\n```/);
        assert.match(draft, /\[reference\]\[ref\]/);
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          for (const locale of ['en', 'zh']) {
            await language(locale); await focusBody();
            assert.equal(await page.locator('.unresolved [data-en]').first().innerText(), locale === 'zh' ? '未解析链接' : 'unresolved link');
            assert.equal(await page.locator('.body-append').getAttribute('aria-label'), locale === 'zh' ? '添加段落' : 'Add paragraph');
            const input = page.locator('.body-source'), original = await input.inputValue();
            assert.equal(await input.getAttribute('aria-label'), locale === 'zh' ? '正文块 1' : 'Body block 1');
            await input.fill('# ' + 'Wrapped Markdown input '.repeat(25));
            await page.setViewportSize({ width: width - 20, height: 900 });
            await page.waitForFunction(() => { const el = document.querySelector('.body-source'); return el && el.scrollHeight <= el.clientHeight + 2; });
            await input.fill(original); await page.setViewportSize({ width, height: 900 });
            assert.equal(await page.locator('.body-source').evaluate(el => el.getBoundingClientRect().right <= innerWidth && el.scrollHeight <= el.clientHeight + 2), true);
            assert.equal(await page.locator('#body-toolbar,[contenteditable=true]').count(), 0);
            await shot('body-edit-phone'); await leaveBody(); await page.waitForFunction(() => !bodyEditor);
          }
        }
        await page.setViewportSize({ width: 1440, height: 1000 }); await language('en');
        await focusBody(); await shot('body-edit-desktop'); await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        await saved(); assert.equal(await readFile(join(info.root, A), 'utf8'), draft);
      });
      await test('Late blur responses cannot cross continued input or refocusing; failed validation keeps text', async () => {
        await bodyFixture();
        const root = page.locator('.body-block[data-body-block="1"]');
        await typeBody(1, 'First proposal');
        const held = await hold('**/preview', req => req.postDataJSON().edits.some(e => e.to.includes('First proposal')));
        try {
          await leaveBody(); await held.wait();
          await typeBody(1, 'Continued proposal'); held.release();
          await page.waitForFunction(() => bodyEditor && !bodyEditor.pending);
          assert.equal(await page.evaluate(() => store.drafts.size), 0); assert.equal(await root.locator('textarea').inputValue(), 'Continued proposal');
        } finally { await held.close(); }
        const refocused = await hold('**/preview');
        try {
          await leaveBody(); await refocused.wait();
          await root.focus(); refocused.release();
          await page.waitForFunction(() => bodyEditor && !bodyEditor.pending);
          assert.equal(await page.evaluate(() => store.drafts.size), 0);
          assert.equal(await root.evaluate(el => document.activeElement === el.querySelector('textarea')), true);
        } finally { await refocused.close(); }
        await typeBody(1, 'Retained on error');
        const fail = route => route.abort(); await page.route('**/preview', fail);
        try {
          await page.locator('#source-view').click(); await page.waitForFunction(() => bodyEditor && !bodyEditor.pending);
          assert.equal(await page.evaluate(() => sourceMode), false); assert.match(await page.evaluate(() => DocDokiBody.apply(bodyEditor.model, $('reading'))), /Retained on error/);
        } finally { await page.unroute('**/preview', fail); }
        await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        await saved(); assert.match(await readFile(join(info.root, A), 'utf8'), /Retained on error/);
      });
      await test('One navigation click stages body input, links still navigate, and plain reading needs no editing mode', async () => {
        await bodyFixture();
        const root = page.locator('.body-block[data-body-block="1"]');
        await typeBody(1, 'Before navigation');
        const held = await hold('**/preview');
        try {
          await page.locator(`#catalog [data-doc="${B}"]`).click(); await held.wait();
          assert.equal(await page.evaluate(() => current), A);
          held.release(); await page.waitForFunction(p => current === p && !bodyEditor, B);
        } finally { await held.close(); }
        assert.match(await page.evaluate(p => store.source(p), A), /Before navigation/);
        assert.equal(await readFile(join(info.root, A), 'utf8'), bodySource);
        await open(A); assert.equal(await page.locator('.body-source').count(), 0);
        const external = route => route.fulfill({ contentType: 'text/html', body: '<p>Local link fixture</p>' });
        await page.context().route('https://example.org/**', external);
        try {
          const popup = page.context().waitForEvent('page');
          await page.locator('#reading a[href="https://example.org"]').click();
          const linked = await popup; await linked.waitForLoadState();
          assert.equal(linked.url(), 'https://example.org/'); await linked.close(); await page.bringToFront();
        } finally { await page.context().unroute('https://example.org/**', external); }
        // Direct and reference-style internal links use their proper document identity.
        await writeFile(join(info.root, A), bodySource + '\r\n[Other](b.md)\r\n\r\n[Ref][other]\r\n\r\n[other]: b.md\r\n');
        await page.reload(); await open(A);
        for (const label of ['Other', 'Ref']) {
          await page.locator('#reading a').filter({ hasText: new RegExp(`^${label}$`) }).click();
          await page.waitForFunction(p => current === p, B); await open(A);
        }
      });
      await test('Body buffers block snapshot replacement and conflicts retain external bytes on disk', async () => {
        await bodyFixture(); await leaveBody(); await page.waitForFunction(() => !bodyEditor);
        const held = await hold('**/snapshot');
        try {
          await page.evaluate(() => { window.bodyOwner = store; window.bodySync = syncDocuments(); }); await held.wait();
          await focusBody();
          held.release(); await page.evaluate(() => window.bodySync);
          assert.equal(await page.evaluate(() => store === window.bodyOwner), true);
        } finally { await held.close(); }
        await typeBody(1, 'Human body');
        await writeFile(join(info.root, A), bodySource + '\r\nExternal change.\r\n');
        await page.evaluate(() => syncDocuments()); assert.equal(await page.evaluate(() => !!bodyEditor), true);
        await page.locator('#changes-toggle').click(); await page.waitForFunction(() => !bodyEditor && store.drafts.size === 1);
        await page.evaluate(() => syncDocuments()); assert.equal(await page.locator('#save').isDisabled(), true);
        assert.match(await page.evaluate(p => store.source(p), A), /Human body/);
        assert.match(await readFile(join(info.root, A), 'utf8'), /External change/);
      });
    } finally {
      await writeFile(join(info.root, A), bodyOriginal); await page.reload();
    }
    await test('303 cards render and drag without changing sources; detail stays readable', async () => {
      for (let i = 0; i < 300; i++) await writeFile(join(info.root, `docdoki/specs/generated-${i}.md`), `---\npurpose: Generated contract ${i}.\n${i ? `after: [generated-${i - 1}]\n` : ''}---\n# Generated ${i}\n\n## Goal\n\n- Preserve a complete contract.\n`);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => graph.nodes.length === 303);
      assert.equal(await page.locator('#graph-cards .spec-card').count(), 303);
      await page.evaluate(() => { pan = { x: 0, y: 0 }; scale = 1; transform(); });
      const box = await page.locator(`#graph-cards [data-node="${A}"]`).boundingBox(), start = performance.now();
      await page.mouse.move(box.x + 4, box.y + 4); await page.mouse.down();
      await page.mouse.move(box.x + 104, box.y + 34, { steps: 12 }); await page.mouse.up();
      assert.ok(performance.now() - start < 2500);
      assert.equal(await page.evaluate(p => offsets.has(p) && !store.drafts.size, A), true);
      await page.locator(`#graph-cards [data-node="${A}"]`).focus(); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => view), 'graph');
      await page.locator(`#graph-cards [data-doc="${A}"]`).focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(p => current === p && view === 'doc', A);
      assert.equal(await page.locator('#reading').evaluate(el => getComputedStyle(el).transform), 'none');
    });
    assert.deepEqual(errors, [], 'No uncaught browser errors');
  } finally {
    if (errors.length) console.error('Browser errors:', errors);
    if (process.env.PANEL_SCREENSHOT) await shot('last-state');
    await browser.close(); lines.close(); helper.kill('SIGTERM');
    await new Promise(resolve => helper.once('exit', resolve));
  }
}
console.log(`\n${checks} checks passed.`);
