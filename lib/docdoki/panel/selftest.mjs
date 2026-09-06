#!/usr/bin/env node
/* Pure state checks; --browser adds real browser checks using optional Playwright.
   Fixtures, screenshots and dependency installation never go into the skill. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
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
  assert.equal(s.undo(), 'B'); assert.equal(s.source('B'), 'B0'); assert.equal(s.source('A'), 'A1');
  s.undo(); assert.equal(s.drafts.size, 0);
});
check('Escape cancels only the active editing session', () => {
  const s = new DraftStore(docs);
  s.set('A', 'A1'); s.begin('A'); s.update('A2'); s.end(true);
  assert.equal(s.source('A'), 'A1'); assert.equal(s.edits()[0].to, 'A1');
  s.undo(); assert.equal(s.source('A'), 'A0');
});
check('Save locks all edit routes and adopts actual stored sources', () => {
  const s = new DraftStore(docs); s.set('A', 'A1');
  assert.equal(s.startSave()[0].to, 'A1'); assert.equal(s.startSave(), null);
  assert.equal(s.set('A', 'A2'), false); s.undo(); s.restore('A'); assert.equal(s.source('A'), 'A1');
  s.finishSave({ ok: true, documents: { A: { source: 'A1 normalized', path: 'A' } }, receipt: [{ path: 'A', from: 'A0', to: 'A1 normalized' }] });
  assert.equal(s.drafts.size, 0); assert.equal(s.source('A'), 'A1 normalized');
  s.set('A', 'A2'); assert.equal(s.edits()[0].from, 'A1 normalized'); assert.equal(s.receipt.length, 1);
});
check('Failed saves retain drafts, history and baseline', () => {
  const s = new DraftStore(docs); s.set('A', 'A1'); s.startSave(); s.finishSave({ ok: false });
  assert.equal(s.source('A'), 'A1'); assert.equal(s.edits()[0].from, 'A0'); s.undo(); assert.equal(s.drafts.size, 0);
});
check('Rebase advances the version even when the merged draft matches the new baseline', () => {
  const s = new DraftStore(docs);
  let version = s.version;
  assert.equal(s.rebase({ path: 'A', source: 'A0' }), true);
  assert.ok(s.version > version); assert.equal(s.drafts.size, 0);
  s.set('A', 'A1'); version = s.version;
  s.rebase({ path: 'A', source: 'A1' });
  assert.ok(s.version > version); assert.equal(s.drafts.size, 0); assert.equal(s.source('A'), 'A1');
  s.set('A', 'A2'); s.rebase({ path: 'A', source: 'external A' });
  assert.equal(s.edits()[0].from, 'external A'); assert.equal(s.source('A'), 'A2');
  s.startSave(); version = s.version;
  assert.equal(s.rebase({ path: 'A', source: 'must not replace' }), false);
  assert.equal(s.version, version); assert.equal(s.edits()[0].from, 'external A');
});
check('CRLF source edits preserve line endings', () => {
  const s = new DraftStore({ A: { source: 'A\r\nB\r\n' } }); s.begin('A'); s.update('A\nC\n'); s.end();
  assert.equal(s.source('A'), 'A\r\nC\r\n');
});
check('Diff is bounded, complete and HTML-safe', () => {
  const a = Array.from({ length: 4000 }, (_, i) => 'old ' + i).join('\n');
  const b = Array.from({ length: 4000 }, (_, i) => 'new ' + i).join('\n');
  const start = performance.now(); const html = diffHTML(a, b);
  assert.ok(performance.now() - start < 1000); assert.ok(html.includes('budget exceeded'));
  assert.ok(html.includes('new 3999')); assert.ok(html.includes('old 3999'));
  assert.ok(diffHTML('a\nb', 'a\n<script>').includes('&lt;script&gt;'));
  assert.ok(diffHTML('same words old', 'same words new').includes('<ins>new</ins>'));
  assert.equal(diffOps(['x'], ['x']).length, 1);
});

if (process.argv.includes('--browser')) {
  const engines = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
  const engine = process.env.PANEL_BROWSER || 'chromium';
  assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'Supported PANEL_BROWSER');
  const browser = await engines[engine].launch({ headless: true });
  const helper = spawn(process.env.PYTHON || 'python3', ['-B', join(here, 'selftest.py'), '--serve'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = createInterface({ input: helper.stdout });
  const info = await new Promise((resolve, reject) => {
    lines.once('line', line => { try { resolve(JSON.parse(line)); } catch (error) { reject(error); } });
    helper.once('error', reject); helper.once('exit', code => reject(new Error('Fixture server exited: ' + code)));
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: engine !== 'firefox' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const A = 'docdoki/specs/a.md', B = 'docdoki/specs/b.md';
  async function test(name, fn) { await fn(); checks++; console.log(`PASS ${engine}:`, name); }
  async function open(path) {
    await page.locator('#catalog [data-doc]').filter({ has: page.locator(`small:text-is("${path}")`) }).first().click();
    await page.waitForFunction(p => current === p && view === 'doc' && !editing, path);
  }
  async function edit(path, transform) {
    await open(path); await page.locator('#edit-mode').click();
    await page.locator('#source').fill(transform(await page.locator('#source').inputValue()));
    await page.locator('#read-mode').click();
    await page.waitForFunction(() => document.getElementById('preview-status').hidden);
  }
  async function saved() {
    await page.locator('#save').click();
    await page.waitForFunction(() => !store.busy && store.drafts.size === 0);
  }
  try {
    await page.goto(info.url);
    // Isolate dependency races from the normal fixture's b -> a relationship.
    const C = 'docdoki/specs/c.md';
    const originals = new Map(await Promise.all([A, B].map(async p => [p, await readFile(join(info.root, p), 'utf8')])));
    async function dependencyFixture(after = []) {
      for (const [path, title] of [[A, 'Export'], [B, 'Validation'], [C, 'Publication']])
        await writeFile(join(info.root, path), `---\nafter: ${JSON.stringify(path === A ? after : [])}\n---\n# ${title}\n\nKeep the original requirement.\n`);
      await page.reload(); await open(A);
      // Observe completion without replacing application logic or backend results.
      await page.evaluate(() => {
        const dependency = changeDependency, preview = updatePreview;
        changeDependency = (...args) => (window.dependencyRequest = dependency(...args));
        window.previewRequests = [];
        updatePreview = (...args) => {
          const pending = preview(...args); window.previewRequests.push(pending); return pending;
        };
      });
    }
    async function holdPreviews(predicate) {
      let release, arrived = false, failure;
      const gate = new Promise(resolve => { release = resolve; });
      const handler = async route => {
        if (!predicate(route.request().postDataJSON())) return route.continue();
        try {
          const response = await route.fetch({ timeout: 10000 });
          arrived = true;
          await gate; await route.fulfill({ response });
        } catch (error) { failure = error; }
      };
      await page.route('**/preview', handler);
      return { release, async wait() {
        const deadline = Date.now() + 10000;
        while (!arrived && !failure && Date.now() < deadline) await page.waitForTimeout(10);
        if (failure) throw failure;
        assert.ok(arrived, 'The real backend response is held');
      }, async close() { release(); await page.unroute('**/preview', handler); } };
    }
    try {
      await test('A dependency response from before Refresh cannot erase external content on save', async () => {
        await dependencyFixture();
        const held = await holdPreviews(payload => !!payload.after);
        try {
          await page.locator('#related details summary').click();
          await page.locator('#dependency-target').selectOption('c');
          await page.locator('#add-dependency').click(); await held.wait();
          await page.evaluate(() => { window.previousStore = store; });
          const external = (await readFile(join(info.root, A), 'utf8')) + '\nExternal audit retention requirement.\n';
          await writeFile(join(info.root, A), external);
          await page.locator('#refresh').click();
          await page.waitForFunction(() => store !== window.previousStore);
          assert.equal(await page.evaluate(() => store.version), 0);
          assert.equal(await page.evaluate(p => store.source(p), A), external);
          held.release(); await page.evaluate(() => window.dependencyRequest);
          const pending = await page.evaluate(() => store.drafts.size);
          await edit(A, text => text + '\nNew local requirement after refresh.\n');
          await saved();
          const actual = await readFile(join(info.root, A), 'utf8');
          assert.match(actual, /External audit retention requirement/);
          assert.match(actual, /New local requirement after refresh/);
          assert.equal(pending, 0, 'Old snapshot response did not stage a draft');
          assert.deepEqual(await page.evaluate(p => graph.documents[p].fm.after, A), []);
        } finally { await held.close(); }
      });
      await test('Pending dependencies cannot cross further typing or an unchanged-source rebase', async () => {
        for (const action of ['typing', 'rebase']) {
          await dependencyFixture();
          const held = await holdPreviews(payload => !!payload.after);
          try {
            await page.locator('#related details summary').click();
            await page.locator('#dependency-target').selectOption('c');
            await page.locator('#add-dependency').click(); await held.wait();
            await page.evaluate(() => { window.previousStore = store; });
            if (action === 'typing') await edit(A, text => text + '\nLater typed requirement.\n');
            else {
              await page.locator('#latest').click();
              await page.waitForFunction(() => latestDocument !== null);
              await page.locator('#rebase').click();
            }
            assert.equal(await page.evaluate(() => store === window.previousStore && store.version > 0), true);
            held.release(); await page.evaluate(() => window.dependencyRequest);
            assert.equal(await page.evaluate(() => store.drafts.size), action === 'typing' ? 1 : 0);
            await edit(A, text => text + '\nIntent after dependency request.\n');
            await saved();
            const actual = await readFile(join(info.root, A), 'utf8');
            assert.match(actual, /after: \[\]/);
            assert.match(actual, /Intent after dependency request/);
            if (action === 'typing') assert.match(actual, /Later typed requirement/);
          } finally { await held.close(); }
        }
      });
      await test('Adding a dependency during a delayed preview preserves typed dependencies through save', async () => {
        await dependencyFixture();
        const held = await holdPreviews(payload => !payload.after);
        try {
          await page.locator('#edit-mode').click();
          await page.locator('#source').fill((await page.locator('#source').inputValue()).replace('after: []', 'after: [b]'));
          await page.locator('#read-mode').click(); await held.wait();
          assert.deepEqual(await page.evaluate(p => graph.nodes.find(n => n.path === p).after, A), []);
          await page.locator('#related details summary').click();
          await page.locator('#dependency-target').selectOption('c');
          await page.locator('#add-dependency').click();
          await page.evaluate(() => window.dependencyRequest);
          held.release(); await page.evaluate(() => Promise.all(window.previewRequests));
          await page.waitForFunction(() => !previewPending);
          await saved();
          assert.match(await readFile(join(info.root, A), 'utf8'), /after: \["b", "c"\]/);
          assert.deepEqual(await page.evaluate(p => graph.documents[p].fm.after, A), ['b', 'c']);
        } finally { await held.close(); }
      });
      await test('Removing a dependency after a failed preview preserves other typed dependencies on disk', async () => {
        await dependencyFixture(['b']);
        const failPreview = route => route.request().postDataJSON().after ? route.continue() : route.abort();
        await page.route('**/preview', failPreview);
        try {
          await page.locator('#edit-mode').click();
          await page.locator('#source').fill((await page.locator('#source').inputValue()).replace('after: ["b"]', 'after: [b, c]'));
          await page.locator('#read-mode').click();
          await page.waitForFunction(() => !!previewError);
          assert.deepEqual(await page.evaluate(p => graph.nodes.find(n => n.path === p).after, A), ['b']);
          await page.locator('#related details summary').click();
          await page.locator('[data-remove-after="b"]').click();
          await page.evaluate(() => window.dependencyRequest);
          await page.unroute('**/preview', failPreview);
          await saved();
          assert.match(await readFile(join(info.root, A), 'utf8'), /after: \["c"\]/);
          assert.deepEqual(await page.evaluate(p => graph.documents[p].fm.after, A), ['c']);
        } finally { await page.unroute('**/preview', failPreview); }
      });
    } finally {
      for (const [path, source] of originals) await writeFile(join(info.root, path), source);
      await rm(join(info.root, C), { force: true });
      await page.reload();
    }
    await test('Overview, full Markdown, private stages, notes and archive', async () => {
      assert.match(await page.locator('#reading').innerText(), /Atomic publication is not implemented/);
      assert.equal(await page.locator('#reading table').count(), 1);
      assert.match(await page.locator('#catalog').innerText(), /Local work/);
      await open(A);
      const text = await page.locator('#reading').innerText();
      for (const value of ['An introduction', 'Non-goals', 'First section.', 'Second section.']) assert.ok(text.includes(value));
      assert.equal(await page.locator('#reading pre').count(), 1);
      await page.locator('#reading [data-doc="docdoki/notes/evidence.md"]').click();
      await page.waitForFunction(() => current === 'docdoki/notes/evidence.md');
      assert.match(await page.locator('#reading').innerText(), /useful observation/);
      await page.locator('#catalog details summary').click();
      await page.locator('#catalog [data-doc="docdoki/stages/archive/follow-old.md"]').click();
      await page.waitForFunction(() => current === 'docdoki/stages/archive/follow-old.md');
      assert.match(await page.locator('#reading').innerText(), /Archived knowledge/);
    });
    await test('Single readable H1, stable preview focus, and explicit source title', async () => {
      await open(A);
      assert.equal(await page.locator('#view-title').isVisible(), false);
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      assert.equal(await page.locator('#reading h1').evaluate(el => el === document.activeElement), true);
      await page.evaluate(() => updatePreview());
      assert.equal(await page.locator('#reading h1').evaluate(el => el === document.activeElement), true);
      await page.locator('#edit-mode').click();
      assert.equal(await page.locator('#view-title').isVisible(), true);
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      assert.match(await page.locator('#source').inputValue(), /# Export/);
      await page.locator('#read-mode').click();
    });
    await test('Restore remains clickable during editor blur; undo reports actual drafts', async () => {
      await open(A); await page.locator('#edit-mode').click();
      const original = await page.locator('#source').inputValue();
      await page.locator('#source').fill(original + '\nFirst draft.\n');
      const restore = page.locator(`[data-restore="${A}"]`);
      await restore.waitFor();
      const handle = await restore.elementHandle();
      await page.locator('#source').fill(original + '\nSecond draft.\n');
      await handle.click();
      await page.waitForFunction(() => store.drafts.size === 0);
      assert.equal(await page.locator('#source').inputValue(), original);
      assert.match(await page.locator('#status').innerText(), /Restored file.*No unsaved changes/s);
      await page.locator('#undo').click();
      assert.match(await page.locator('#source').inputValue(), /Second draft/);
      assert.match(await page.locator('#status').innerText(), /Undid last edit.*1 document/s);
      await page.locator('#undo').click();
      await page.locator('#read-mode').click();
      assert.match(await page.locator('#status').innerText(), /No unsaved changes/);
    });
    await test('Native typing, IME Enter, newline paste, focus and Escape', async () => {
      await open(A); await page.locator('#edit-mode').click();
      const original = await page.locator('#source').inputValue();
      await page.locator('#source').press('ControlOrMeta+End');
      await page.locator('#source').pressSequentially('XYZ', { delay: 40 });
      await page.waitForTimeout(400);
      assert.match(await page.locator('#source').inputValue(), /XYZ$/);
      assert.equal(await page.locator('#source').evaluate(el => el === document.activeElement), true);
      await page.locator('#source').dispatchEvent('compositionstart');
      await page.locator('#source').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
      await page.locator('#source').dispatchEvent('compositionend');
      assert.equal(await page.evaluate(() => editing), true);
      await page.locator('#source').fill(original + '\n中文草稿\nNext line\n');
      assert.match(await page.locator('#source').inputValue(), /中文草稿\nNext line/);
      await page.locator('#source').press('Escape');
      assert.equal(await page.locator('#source').inputValue(), original);
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await page.locator('#read-mode').click();
    });
    await test('Chronological multi-file undo, draft search and source preservation', async () => {
      await edit(A, text => text.replace('Local export', 'SearchableDraft export'));
      await edit(B, text => text.replace('Validate local rows.', 'Validate typed rows.'));
      await edit(A, text => text.replace('Second section.', 'Second changed.'));
      await page.locator('#search').fill('SearchableDraft');
      assert.equal(await page.locator('#catalog [data-doc="' + A + '"]').count(), 1);
      await page.locator('#search').fill('');
      if (!(await page.locator('#changes').isVisible())) await page.locator('#changes-toggle').click();
      await page.locator('#undo').click();
      assert.match(await page.evaluate(p => store.source(p), A), /Second section\./);
      assert.match(await page.evaluate(p => store.source(p), B), /Validate typed rows/);
      await page.locator('#undo').click();
      assert.match(await page.evaluate(p => store.source(p), B), /Validate local rows/);
    });
    await test('Delayed save locks edits and retains a canonical follow receipt', async () => {
      let finish;
      await page.route('**/save', async route => {
        const response = await route.fetch();
        await new Promise(resolve => { finish = resolve; });
        await route.fulfill({ response });
      });
      await page.locator('#save').click();
      await page.waitForFunction(() => store.busy);
      assert.equal(await page.locator('#undo').isDisabled(), true);
      assert.equal(await page.locator('#source').getAttribute('readonly'), '');
      assert.equal(await page.evaluate(p => store.set(p, 'lost edit'), A), false);
      while (!finish) await page.waitForTimeout(20);
      finish();
      await page.waitForFunction(() => !store.busy && store.drafts.size === 0);
      await page.unroute('**/save');
      assert.equal(await page.locator('#copy-receipt').isDisabled(), false);
      assert.equal(await page.evaluate(p => store.source(p), A), await readFile(join(info.root, A), 'utf8'));
      assert.match(await page.evaluate(() => buildPrompt(true)), /already been saved/);
      assert.ok(!(await page.evaluate(() => buildPrompt(true))).includes('UNSAVED'));
    });
    await test('Second save uses actual baseline; clipboard failure exposes complete prompt', async () => {
      await edit(A, text => text.replace('SearchableDraft export', 'Second export'));
      await saved();
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
      await page.locator('#copy-receipt').click();
      assert.match(await page.locator('#status').innerText(), /Copy failed/);
      assert.equal(await page.locator('#prompt').isVisible(), true);
      assert.match(await page.locator('#prompt').inputValue(), /Second export/);
    });
    await test('External conflict, compare and explicit rebase retain merged intent', async () => {
      await edit(A, text => text + '\nHuman draft.\n');
      assert.equal(await page.locator('#prompt').isVisible(), false, 'Edits invalidate stale displayed requests');
      assert.equal(await page.locator('#prompt').inputValue(), '');
      const disk = await readFile(join(info.root, A), 'utf8');
      await writeFile(join(info.root, A), disk + '\nExternal obligation.\n');
      await page.locator('#save').click();
      await page.waitForFunction(() => !store.busy);
      assert.match(await page.locator('#status').innerText(), /conflict/);
      assert.equal(await page.evaluate(() => store.drafts.size), 1);
      await page.locator('#latest').click();
      await page.waitForFunction(() => latestDocument !== null);
      assert.match(await page.locator('#latest-source').innerText(), /External obligation/);
      await page.locator('#edit-mode').click();
      await page.locator('#source').fill((await page.locator('#source').inputValue()) + '\nExternal obligation.\n');
      await page.locator('#read-mode').click();
      await page.locator('#rebase').click();
      await saved();
      const actual = await readFile(join(info.root, A), 'utf8');
      assert.match(actual, /External obligation/); assert.match(actual, /Human draft/);
    });
    await test('Dependency editing rejects cycles; edge selection never removes an edge', async () => {
      await open(A); await page.locator('#related details summary').click();
      await page.locator('#dependency-target').selectOption('b');
      await page.locator('#add-dependency').click();
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('cyc'));
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await page.locator('[data-nav="specs"]').click(); await page.locator('#graph-view').click();
      const edgeIndex = await page.evaluate(p => edgeViews.findIndex(e => e.to === p), B);
      await page.locator(`#edge-lines .edge[data-edge="${edgeIndex}"]`).dispatchEvent('click');
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
      await page.locator('#edge-detail [data-remove-after]').click();
      await page.waitForFunction(() => store.drafts.size === 1);
      assert.equal(await page.evaluate(p => graph.nodes.find(n => n.path === p).col, B), 1);
      await page.locator('#undo').click();
    });
    await test('1024 and mobile layout stay inside the viewport', async () => {
      for (const width of [1024, 390]) {
        await page.setViewportSize({ width, height: 900 });
        if (!(await page.locator('#changes').isVisible())) await page.locator('#changes-toggle').click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok((await page.locator('#workspace').boundingBox()).width >= (width === 390 ? 370 : 760));
        for (const locale of ['zh', 'en']) {
          await page.locator('#language').click();
          await page.waitForFunction(l => document.documentElement.lang === (l === 'zh' ? 'zh-CN' : 'en'), locale);
          const drawer = await page.locator('#changes').boundingBox();
          const search = await page.locator('#search').boundingBox();
          const banner = await page.locator('.top').boundingBox();
          assert.ok(drawer.width >= 320 && drawer.x >= 0 && drawer.x + drawer.width <= width, JSON.stringify(drawer));
          assert.ok(Math.abs(drawer.y - (banner.y + banner.height)) < 2);
          assert.ok(search.width >= (width === 390 ? 330 : 180), JSON.stringify(search));
          const close = await page.locator('#changes-close').boundingBox();
          assert.ok(close.x >= 0 && close.x + close.width <= width);
          if (width === 390) assert.ok(close.width >= 44 && close.height >= 44);
          if (process.env.PANEL_SCREENSHOT && locale === 'zh') await page.screenshot({ path: process.env.PANEL_SCREENSHOT.replace(/\.png$/, `-${width}-zh.png`), fullPage: true });
        }
        await page.evaluate(() => { setChanges(false); setLibrary(false); navigate('overview'); });
        if (width > 760) await page.evaluate(() => setLibrary(true));
        await page.waitForFunction(() => document.getElementById('preview-status').hidden);
        if (process.env.PANEL_SCREENSHOT) await page.screenshot({ path: process.env.PANEL_SCREENSHOT.replace(/\.png$/, `-${width}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test('Narrow drawers have keyboard exits; typing never opens an overlay', async () => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.locator('#library-toggle').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#library-toggle').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#library-close').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-nav="overview"]').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.getElementById('library-toggle').matches('[aria-expanded="true"]'));
      assert.equal(await page.locator('#reading h1').evaluate(el => el === document.activeElement), true);
      await page.locator('#edit-mode').click();
      const original = await page.locator('#source').inputValue();
      await page.locator('#source').fill(original + '\nNarrow-screen edit.\n');
      await page.waitForFunction(() => document.getElementById('preview-status').hidden);
      assert.equal(await page.locator('#changes').isVisible(), false);
      assert.equal(await page.locator('#source').evaluate(el => el === document.activeElement), true);
      await page.locator('#changes-toggle').click();
      assert.equal(await page.locator('#workspace').evaluate(el => el.inert), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#changes-toggle').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('#workspace').evaluate(el => el.inert), false);
      await page.keyboard.press('ControlOrMeta+z');
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
      if (engine !== 'firefox') {
        await page.locator('#library-toggle').tap();
        assert.equal(await page.locator('#library-close').isVisible(), true);
        await page.locator('#library-close').tap();
        assert.equal(await page.locator('#library-toggle').getAttribute('aria-expanded'), 'false');
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('#read-mode').click();
    });
    await test('Diff and translation stay stable; stale clipboard callbacks and preview failures retain drafts', async () => {
      await edit(A, text => text + '\nPreview draft.\n');
      await page.evaluate(() => { navigator.clipboard.writeText = () => new Promise((_, reject) => { window.rejectCopy = reject; }); });
      await page.locator('#copy-drafts').click();
      await page.waitForFunction(() => typeof window.rejectCopy === 'function');
      const summary = page.locator('.change-diff summary').first();
      await summary.click();
      await page.locator('#edit-mode').click();
      await page.locator('#source').fill((await page.locator('#source').inputValue()) + '\nSecond preview draft.\n');
      await page.waitForFunction(() => document.querySelector('.change-diff').textContent.includes('Second preview draft'));
      await page.evaluate(() => window.rejectCopy(new Error('late clipboard rejection')));
      assert.equal(await page.locator('#prompt').isVisible(), false);
      assert.match(await page.locator('#status').innerText(), /Draft updated/);
      assert.equal(await page.locator('.full-diff').first().getAttribute('open'), '');
      await page.locator('#language').click();
      assert.match(await summary.innerText(), /完整修改前后/);
      assert.equal(await page.locator('#changes-close').getAttribute('aria-label'), '关闭改动');
      await page.locator('#language').click();
      await page.route('**/preview', route => route.abort());
      await page.locator('#source').fill((await page.locator('#source').inputValue()) + '\nRetain on failure.\n');
      await page.waitForFunction(() => previewError !== null);
      assert.match(await page.locator('#preview-status').innerText(), /Preview unavailable/);
      assert.match(await page.evaluate(p => store.source(p), A), /Retain on failure/);
      await page.unroute('**/preview');
      await page.locator('#read-mode').click();
      await page.waitForFunction(() => document.getElementById('preview-status').hidden);
      assert.match(await page.locator('#reading').innerText(), /Retain on failure/);
      await page.locator(`[data-restore="${A}"]`).click();
      await page.waitForFunction(() => store.drafts.size === 0 && document.getElementById('preview-status').hidden);
    });
    await test('Private prompt is labelled and no drafts enter browser storage', async () => {
      await edit('docdoki/private/specs/local.md', text => text + '\nPrivate adjustment.\n');
      assert.equal(await page.locator('#private-warning').isVisible(), true);
      assert.match(await page.evaluate(() => buildPrompt(false)), /\[PRIVATE\]/);
      const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
      assert.ok(keys.every(key => key === 'ddpanel-lang'));
      await page.locator('#undo').click();
    });
    await test('Refresh never discards edits made while its request is pending', async () => {
      let finish;
      await page.route('**/snapshot', async route => {
        const response = await route.fetch();
        await new Promise(resolve => { finish = resolve; });
        await route.fulfill({ response });
      });
      await open(A);
      await page.locator('#refresh').click();
      await page.locator('#edit-mode').click();
      await page.locator('#source').fill((await page.locator('#source').inputValue()) + '\nConcurrent refresh draft.\n');
      while (!finish) await page.waitForTimeout(20);
      finish();
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('Refresh not applied'));
      assert.match(await page.evaluate(p => store.source(p), A), /Concurrent refresh draft/);
      await page.unroute('**/snapshot');
      await page.locator('#read-mode').click();
      if (!(await page.locator('#changes').isVisible())) await page.locator('#changes-toggle').click();
      await page.locator('#undo').click();
    });
    await test('303 specs render, drag only incident geometry, and preserve readable detail', async () => {
      for (let i = 0; i < 300; i++) await writeFile(join(info.root, `docdoki/specs/generated-${i}.md`), `---\npurpose: Generated contract ${i}.\n${i ? `after: [generated-${i - 1}]\n` : ''}---\n# Generated ${i}\n\n## Goal\n\n- Preserve a complete contract.\n`);
      await page.locator('#refresh').click();
      await page.waitForFunction(() => graph.nodes.length === 303);
      await page.locator('[data-nav="specs"]').click(); await page.locator('#graph-view').click();
      assert.equal(await page.locator('#graph-cards .spec-card').count(), 303);
      await page.evaluate(() => { pan = { x: 0, y: 0 }; scale = 1; transform(); });
      const handle = page.locator('#graph-cards [data-drag="' + A + '"]');
      const box = await handle.boundingBox();
      const started = performance.now();
      await page.mouse.move(box.x + 30, box.y + 20); await page.mouse.down();
      await page.mouse.move(box.x + 130, box.y + 50, { steps: 12 }); await page.mouse.up();
      assert.ok(performance.now() - started < 2500);
      assert.ok(await page.evaluate(p => offsets.has(p), A));
      await page.locator('#graph-cards [data-node="' + A + '"]').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(p => current === p && view === 'doc', A);
      assert.equal(await page.locator('#reading').evaluate(el => getComputedStyle(el).transform), 'none');
      if (process.env.PANEL_SCREENSHOT) await page.screenshot({ path: process.env.PANEL_SCREENSHOT, fullPage: true });
    });
    assert.deepEqual(errors, [], 'No uncaught browser errors');
  } finally {
    await browser.close(); lines.close(); helper.kill('SIGTERM');
    await new Promise(resolve => helper.once('exit', resolve));
  }
}
console.log(`\n${checks} checks passed.`);
