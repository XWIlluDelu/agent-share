import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export default async function editorChecks({
  here,
  page,
  info,
  A,
  B,
  rich,
  test,
  settled,
  board,
  open,
  mode,
  fixture,
  source,
  leave,
  selectText,
  replaceText,
  saved,
  discard,
  shot,
  language,
  network,
}) {
  await test("Continuous live document keeps headings and inline styles while typing, without block inputs", async () => {
    await fixture();
    const h = page.getByRole("heading", { level: 1 }),
      font = await h.evaluate((el) => getComputedStyle(el).font);
    assert.equal(await page.locator("#reading textarea").count(), 0);
    assert.equal(await page.locator("#source").getAttribute("contenteditable"), "true");
    await replaceText("# Body", "# Human design");
    assert.equal(await h.evaluate((el) => getComputedStyle(el).font), font);
    await replaceText("A plain paragraph.", "A **bold** paragraph with *emphasis*.");
    assert.equal(
      await page
        .locator(".md-strong")
        .first()
        .evaluate((el) => getComputedStyle(el).fontWeight),
      "700",
    );
    assert.equal(await page.locator("#source").evaluate((el) => getComputedStyle(el).outlineStyle), "none");
    assert.equal(await page.locator("#changes").isVisible(), false);
    assert.equal(await page.locator("#count").textContent(), "1");
    await leave();
    assert.match(await source(), /# Human design/);
    assert.equal(await readFile(join(info.root, A), "utf8"), rich);
    await shot("live-document");
  });

  await test("Real pointer selection crosses rendered paragraphs without exposing an input box", async () => {
    await fixture();
    const points = await page.evaluate(() => {
      const v = bodySurface.model.view,
        text = v.state.doc.toString();
      return [v.coordsAtPos(text.indexOf("plain paragraph.")), v.coordsAtPos(text.indexOf("Keep *this*"))];
    });
    await page.mouse.move(points[0].left, (points[0].top + points[0].bottom) / 2);
    await page.mouse.down();
    await page.mouse.move(points[1].left, (points[1].top + points[1].bottom) / 2, { steps: 12 });
    await page.mouse.up();
    const selected = await page.evaluate(() => {
      const v = bodySurface.model.view,
        r = v.state.selection.main;
      return v.state.sliceDoc(r.from, r.to);
    });
    assert.equal(selected, "plain paragraph.\n\n## Repeated\n\n");
    await page.keyboard.insertText("continuous text ");
    assert.match(await source(), /A continuous text Keep \*this\*/);
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await source(), rich);
  });

  await test("Formatting shortcuts and live task checkboxes make exact undoable source edits", async () => {
    await fixture(rich + "\r\n- [ ] Review design\r\n");
    await selectText("plain");
    await page.keyboard.press("ControlOrMeta+b");
    assert.match(await source(), /A \*\*plain\*\* paragraph/);
    await page.keyboard.press("ControlOrMeta+b");
    assert.match(await source(), /A plain paragraph/);
    const task = page.getByRole("checkbox", { name: "Review design" });
    await task.check();
    assert.equal(await task.isChecked(), true);
    assert.match(await source(), /- \[x\] Review design/);
    await page.keyboard.press("ControlOrMeta+z");
    assert.match(await source(), /- \[ \] Review design/);
    await leave();
    assert.equal(await readFile(join(info.root, A), "utf8"), rich + "\r\n- [ ] Review design\r\n");
  });

  await test("Cross-paragraph selection, undo and redo share one native editor through source switches", async () => {
    await fixture();
    const selected = "A plain paragraph.\n\n## Repeated\n\nKeep *this* spelling &amp; entity.";
    await replaceText(selected, "A continuous replacement.");
    assert.doesNotMatch(await source(), /Keep \*this\*/);
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await source(), rich);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    assert.match(await source(), /A continuous replacement/);
    await page.evaluate(() => {
      window.editorIdentity = bodySurface.model.view;
      window.selectionBeforeMode = bodySurface.model.view.state.selection.toJSON();
    });
    await mode(true);
    assert.equal(await page.evaluate(() => bodySurface.model.view === window.editorIdentity), true);
    assert.deepEqual(
      await page.evaluate(() => bodySurface.model.view.state.selection.toJSON()),
      await page.evaluate(() => window.selectionBeforeMode),
    );
    await page.locator("#source").focus();
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await source(), rich);
    await mode(false);
    assert.equal(await page.evaluate(() => bodySurface.model.view === window.editorIdentity), true);
    await leave();
  });

  await test("Table cells stay laid out during real typing and keep exact Markdown delimiters", async () => {
    await fixture();
    const cell = page.getByRole("cell").filter({ hasText: /^ 1 $/ });
    assert.equal(await cell.count(), 1);
    const box = await cell.boundingBox();
    await cell.click();
    await page.keyboard.type("2");
    assert.equal(await page.getByRole("cell").count(), 2);
    assert.equal(await page.locator(".md-table-row").count(), 2);
    assert.ok(Math.abs((await page.getByRole("cell").last().boundingBox()).width - box.width) < 1);
    assert.match(await source(), /\| x \|[^\r\n]*2[^\r\n]*\|/);
    await leave();
    assert.equal(await readFile(join(info.root, A), "utf8"), rich);
    await shot("table");
  });

  await test("List continuation, literal Markdown paste and byte-preserving CRLF edits", async () => {
    await fixture();
    await selectText("Second item");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Third item");
    assert.match(await source(), /- Second item\r\n- Third item/);
    await replaceText("A plain paragraph.", "中文 **加粗** 与 [链接](b.md).");
    await leave();
    const text = await source();
    assert.equal(text.slice(0, text.indexOf("中文")), rich.slice(0, rich.indexOf("A plain")));
    assert.equal(text.slice(text.indexOf("<!--")), rich.slice(rich.indexOf("<!--")));
    assert.equal(text.replace(/\r\n/g, "").includes("\n"), false);
    await saved();
    assert.equal(await readFile(join(info.root, A), "utf8"), text);
  });

  await test("Mixed line endings and source cancellation retain exact captured bytes", async () => {
    const mixed = rich.replace("A plain paragraph.\r\n\r\n", "A plain paragraph.\n\n");
    await fixture(mixed);
    await replaceText("Second item", "Changed item");
    assert.equal(await source(), mixed.replace("Second item", "Changed item"));
    await mode(true);
    const before = await source();
    await replaceText("Body editing", "Temporary intent");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !bodyEditor);
    assert.equal(await source(), before);
    assert.equal(await readFile(join(info.root, A), "utf8"), mixed);
  });

  await test("Live select-all cannot silently delete hidden frontmatter; full source can edit it", async () => {
    await fixture();
    await page.locator("#source").focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("Replacement body");
    assert.equal((await source()).split("# Body")[0].startsWith(rich.slice(0, rich.indexOf("# Body"))), true);
    assert.match(await source(), /Replacement body/);
    await mode(true);
    await replaceText('purpose: "Body editing"', 'purpose: "New intent"');
    await leave();
    assert.match(await source(), /purpose: "New intent" # keep this comment/);
  });

  await test("Shared frontmatter forms are protected in the real live editor, including unclosed metadata", async () => {
    const cases = JSON.parse(await readFile(join(here, "frontmatter-cases.json"), "utf8"));
    for (const c of cases) {
      await fixture(c.source);
      const before = await source();
      const start = await page.evaluate(() =>
        DocDokiBody.bodyStart(bodySurface.model.view.state.doc.toString()),
      );
      const expected = c.error ? c.source.length : c.source.length - c.body.length;
      assert.equal(start, c.source.slice(0, expected).replace(/\r\n/g, "\n").length, c.name);
      if (start) {
        await page.locator("#source").focus();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.press("Backspace");
        assert.equal(
          (await source()).slice(0, expected),
          before.slice(0, expected),
          c.name + " metadata bytes protected",
        );
      }
      await mode(true);
      assert.equal(await page.evaluate(() => sourceMode), true);
    }
  });

  await test("Literal underscore and formatted heading anchors agree; empty cells retain real column geometry", async () => {
    await fixture("# Body\n\n## API_v2\n\n## **API_v2**\n\n|A|B|C|\n|---|---|---|\n|one||three|\n||two||\n");
    assert.equal(await page.locator("#heading-api_v2").count(), 1);
    assert.equal(await page.locator("#heading-api_v2-1").count(), 1);
    assert.equal(await page.evaluate(() => bodySurface.model.jump("api_v2-1")), true);
    const rows = page.locator(".md-table-row");
    for (let i = 0; i < 3; i++)
      assert.equal(await rows.nth(i).locator(".md-table-cell").count(), 3, "three cells in row " + i);
    const geometry = await rows.evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll(".md-table-cell")].map((c) => ({
          x: c.getBoundingClientRect().x,
          width: c.getBoundingClientRect().width,
        })),
      ),
    );
    for (const row of geometry.slice(1))
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(row[i].x - geometry[0][i].x) < 1);
        assert.ok(Math.abs(row[i].width - geometry[0][i].width) < 1);
      }
    await rows.nth(1).locator(".md-table-cell").nth(1).click();
    await page.keyboard.insertText("middle");
    assert.match(await source(), /\|one\|middle\|three\|/);
    await leave();
    await saved();
    assert.match(await readFile(join(info.root, A), "utf8"), /\|one\|middle\|three\|/);
  });

  await test("Real editor links and dependency removal have keyboard equivalents", async () => {
    await fixture("# Body\n\n[validation](b.md)\n");
    const link = page.locator('#reading [role="link"]').first();
    await link.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((p) => current === p, B);
    await fixture("# Body\n\n[validation](b.md)\n");
    await selectText("validation");
    await page.keyboard.insertText("checks");
    assert.equal(await source(), "# Body\n\n[checks](b.md)\n");
    assert.equal(await page.evaluate(() => current), A, "Editing link text is not navigation");
    await leave();
    await discard();
    await board();
    const edge = page.locator(".edge-hit").first();
    assert.equal(await edge.getAttribute("role"), "button");
    await edge.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.hasAttribute("data-remove-after"));
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.matches(".edge-hit")), true);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.activeElement?.hasAttribute("data-remove-after"));
    const path = await page.locator("[data-remove-after]").getAttribute("data-path");
    await page.keyboard.press("Enter");
    await settled();
    await page.waitForFunction((p) => store.drafts.has(p), path);
    assert.equal(await page.locator("#edge-detail").isVisible(), false);
    await discard(path);
  });

  await test("Source and live views use the same paper width and preserve the visible content anchor", async () => {
    const long =
      rich +
      Array.from(
        { length: 35 },
        (_, i) => `\r\n## Section ${i}\r\n\r\nLong paragraph ${i} with readable content.\r\n`,
      ).join("");
    await fixture(long);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => {
        $("workspace").scrollTop = 650;
      });
      await page.waitForTimeout(100);
      const paper = await page.locator("#reading").boundingBox();
      const mark = await page.evaluate(() => bodySurface.model.bookmark());
      await mode(true);
      await page.waitForTimeout(100);
      const after = await page.locator("#reading").boundingBox();
      assert.equal(after.x, paper.x);
      assert.equal(after.width, paper.width);
      const y = await page.evaluate((pos) => bodySurface.model.view.coordsAtPos(pos)?.top, mark.pos);
      assert.ok(Math.abs(y - mark.top) < 5, `Anchor at ${width}: ${y} vs ${mark.top}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot("source-" + width);
      await mode(false);
      await shot("live-" + width);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => bodySurface.model.jump("Section 34")), true);
    await page.waitForTimeout(150);
    const heading = await page.locator("#heading-section-34").boundingBox(),
      bar = await page.locator(".source-bar").boundingBox();
    assert.ok(
      heading.y >= bar.y + bar.height - 1 && heading.y < 1000,
      "Offscreen anchors scroll into the reading viewport",
    );
  });

  await test("Document endings stay compact and related navigation is visibly outside the editor", async () => {
    const short = "# End boundary\n\nFinal sentence.\n",
      before = await readFile(join(info.root, B), "utf8");
    try {
      await writeFile(join(info.root, B), short);
      await fixture();
      await open(B);
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const isSource of [false, true]) {
          await mode(isSource);
          const metrics = await page.evaluate(() => {
            const reading = $("reading").getBoundingClientRect(),
              related = $("related").getBoundingClientRect();
            return {
              height: reading.height,
              gap: related.top - reading.bottom,
              outside:
                !$("reading").contains($("related")) && !$("related").querySelector("[contenteditable]"),
              tag: $("related").tagName,
              background: getComputedStyle($("related")).backgroundColor,
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          assert.ok(metrics.height < 200, "Short documents do not get artificial blank pages");
          assert.ok(metrics.gap >= 12 && metrics.gap <= 20, "Compact, explicit document/navigation boundary");
          assert.equal(metrics.outside, true);
          assert.equal(metrics.tag, "ASIDE");
          assert.equal(metrics.background, "rgb(241, 241, 236)");
          assert.equal(metrics.overflow, false);
          await page.locator("#related summary").click();
          assert.equal(await page.locator("#related details").getAttribute("open"), "");
          await page.locator("#related summary").click();
          assert.equal(await source(), short);
        }
      }
      await page.locator("#related summary").click();
      await page.locator(`#related [data-doc="${A}"]`).click();
      await page.waitForFunction((p) => current === p, A);
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
    } finally {
      await writeFile(join(info.root, B), before);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  });

  await test("IME boundaries and localization never replace the focused editor or save composition", async () => {
    await fixture();
    await selectText("A plain paragraph.");
    await page.evaluate(() => {
      window.inputIdentity = $("source");
    });
    await page.locator("#source").dispatchEvent("compositionstart");
    await page.locator("#source").dispatchEvent("keydown", { key: "Enter", isComposing: true });
    await page.evaluate(() => save());
    assert.equal(await page.evaluate(() => store.busy), false);
    await page.locator("#source").dispatchEvent("compositionend");
    await page.keyboard.insertText("输入法边界");
    await language("zh");
    assert.equal(await page.evaluate(() => $("source") === window.inputIdentity), true);
    await language("en");
    await leave();
    assert.match(await source(), /输入法边界/);
  });

  await test("One-click document links and repeated/Unicode anchors survive editing; HTML and images stay inert", async () => {
    await fixture(
      rich +
        '\r\n## 目标\r\n\r\n[Jump](#%E7%9B%AE%E6%A0%87)\r\n\r\n[Second](#repeated-1)\r\n\r\n<img src="https://example.org/no">\r\n\r\n![remote](https://example.org/no.png)\r\n',
    );
    await page.locator('#reading [role="link"]').filter({ hasText: "Jump" }).click();
    await page.waitForTimeout(100);
    assert.ok(await page.locator("#heading-目标").isVisible());
    await page.locator('#reading [role="link"]').filter({ hasText: "Second" }).click();
    assert.ok(await page.locator("#heading-repeated-1").isVisible());
    assert.equal(await page.locator("#reading img:not(.cm-widgetBuffer), #reading script").count(), 0);
    assert.equal(network.length, 0);
    await page.locator('#reading [role="link"]').filter({ hasText: "validation" }).click();
    await page.waitForFunction((p) => current === p, B);
    await open();
    await page.locator('#reading [role="link"]').filter({ hasText: "reference" }).click();
    await page.waitForFunction((p) => current === p, B);
  });
}
