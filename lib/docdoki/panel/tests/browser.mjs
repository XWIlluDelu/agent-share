/* Real-browser end-to-end checks for the redesigned DocDoki steering board. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const here = fileURLToPath(new URL("..", import.meta.url));

export async function runBrowserChecks() {
  let checks = 0;
  const engines = await import(
    process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright"
  );
  const engine = process.env.PANEL_BROWSER || "chromium";
  const browser = await engines[engine].launch({ headless: true });

  let helper, stopped;
  try {
    helper = spawn(process.env.PYTHON || "python3", ["-B", join(here, "selftest.py"), "--serve"], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    stopped = new Promise((resolve) => helper.once("close", resolve));
    const lines = createInterface({ input: helper.stdout });
    const info = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Fixture did not start within 10s")), 10000);
      lines.once("line", (line) => {
        clearTimeout(timer);
        resolve(JSON.parse(line));
      });
      helper.once("error", reject);
      helper.once("exit", (code) => reject(new Error("Fixture exited: " + code)));
    }).finally(() => lines.close());

    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    const errors = [],
      externalRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (!r.url().startsWith(info.url) && !r.url().startsWith("data:")) externalRequests.push(r.url());
    });

    async function test(name, fn) {
      await fn();
      assert.deepEqual(errors, [], "No browser page errors");
      checks++;
      console.log(`PASS ${engine}:`, name);
    }

    await page.goto(info.url);

    await test("Dashboard shows Project Pulse, Open Decisions, and Area groups", async () => {
      await page.waitForSelector(".decisions-box");
      const decisionsText = await page.locator(".decisions-box").textContent();
      assert.ok(decisionsText.includes("network filesystems"), "Overview open decision surfaced");
      assert.ok(decisionsText.includes("Row cache"), "Proposed spec surfaced");
      assert.ok(decisionsText.includes("Atomic export"), "Blocked work surfaced");
      const areas = await page.locator(".area-header h3").allTextContents();
      assert.deepEqual(areas, ["Child units", "IO", "Performance", "General"]);
    });

    await test("Inline card status and progress edit + DAG toggle", async () => {
      // Open inline title edit and cancel with Escape; editor must restore resting card
      await page.locator('[data-node="docdoki/specs/a.md"] .card-title').click();
      await page.waitForSelector('[data-node="docdoki/specs/a.md"] .field-title input');
      await page.keyboard.press("Escape");
      assert.equal(await page.locator('[data-node="docdoki/specs/a.md"] .field-editor').count(), 0);

      // Flip proposed spec to decided
      await page.locator('[data-node="docdoki/specs/proposed-cache.md"] [data-field="status"]').click();
      await page.waitForFunction(() => store.drafts.has("docdoki/specs/proposed-cache.md"));

      // Switch to DAG mode and verify edge renders
      await page.locator('[data-board-mode="dag"]').click();
      await page.waitForSelector("#graph:not([hidden])");
      assert.ok((await page.locator("#edge-lines .edge").count()) >= 1);

      // Switch back to Areas
      await page.locator('[data-board-mode="areas"]').click();
      await page.waitForSelector("#area-board:not([hidden])");
    });

    await test("Active Work view renders rich work cards with task progress", async () => {
      await page.locator('.primary-nav [data-nav="work"]').click();
      await page.waitForSelector(".work-card");
      const text = await page.locator(".work-card").first().textContent();
      assert.ok(text.includes("Atomic export"));
      assert.ok(text.includes("1/2"));
      assert.ok(text.includes("blocked"));
    });

    await test("Document view renders Markdown safely, shows unopened note backlinks, and saves source edits", async () => {
      await page.locator('#catalog [data-doc="docdoki/specs/a.md"]').click();
      await page.waitForSelector("#reading h1");
      const relatedText = await page.locator("#related").textContent();
      assert.ok(relatedText.includes("Evidence"), "Backlinks include unopened notes/evidence.md");

      // Edit source via </> toggle
      await page.locator("#source-view").click();
      await page.waitForSelector("#source");
      const original = await page.locator("#source").inputValue();
      await page.locator("#source").fill(original + "\n- Added via plain Markdown editor.\n");
      await page.locator("#source-view").click(); // back to preview
      await page.waitForSelector("#reading:not([hidden])");
      assert.ok((await page.locator("#reading").textContent()).includes("Added via plain Markdown editor."));

      // Save via Changes drawer
      await page.locator("#changes-toggle").click();
      await page.locator("#save").click();
      await page.waitForFunction(() => !store.busy && !store.drafts.size);
      const disk = await readFile(join(info.root, "docdoki/specs/a.md"), "utf8");
      assert.ok(disk.includes("Added via plain Markdown editor."));
    });

    await test("Repeated saves + steering note build compact deduplicated unified diff prompt", async () => {
      // Edit a.md a second time and save
      await page.locator("#changes-close").click();
      await page.locator("#source-view").click();
      const v2 = (await page.locator("#source").inputValue()).replace("Added via plain Markdown editor.", "Refined requirement v2.");
      await page.locator("#source").fill(v2);
      await page.locator("#changes-toggle").click();
      await page.locator("#save").click();
      await page.waitForFunction(() => !store.busy && !store.drafts.size);

      await page.locator("#steering-note").fill("Please propagate to export.py and tests.");
      const prompt = await page.evaluate(() => buildPrompt());
      assert.ok(prompt.includes("Please propagate to export.py and tests."));
      assert.ok(prompt.includes("+\\- Refined requirement v2.") || prompt.includes("+- Refined requirement v2."));
      assert.ok(!prompt.includes("Added via plain Markdown editor."), "Intermediate save collapsed out");
      assert.ok(prompt.includes("```diff"), "Uses compact unified diff");
      await page.locator("#changes-close").click();
    });

    await test("Full-library search finds unopened note content", async () => {
      await page.locator("#search").fill("UniqueSearchTokenEXDEV");
      await page.waitForSelector("#search-panel:not([hidden]) li");
      const resText = await page.locator("#search-panel").textContent();
      assert.ok(resText.includes("Evidence"));
      await page.locator("#search-panel li button").first().click();
      await page.waitForFunction(() => current === "docdoki/notes/evidence.md");
    });

    await test("New document modal creates file on disk and opens editor", async () => {
      await page.locator("#new-doc").click();
      await page.waitForSelector("#create-modal:not([hidden])");
      await page.locator("#create-kind").selectOption("note");
      await page.locator("#create-title").fill("CLI Decisions");
      await page.locator('#create-form button[type="submit"]').click();
      await page.waitForFunction(() => current === "docdoki/notes/cli-decisions.md");
      const disk = await readFile(join(info.root, "docdoki/notes/cli-decisions.md"), "utf8");
      assert.ok(disk.includes("# CLI Decisions"));
    });

    await test("Dashboard status filter pills filter cards cleanly", async () => {
      await page.locator('.primary-nav [data-nav="dashboard"]').click();
      await page.waitForSelector("#board-filters:not([hidden])");
      await page.locator('[data-filter="done"]').click();
      assert.equal(await page.locator("#area-board .spec-card").count(), 1);
      await page.locator('[data-filter="all"]').click();
      assert.equal(await page.locator("#area-board .spec-card").count(), 4);
    });

    await test("Floating preferences orb toggles Light/Dark and English/Chinese cleanly", async () => {
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
      await page.locator("#settings-fab").click();
      await page.waitForSelector("#settings-popover:not([hidden])");
      await page.locator('[data-theme-choice="dark"]').click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
      await page.locator('[data-lang-choice="zh"]').click();
      assert.equal((await page.locator("#settings-heading").textContent()).trim(), "偏好设置");
      await page.locator('[data-lang-choice="en"]').click();
      await page.locator('[data-theme-choice="light"]').click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
      await page.locator("#settings-close").click();
      await page.waitForSelector("#settings-popover", { state: "hidden" });
    });

    await test("Header unit switcher opens full unit tree and navigates to child unit", async () => {
      await page.locator("#unit-toggle").click();
      await page.waitForSelector("#unit-menu:not([hidden])");
      await page.locator('#unit-menu a[data-unit="child"]').click();
      await page.waitForLoadState("networkidle");
      assert.ok((await page.locator("#project-name").textContent()).includes("child"));
      assert.ok((await page.locator("#pulse").textContent()).includes("Run statistical checks"));
    });

    assert.deepEqual(externalRequests, [], "Zero external network requests");
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
