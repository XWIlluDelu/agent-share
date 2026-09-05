import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

export default async function layoutChecks({
  engine,
  page,
  info,
  A,
  B,
  originals,
  test,
  settled,
  changes,
  board,
  open,
  mode,
  fixture,
  source,
  leave,
  replaceText,
  saved,
  field,
  input,
  fieldDone,
  shot,
  language,
  equalWidths,
}) {
  await test("An empty board drops obsolete minimap bounds and node references", async () => {
    await board();
    const empty = await page.evaluate(() => {
      graph = { ...graph, nodes: [] };
      renderGraph();
      return { bounds: layoutBounds(), rects: miniRects.size, nodes: $("mini-nodes").childElementCount };
    });
    assert.deepEqual(empty, { bounds: { left: 0, top: 0, right: 0, bottom: 0 }, rects: 0, nodes: 0 });
    await page.reload();
  });

  await test("Phone/landscape layouts, equal-width peer controls, keyboard focus and touch remain usable", async () => {
    for (const [width, height] of [
      [1440, 1000],
      [844, 390],
      [390, 900],
      [320, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await board();
      for (const locale of ["zh", "en"]) {
        await language(locale);
        const w = await equalWidths("#zoom-out,#zoom-in,#fit,#reset-layout,#connect");
        await equalWidths(".card-foot>[data-doc]");
        await equalWidths(".card-foot>.progress-label");
        if (width <= 760) {
          assert.equal(
            await page
              .locator(".spec-card header")
              .first()
              .evaluate((el) => getComputedStyle(el).fontSize),
            "16px",
          );
        }
        await page.locator("#zoom-label").click();
        assert.equal(await page.locator("#fit").isDisabled(), true);
        assert.equal(
          await page.locator("#zoom-label").evaluate((el) => getComputedStyle(el).backgroundColor),
          "rgb(0, 0, 0)",
        );
        await page.locator("#zoom-label").click();
        assert.equal(await equalWidths("#zoom-out,#zoom-in,#fit,#reset-layout,#connect"), w);
        assert.equal(
          await page.locator(".graph-tools").evaluate((el) => {
            const b = el.getBoundingClientRect();
            return b.x >= 0 && b.right <= innerWidth && b.bottom <= innerHeight;
          }),
          true,
        );
        await open();
        await mode(true);
        const path = await page.locator("#document-path").boundingBox(),
          icon = await page.locator("#source-view").boundingBox();
        assert.ok(Math.abs(icon.x - path.x - path.width - 8) < 1);
        assert.ok(icon.x + icon.width <= width);
        await mode(false);
        assert.equal(
          await page.locator("#source").evaluate((el) => getComputedStyle(el).outlineStyle),
          "none",
        );
        await changes();
        assert.equal(await page.locator("#workspace").evaluate((el) => el.inert), true);
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator("#changes-toggle").evaluate((el) => el === document.activeElement),
          true,
        );
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await board();
      }
    }
    if (engine !== "firefox") {
      await open();
      const before = await source();
      await page
        .locator("#source")
        .dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 17, clientX: 100, clientY: 300 });
      await page.locator("#source").dispatchEvent("pointercancel", { pointerType: "touch", pointerId: 17 });
      assert.equal(await source(), before);
    }
    await shot("phone");
  });

  await test("A library above 1 MiB can stage and save fields, body and dependencies with bounded requests", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const large = Array.from({ length: 65 }, (_, i) => `docdoki/stages/large-${i}.md`);
    try {
      await Promise.all(
        large.map((p, i) =>
          writeFile(join(info.root, p), `# Stage ${i}\n\n` + "ordinary content ".repeat(1024)),
        ),
      );
      await writeFile(join(info.root, B), originals.get(B));
      await fixture();
      await board();
      assert.ok(
        await page.evaluate(
          () => [...store.base.values()].reduce((n, d) => n + d.source.length, 0) > 1048576,
        ),
      );
      const sizes = [],
        capture = (r) => {
          if (r.url().endsWith("/preview")) sizes.push(r.postDataBuffer().length);
        };
      page.on("request", capture);
      try {
        await field("title");
        await input().fill("Large-library field");
        await fieldDone();
        await open();
        await replaceText("A plain paragraph.", "Large-library body.");
        await leave();
        await board();
        const edgeIndex = await page.evaluate((p) => edgeViews.findIndex((e) => e.to === p), B);
        await page.locator(`.edge-hit[data-edge="${edgeIndex}"]`).focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.activeElement?.hasAttribute("data-remove-after"));
        await page.keyboard.press("Enter");
        await page.waitForFunction((p) => store.drafts.has(p), B);
        await settled();
        await saved();
        assert.match(await readFile(join(info.root, A), "utf8"), /Large-library field/);
        assert.match(await readFile(join(info.root, A), "utf8"), /Large-library body/);
        assert.ok(!(await readFile(join(info.root, B), "utf8")).includes("after: ['a']"));
        assert.ok(
          sizes.length >= 3 && Math.max(...sizes) < 30000,
          "preview bytes depend on refs and edits, not repeated library text",
        );
      } finally {
        page.off("request", capture);
      }
    } finally {
      await Promise.all(large.map((p) => rm(join(info.root, p))));
    }
  });

  await test("Cursor moves reuse reference definitions; unchanged UI does not reconfigure the editor", async () => {
    await fixture();
    assert.equal(
      await page.evaluate(() => {
        const v = bodySurface.model.view,
          before = v.state;
        renderChanges(false);
        localize();
        bodySurface.model.setMode(sourceMode);
        return v.state === before;
      }),
      true,
    );
    const calls = await page.evaluate(async () => {
      const v = bodySurface.model.view,
        lexer = markdown.lexer;
      let calls = 0;
      markdown.lexer = (...args) => {
        calls++;
        return lexer.apply(markdown, args);
      };
      try {
        v.focus();
        for (let i = 0; i < 5; i++) {
          v.dispatch({ selection: { anchor: 100 + i } });
          await new Promise(requestAnimationFrame);
        }
        const cursor = calls;
        v.dispatch({ changes: { from: 100, insert: "x" } });
        return { cursor, input: calls };
      } finally {
        markdown.lexer = lexer;
      }
    });
    assert.equal(calls.cursor, 0);
    assert.ok(calls.input > 0, "Text edits invalidate cached definitions");
  });
}
