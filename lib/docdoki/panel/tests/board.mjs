import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export default async function boardChecks({
  here,
  page,
  info,
  A,
  B,
  originals,
  rich,
  fixture,
  test,
  settled,
  closeChanges,
  changes,
  sidebar,
  board,
  saved,
  discard,
  undo,
  field,
  input,
  fieldDone,
  shot,
  language,
  hold,
}) {
  await test("Offline first use: ordered navigation, pixel-heart and minimal board controls", async () => {
    assert.deepEqual(
      await page.locator("[data-nav]").evaluateAll((nodes) => nodes.map((n) => n.dataset.nav)),
      ["dashboard", "work", "northstar", "overview"],
    );
    assert.equal(await page.locator("#changes").isVisible(), false);
    assert.equal(await page.locator("#count").isVisible(), false);
    const href = await page.locator('link[rel="icon"]').getAttribute("href");
    assert.equal(decodeURIComponent(href.split(",")[1]), await readFile(join(here, "favicon.svg"), "utf8"));
    assert.deepEqual(await page.locator(".graph-tools button:not(#zoom-label)").allTextContents(), [
      "−",
      "+",
      "▣",
      "⟲",
      "⇄",
    ]);
    await shot("board");
  });

  await test("Initial fit contains cards; resizing and round trips preserve the camera", async () => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload();
      await page.waitForFunction(() => graphReady);
      assert.equal(
        await page.evaluate(() => {
          const b = $("graph").getBoundingClientRect();
          return [...$("graph-cards").children].every((el) => {
            const c = el.getBoundingClientRect();
            return c.x >= b.x && c.right <= b.right && c.y >= b.y && c.bottom <= b.bottom;
          });
        }),
        true,
      );
      await page.evaluate(() => {
        pan = { x: 17, y: 29 };
        scale = 0.7;
        transform();
      });
      await sidebar("overview");
      assert.equal(await page.evaluate(() => current), "docdoki/spec_abstract.md");
      await board();
      assert.deepEqual(await page.evaluate(() => [pan.x, pan.y, scale]), [17, 29, 0.7]);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
  });

  await test("Card frames select, field text edits and Open alone navigates", async () => {
    const card = page.locator(`[data-node="${A}"]`);
    await card.dblclick({ position: { x: 4, y: 4 } });
    assert.equal(await page.evaluate(() => view), "graph");
    assert.equal(await page.evaluate(() => selectedNode), A);
    assert.equal(await page.locator("#edge-detail").isVisible(), false);
    await card.focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => selectedNode), A);
    await card.locator("[data-doc]").click();
    assert.equal(await page.evaluate(() => view), "doc");
    assert.match(await page.locator("#reading").innerText(), /An introduction[\s\S]*Second section/);
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
    assert.equal(
      await page.getByRole("heading", { level: 1 }).evaluate((el) => el === document.activeElement),
      true,
    );
    await board();
  });

  await test("Native field editing has matching typography, no blue box or confirmation footer", async () => {
    await page.locator("#workspace").focus();
    await page.keyboard.press("Escape");
    const title = page.locator(`[data-node="${A}"] .card-title`),
      box = await title.boundingBox();
    const font = await title.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.fontFamily, s.fontSize, s.fontWeight, parseFloat(s.lineHeight)];
    });
    await field("title");
    assert.equal(await page.locator("[data-apply-field],[data-cancel-field]").count(), 0);
    const editingFont = await input().evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.fontFamily, s.fontSize, s.fontWeight, parseFloat(s.lineHeight)];
    });
    assert.deepEqual(editingFont.slice(0, 3), font.slice(0, 3));
    assert.ok(
      Math.abs(editingFont[3] - font[3]) < 1,
      "Native input line-height rounding stays below one pixel",
    );
    assert.equal(await input().evaluate((el) => getComputedStyle(el).outlineStyle), "none");
    assert.ok(Math.abs((await input().boundingBox()).x - box.x) < 1);
    await input().fill("Cancelled");
    await input().press("Escape");
    assert.equal(await page.evaluate(() => store.drafts.size), 0);
    await field("title");
    await input().fill("A better title");
    await input().press("Enter");
    await page.waitForFunction(() => !fieldEditor);
    await field("purpose");
    await input().fill("Keep this condition.\nAnd this one.");
    await page.evaluate(() => {
      window.nativeInput = fieldEditor.input;
    });
    await language("zh");
    assert.equal(await page.evaluate(() => window.nativeInput === fieldEditor.input), true);
    assert.equal(await input().getAttribute("aria-label"), "摘要");
    await input().dispatchEvent("compositionstart");
    await input().dispatchEvent("keydown", { key: "Enter", isComposing: true });
    assert.equal(await input().isVisible(), true);
    await input().dispatchEvent("compositionend");
    await shot("field");
    await changes();
    await page.waitForFunction(() => !fieldEditor);
    assert.equal(await page.evaluate(() => store.drafts.size), 1);
    assert.equal(await readFile(join(info.root, A), "utf8"), originals.get(A));
    await closeChanges();
    await language("en");
    await field("progress");
    await input().selectOption("done");
    await page.waitForFunction(() => !fieldEditor);
    assert.match(await page.locator(`[data-node="${A}"]`).innerText(), /Done/);
    await saved();
    assert.match(await readFile(join(info.root, A), "utf8"), /# A better title/);
    await writeFile(join(info.root, A), originals.get(A));
    await page.reload();
  });

  await test("Blur stages a card edit without stealing focus; selecting a second field needs one click", async () => {
    await field("purpose");
    await input().fill("A directly edited summary");
    await page.locator("#search").click();
    await page.waitForFunction(() => !fieldEditor);
    assert.equal(await page.locator("#search").evaluate((el) => el === document.activeElement), true);
    await field("title");
    await input().fill("One click");
    await field("purpose");
    assert.equal(await input().inputValue(), "A directly edited summary");
    await input().press("Escape");
    await discard();
    await closeChanges();
  });

  await test("Cancelled and refocused field responses cannot overwrite later input", async () => {
    await board();
    const held = await hold("**/preview", (r) => !!r.postDataJSON().card);
    try {
      await field("title");
      await input().fill("Late title");
      await input().press("Enter");
      await held.wait();
      await input().press("Escape");
      held.release();
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
    } finally {
      await held.close();
    }
    const delayed = await hold("**/preview", (r) => !!r.postDataJSON().card);
    try {
      await field("title");
      await input().fill("First input");
      await input().press("Enter");
      await delayed.wait();
      await input().fill("Second input");
      delayed.release();
      await page.waitForFunction(() => fieldEditor && !fieldEditor.pending);
      assert.equal(await input().inputValue(), "Second input");
      assert.equal(await page.evaluate(() => store.drafts.size), 0);
    } finally {
      await delayed.close();
    }
    await fieldDone();
    await discard();
    await closeChanges();
  });

  await test("Failed field validation retains input and blocks navigation, Save and Copy", async () => {
    await board();
    await field("purpose");
    await input().fill("Keep this field");
    const fail = (route) => route.abort();
    await page.route("**/preview", fail);
    try {
      await page.locator(`[data-node="${A}"] [data-doc]`).click();
      await page.waitForFunction(() => fieldEditor?.input.hasAttribute("aria-invalid"));
      assert.equal(await page.evaluate(() => view), "graph");
      assert.equal(await input().inputValue(), "Keep this field");
      await page.evaluate(() => save());
      assert.equal(await page.evaluate(() => store.busy), false);
      await page.evaluate(() => copyPrompt());
      assert.equal(await page.locator("#prompt").inputValue(), "");
    } finally {
      await page.unroute("**/preview", fail);
    }
    await fieldDone();
    await discard();
    await closeChanges();
  });

  await test("A validated field edit updates diagnostics without requesting an identical preview", async () => {
    await fixture(rich.replace("after: []", "after: []\r\nprogress: unknown"));
    await board();
    assert.equal(await page.locator("#diagnostics").isVisible(), true);
    const requests = [],
      capture = (r) => {
        if (r.url().endsWith("/preview")) requests.push(r.postDataJSON());
      };
    page.on("request", capture);
    try {
      await field("progress");
      await input().selectOption("done");
      await settled();
      assert.equal(await page.locator("#diagnostics").isVisible(), false);
      await page.waitForTimeout(300);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].card.field, "progress");
    } finally {
      page.off("request", capture);
    }
    await discard();
    await writeFile(join(info.root, A), originals.get(A));
    await page.reload();
  });

  await test("Real graph geometry, drag identity, direction, Connect cycles and explicit removal remain intact", async () => {
    await board();
    const card = page.locator(`[data-node="${B}"]`),
      box = await card.boundingBox();
    await page.mouse.move(box.x + 3, box.y + 3);
    await page.mouse.down();
    await page.mouse.move(box.x + 43, box.y + 43, { steps: 4 });
    await page.evaluate(() => {
      window.dragNode = drag.element;
    });
    await page.evaluate(() => updatePreview());
    assert.equal(
      await page.evaluate(() => drag.element === window.dragNode && drag.element.isConnected),
      true,
    );
    await page.mouse.up();
    assert.equal(await page.evaluate(() => store.drafts.size), 0);
    await page.locator("#connect").click();
    await page.locator(`[data-node="${B}"]`).click({ position: { x: 4, y: 4 } });
    await page.locator(`[data-node="${A}"]`).click({ position: { x: 4, y: 4 } });
    await page.waitForFunction(() => $("status").textContent.includes("cyc"));
    assert.equal(await page.evaluate(() => store.drafts.size), 0);
    await page.keyboard.press("Escape");
    await page.locator("#edge-lines .edge").first().dispatchEvent("click");
    assert.equal(await page.evaluate(() => store.drafts.size), 0);
    await page.locator("[data-remove-after]").click();
    await page.waitForFunction(() => store.drafts.size === 1);
    await settled();
    assert.equal(await page.evaluate(() => store.drafts.size), 1);
    await undo();
    const routes = await page.evaluate(() => {
      const boxes = new Map([
        ["a", { x: 0, y: 0, w: 300, h: 180 }],
        ["b", { x: 500, y: -120, w: 300, h: 180 }],
        ["c", { x: 500, y: 140, w: 300, h: 180 }],
      ]);
      const fan = routeEdges(
        [
          { from: "a", to: "b" },
          { from: "a", to: "c" },
        ],
        boxes,
      );
      boxes.set("c", { x: 0, y: 400, w: 300, h: 180 });
      const down = routeEdges([{ from: "a", to: "c" }], boxes)[0];
      return [fan[0].fromOffset !== fan[1].fromOffset, down.fromSide, down.toSide];
    });
    assert.deepEqual(routes, [true, "bottom", "top"]);
  });
}
