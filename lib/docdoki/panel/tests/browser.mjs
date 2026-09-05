/* Real-browser checks share a temporary local service, not persisted fixtures or traces. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import boardChecks from "./board.mjs";
import editorChecks from "./editor.mjs";
import changesChecks from "./changes.mjs";
import layoutChecks from "./layout.mjs";
const here = fileURLToPath(new URL("..", import.meta.url));
export async function runBrowserChecks() {
  let checks = 0;

  const engines = await import(
    process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright"
  );
  const engine = process.env.PANEL_BROWSER || "chromium";
  assert.ok(["chromium", "firefox", "webkit"].includes(engine));
  const browser = await engines[engine].launch({ headless: true });
  let helper, stopped;
  try {
    helper = spawn(process.env.PYTHON || "python3", ["-B", join(here, "selftest.py"), "--serve"], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    stopped = new Promise((resolve) => helper.once("close", resolve));
    const lines = createInterface({ input: helper.stdout });
    let timer;
    const info = await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Fixture did not start within 10 seconds")), 10000);
      lines.once("line", (line) => {
        try {
          resolve(JSON.parse(line));
        } catch (e) {
          reject(e);
        }
      });
      helper.once("error", reject);
      helper.once("exit", (code) => reject(new Error("Fixture exited: " + code)));
    }).finally(() => {
      clearTimeout(timer);
      lines.close();
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      hasTouch: engine !== "firefox",
    });
    const page = await context.newPage(),
      errors = [],
      network = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    page.on("request", (r) => {
      if (!r.url().startsWith(info.url)) network.push(r.url());
    });
    const A = "docdoki/specs/a.md",
      B = "docdoki/specs/b.md",
      C = "docdoki/specs/c.md";
    const originals = new Map(
      await Promise.all([A, B].map(async (p) => [p, await readFile(join(info.root, p), "utf8")])),
    );
    const rich = [
      "---",
      'purpose: "Body editing" # keep this comment',
      "after: []",
      "---",
      "# Body",
      "",
      "A plain paragraph.",
      "",
      "## Repeated",
      "",
      "Keep *this* spelling &amp; entity.",
      "",
      "## Repeated",
      "",
      "- First item",
      "- Second item",
      "",
      "```js",
      "const value = 1;",
      "```",
      "",
      "<!-- preserve this comment -->",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| x | 1 |",
      "",
      "A [[b|validation]] and [reference][ref].",
      "",
      '[ref]: b.md "Reference title"',
      "",
    ].join("\r\n");
    async function test(name, fn) {
      await fn();
      assert.deepEqual(errors, [], "No browser exceptions");
      checks++;
      console.log(`PASS ${engine}:`, name);
    }
    async function settled() {
      await page.waitForFunction(
        () => !store.busy && !previewPending && !bodyEditor?.pending && !fieldEditor?.pending,
      );
    }
    async function closeChanges() {
      if (await page.locator("#changes").isVisible()) await page.locator("#changes-close").click();
    }
    async function changes() {
      if (!(await page.locator("#changes").isVisible())) await page.locator("#changes-toggle").click();
    }
    async function showLibrary() {
      await page.waitForFunction(
        () =>
          $("library-toggle").getAttribute("aria-expanded") ===
          String(
            innerWidth <= 760
              ? $("app").classList.contains("library-open")
              : !$("app").classList.contains("library-closed"),
          ),
      );
      if ((await page.locator("#library-toggle").getAttribute("aria-expanded")) !== "true")
        await page.locator("#library-toggle").click();
    }
    async function sidebar(name) {
      await closeChanges();
      await showLibrary();
      await page.locator(`[data-nav="${name}"]`).click();
      await settled();
    }
    async function board() {
      await sidebar("dashboard");
      await page.waitForFunction(() => view === "graph");
    }
    async function open(path = A) {
      await closeChanges();
      await showLibrary();
      await page.locator(`#catalog [data-doc="${path}"]`).first().click();
      await page.waitForFunction((p) => current === p && view === "doc", path);
    }
    async function mode(value) {
      await closeChanges();
      if ((await page.evaluate(() => sourceMode)) !== value) {
        // Use the visible sticky control, without Playwright's scrollIntoView
        // prelude (which moves sticky descendants in mobile Chromium).
        const box = await page.locator("#source-view").boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      await page.waitForFunction((v) => sourceMode === v, value);
      await settled();
    }
    async function fixture(source = rich) {
      await writeFile(join(info.root, A), source);
      await page.reload();
      await open();
    }
    const source = () => page.evaluate(() => bodySurface.model.source);
    async function leave() {
      await page.locator("#document-path").click();
      await page.waitForFunction(() => !bodyEditor && !fieldEditor);
      await settled();
    }
    async function fillSource(text) {
      await mode(true);
      await page.locator("#source").focus();
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.insertText(text.replace(/\r\n?/g, "\n"));
      assert.equal(
        (await source()).replace(/\r\n?/g, "\n"),
        text.replace(/\r\n?/g, "\n"),
        "Full-source replacement is exact, not a duplicate body insertion",
      );
    }
    async function edit(path, transform) {
      await open(path);
      await fillSource(transform(await source()));
      await leave();
    }
    async function selectText(text) {
      await page.evaluate((text) => {
        const v = bodySurface.model.view,
          at = v.state.doc.toString().indexOf(text);
        if (at < 0) throw new Error("Missing text: " + text);
        v.dispatch({ selection: { anchor: at, head: at + text.length }, scrollIntoView: true });
        v.focus();
      }, text);
    }
    async function replaceText(text, replacement) {
      await selectText(text);
      await page.keyboard.insertText(replacement);
    }
    async function saved() {
      await changes();
      await page.locator("#save").click();
      await page.waitForFunction(() => !store.busy && !store.drafts.size);
      await settled();
    }
    async function discard(path = A) {
      await changes();
      await page.locator(`[data-discard="${path}"]`).click();
      await page.waitForFunction((p) => !store.drafts.has(p), path);
      await settled();
    }
    async function undo() {
      await closeChanges();
      await page.locator("#workspace").focus();
      await page.keyboard.press("ControlOrMeta+z");
      await settled();
    }
    async function field(name, path = A) {
      await page.locator(`[data-node="${path}"] [data-field="${name}"]`).click();
      await page.waitForFunction(
        ([name, path]) => fieldEditor?.field === name && fieldEditor.path === path,
        [name, path],
      );
    }
    const input = () => page.locator('#card-field-form [name="value"]');
    async function fieldDone() {
      await input().press("ControlOrMeta+Enter");
      await page.waitForFunction(() => !fieldEditor);
      await settled();
    }
    async function shot(name) {
      if (process.env.PANEL_SCREENSHOT)
        await page.screenshot({
          path: process.env.PANEL_SCREENSHOT.replace(/\.png$/, `-${engine}-${name}.png`),
          fullPage: true,
        });
    }
    async function language(value) {
      if ((await page.evaluate(() => lang)) !== value) await page.locator("#language").click();
    }
    async function hold(pattern, predicate = () => true) {
      let release,
        arrived = false,
        failure;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const handler = async (route) => {
        if (!predicate(route.request())) return route.continue();
        try {
          const response = await route.fetch({ timeout: 10000 });
          arrived = true;
          await gate;
          await route.fulfill({ response });
        } catch (error) {
          failure = error;
        }
      };
      await page.route(pattern, handler);
      return {
        release,
        async wait() {
          const deadline = Date.now() + 10000;
          while (!arrived && !failure && Date.now() < deadline) await page.waitForTimeout(10);
          if (failure) throw failure;
          assert.ok(arrived, "Held an actual backend response");
        },
        async close() {
          release();
          await page.unroute(pattern, handler);
        },
      };
    }
    async function equalWidths(selector) {
      const widths = await page
        .locator(selector)
        .evaluateAll((nodes) => nodes.map((el) => el.getBoundingClientRect().width));
      assert.ok(widths.length > 1 && widths.every((w) => Math.abs(w - widths[0]) < 0.15), selector);
      return widths[0];
    }

    await page.goto(info.url);
    const helpers = {
      here,
      engine,
      page,
      info,
      A,
      B,
      C,
      originals,
      rich,
      test,
      settled,
      closeChanges,
      changes,
      showLibrary,
      sidebar,
      board,
      open,
      mode,
      fixture,
      source,
      leave,
      fillSource,
      edit,
      selectText,
      replaceText,
      saved,
      discard,
      undo,
      field,
      input,
      fieldDone,
      shot,
      language,
      hold,
      equalWidths,
      network,
    };
    await boardChecks(helpers);
    await editorChecks(helpers);
    await changesChecks(helpers);
    await layoutChecks(helpers);
    assert.deepEqual(network, [], "All runtime assets and document rendering stay offline");
    return checks;
  } finally {
    try {
      await browser.close();
    } finally {
      helper?.kill();
      await stopped;
    }
  }
}
