import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

export default async function changesChecks({
  page,
  info,
  A,
  B,
  C,
  rich,
  test,
  settled,
  closeChanges,
  changes,
  sidebar,
  board,
  open,
  fixture,
  source,
  leave,
  edit,
  replaceText,
  saved,
  discard,
  field,
  input,
  fieldDone,
  hold,
}) {
  await test("Diffs are built only on expansion and retain complete sources and open state", async () => {
    await fixture();
    await edit(A, (s) => s + "\nFirst review change\n");
    await changes();
    const details = page.locator(".change-details");
    assert.equal(await page.locator(".change-diff").textContent(), "");
    assert.equal(await page.evaluate(() => diffCache.size), 0);
    await details.locator(":scope > summary").click();
    await page.waitForFunction(() => diffCache.size === 1);
    await page.locator(".full-diff > summary").click();
    await closeChanges();
    await edit(A, (s) => s + "\nSecond review change\n");
    await changes();
    assert.equal(await details.evaluate((el) => el.open), true);
    assert.equal(await page.locator(".full-diff").evaluate((el) => el.open), true);
    const expected = [rich, await source()];
    assert.deepEqual(
      await page.evaluate((p) => {
        const { from, to } = diffCache.get(p);
        return [from, to];
      }, A),
      expected,
    );
    // HTML parsing normalizes newlines; the source cache above must not.
    const full = await page.locator(".full-diff pre").allTextContents();
    assert.deepEqual(
      full,
      expected.map((s) => s.replace(/\r\n/g, "\n")),
    );
    await discard();
    await closeChanges();
  });

  await test("Delayed body application rejects continued input and refocus, including equal text", async () => {
    for (const action of ["type", "refocus"]) {
      await fixture();
      await replaceText("A plain paragraph.", "First body edit");
      const held = await hold("**/preview");
      try {
        await page.locator("#document-path").click();
        await held.wait();
        await page.locator("#source").focus();
        if (action === "type") await page.keyboard.insertText(" newer");
        held.release();
        await page.waitForFunction(() => bodyEditor && !bodyEditor.pending);
        assert.equal(await page.evaluate(() => store.drafts.size), 0);
        assert.equal(await page.locator("#source").evaluate((el) => el === document.activeElement), true);
      } finally {
        await held.close();
      }
      await leave();
      assert.equal(await page.evaluate(() => store.drafts.size), 1);
    }
  });

  await test("Preview failure retains exact text and blocks navigation, presentation changes, Copy and Save", async () => {
    await fixture();
    await replaceText("A plain paragraph.", "Retained on error");
    const fail = (route) => route.abort();
    await page.route("**/preview", fail);
    try {
      await page.locator("#source-view").click();
      await page.waitForFunction(() => $("reading").hasAttribute("aria-invalid"));
      assert.equal(await page.evaluate(() => sourceMode), false);
      assert.match(await source(), /Retained on error/);
      await page.evaluate((p) => openDocument(p), B);
      assert.equal(await page.evaluate(() => current), A);
      await page.evaluate(() => copyPrompt());
      assert.equal(await page.locator("#prompt").inputValue(), "");
      await page.evaluate(() => save());
      assert.equal(await readFile(join(info.root, A), "utf8"), rich);
    } finally {
      await page.unroute("**/preview", fail);
    }
    await leave();
    await saved();
    assert.match(await readFile(join(info.root, A), "utf8"), /Retained on error/);
  });

  await test("Navigation waits for the captured full-source preview and does not steal newer focus", async () => {
    await fixture();
    await replaceText("A plain paragraph.", "Before navigation");
    const held = await hold("**/preview");
    try {
      await page.locator(`#catalog [data-doc="${B}"]`).click();
      await held.wait();
      assert.equal(await page.evaluate(() => current), A);
      held.release();
      await page.waitForFunction((p) => current === p && !bodyEditor, B);
      assert.match(await page.evaluate((p) => store.source(p), A), /Before navigation/);
    } finally {
      await held.close();
    }
  });

  await test("Active buffers block automatic adoption, and conflicts preserve all three full sources", async () => {
    await fixture();
    const held = await hold("**/snapshot");
    try {
      await page.evaluate(() => {
        window.oldStore = store;
        window.sync = syncDocuments();
      });
      await held.wait();
      await replaceText("A plain paragraph.", "Human body");
      held.release();
      await page.evaluate(() => window.sync);
      assert.equal(await page.evaluate(() => store === window.oldStore), true);
      assert.match(await source(), /Human body/);
    } finally {
      await held.close();
    }
    const external = rich + "\r\nExternal requirement.\r\n";
    await writeFile(join(info.root, A), external);
    await page.evaluate(() => syncDocuments());
    assert.match(await source(), /Human body/);
    await leave();
    await page.evaluate(() => syncDocuments());
    await changes();
    assert.equal(await page.locator(".conflict").isVisible(), true);
    assert.equal(await page.locator("#save").isDisabled(), true);
    const prompt = await page.evaluate(() => buildPrompt());
    assert.match(prompt, /Human body/);
    assert.match(prompt, /EXTERNAL VERSION[\s\S]*External requirement/);
    assert.equal(await readFile(join(info.root, A), "utf8"), external);
    await discard();
    assert.equal(await source(), external);
    assert.equal(await page.evaluate(() => store.undo()), null);
  });

  await test("A pending document response cannot cross a DraftStore or equal-text adoption", async () => {
    for (const swap of [true, false]) {
      await fixture();
      await replaceText("A plain paragraph.", "Pending source");
      const held = await hold("**/preview");
      try {
        await page.locator("#document-path").click();
        await held.wait();
        await page.evaluate((swap) => {
          if (swap) store = new DraftStore(graph.documents);
          else store.discard(current, store.base.get(current));
        }, swap);
        held.release();
        await page.waitForFunction(() => bodyEditor && !bodyEditor.pending);
        assert.equal(await page.evaluate(() => store.drafts.size), 0);
        assert.match(await source(), /Pending source/);
      } finally {
        await held.close();
      }
    }
  });

  await test("Saving locks editor transactions, adopts disk sources and retains the follow receipt", async () => {
    await fixture();
    await replaceText("A plain paragraph.", "Saved source");
    await leave();
    const held = await hold("**/save");
    try {
      await changes();
      await page.locator("#save").click();
      await held.wait();
      assert.equal(await page.evaluate(() => store.busy), true);
      const before = await source();
      await page.evaluate(() =>
        bodySurface.model.view.dispatch({ changes: { from: 0, insert: "Rejected" } }),
      );
      assert.equal(await source(), before);
      assert.equal(await page.locator("#connect").isDisabled(), true);
      assert.equal(await page.evaluate((p) => store.set(p, "lost"), A), false);
      held.release();
      await page.waitForFunction(() => !store.busy && !store.drafts.size);
      await settled();
      assert.equal(await source(), await readFile(join(info.root, A), "utf8"));
      assert.match(await page.evaluate(() => buildPrompt()), /SAVED — chronological/);
    } finally {
      await held.close();
    }
    await page.evaluate(() => syncDocuments());
    assert.match(await page.evaluate(() => buildPrompt()), /SAVED — chronological/);
  });

  await test("Copy includes all saved changes plus unsaved edits with the latest disk preconditions", async () => {
    await fixture();
    await edit(A, (s) => s + "\nSaved A first\n");
    await saved();
    await edit(B, (s) => s + "\nUnsaved B\n");
    let prompt = await page.evaluate(() => buildPrompt());
    assert.match(prompt, /SAVED — chronological/);
    assert.match(prompt, /Saved A first/);
    assert.match(prompt, /UNSAVED —/);
    assert.match(prompt, /Unsaved B/);
    await saved();
    await edit(A, (s) => s + "\nSaved A second\n");
    await saved();
    const baseline = await readFile(join(info.root, A), "utf8");
    await edit(A, (s) => s + "\nUnsaved A third\n");
    prompt = await page.evaluate(() => buildPrompt());
    assert.match(prompt, /Saved A first/);
    assert.match(prompt, /Saved A second/);
    assert.match(prompt, /Unsaved B/);
    assert.ok(
      prompt.includes(
        "--- CAPTURED DISK BASELINE (CHECK BEFORE WRITING) ---\n" + baseline + "\n--- AFTER ---",
      ),
    );
    await page.evaluate(() => {
      store.receipt.push({ path: "docdoki/private/notes/x.md", from: "old", to: "new", private: true });
      warnPrivate();
    });
    assert.equal(await page.locator("#private-warning").getAttribute("hidden"), null);
    await discard();
  });

  await test("Unknown save outcomes and clipboard failures expose recovery without dropping drafts", async () => {
    await edit(A, (s) => s + "\r\nUnconfirmed save.\r\n");
    const fail = async (route) => {
      await route.fetch();
      await route.abort();
    };
    await page.route("**/save", fail);
    try {
      await changes();
      await page.locator("#save").click();
      await page.waitForFunction(() => !store.busy && saveFailure?.unknown);
    } finally {
      await page.unroute("**/save", fail);
    }
    assert.equal(await page.locator("#export").isVisible(), true);
    assert.match(await page.evaluate(() => buildPrompt()), /some edits may already be on disk/);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("denied");
          },
        },
      }),
    );
    await page.locator("#copy-agent").click();
    assert.equal(await page.locator("#prompt").isVisible(), true);
    assert.match(await page.locator("#prompt").inputValue(), /Unconfirmed save/);
    await discard();
  });

  await test("Stale clipboard results and path feedback never label a newer edit or document", async () => {
    await fixture();
    await edit(A, (s) => s + "\r\nDraft one.\r\n");
    await changes();
    await page.evaluate(() => {
      navigator.clipboard.writeText = () =>
        new Promise((_, reject) => {
          window.rejectCopy = reject;
        });
    });
    await page.locator("#copy-agent").click();
    await page.waitForFunction(() => !!window.rejectCopy);
    await closeChanges();
    await page.locator("#source").focus();
    await page.keyboard.type("New typing");
    await page.evaluate(() => window.rejectCopy(new Error("late")));
    assert.equal(await page.locator("#prompt").isVisible(), false);
    await leave();
    await page.evaluate(() => {
      navigator.clipboard.writeText = () =>
        new Promise((resolve) => {
          window.copyPath = resolve;
        });
    });
    await page.locator("#document-path").click();
    await open(B);
    await page.evaluate(() => window.copyPath());
    assert.equal(
      await page.locator("#document-path").evaluate((el) => el.classList.contains("copied")),
      false,
    );
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {};
    });
    await page.locator("#document-path").click();
    await page.waitForFunction(() => $("document-path").classList.contains("copied"));
  });

  await test("Discard refuses to erase typing that began while the latest-source read was pending", async () => {
    await fixture();
    await edit(A, (s) => s + "\r\nDiscard candidate.\r\n");
    const held = await hold("**/document?path=**");
    try {
      await changes();
      await page.locator(`[data-discard="${A}"]`).click();
      await held.wait();
      await closeChanges();
      await replaceText("A plain paragraph.", "Newer human text");
      held.release();
      await page.waitForFunction(() => $("status").textContent.includes("Editing continued"));
      assert.match(await source(), /Newer human text/);
    } finally {
      await held.close();
    }
    await leave();
    await saved();
    assert.match(await readFile(join(info.root, A), "utf8"), /Newer human text/);
  });

  await test("Dependency responses cannot cross snapshot replacement, typing or equal-text discard", async () => {
    for (const action of ["snapshot", "typing", "discard"]) {
      await fixture("---\nafter: []\n---\n# Export\n\nKeep original.\n");
      await writeFile(join(info.root, C), "---\nafter: []\n---\n# Publication\n");
      await page.reload();
      if (action === "discard") await edit(A, (s) => s + "\nDraft\n");
      const held = await hold("**/preview", (r) => !!r.postDataJSON().after);
      try {
        await page.evaluate((p) => {
          window.dependencyRequest = changeDependency(p, "c", false);
        }, A);
        await held.wait();
        if (action === "snapshot") {
          await writeFile(
            join(info.root, A),
            (await readFile(join(info.root, A), "utf8")) + "\nExternal retention\n",
          );
          await page.evaluate(() => syncDocuments());
        } else if (action === "typing") await edit(A, (s) => s + "\nLater typing\n");
        else {
          await writeFile(join(info.root, A), await page.evaluate((p) => store.source(p), A));
          await discard();
        }
        held.release();
        await page.evaluate(() => window.dependencyRequest);
        assert.match(await page.evaluate((p) => store.source(p), A), /after: \[\]/);
        if (action === "snapshot")
          assert.match(await page.evaluate((p) => store.source(p), A), /External retention/);
        if (action === "typing") assert.match(await page.evaluate((p) => store.source(p), A), /Later typing/);
      } finally {
        await held.close();
      }
    }
    await rm(join(info.root, C), { force: true });
  });

  await test("Fields and dependencies use canonical drafts even when a background graph preview is stale", async () => {
    await fixture("---\nafter: []\npurpose: Original\n---\n# Export\n");
    await writeFile(join(info.root, B), "---\nafter: []\n---\n# Validation\n");
    await writeFile(join(info.root, C), "---\nafter: []\n---\n# Publication\n");
    await page.reload();
    await edit(A, (s) =>
      s.replace("after: []", "after: [b]").replace("purpose: Original", "purpose: Typed in source"),
    );
    assert.match(await page.evaluate((p) => store.source(p), A), /purpose: Typed in source/);
    const held = await hold("**/preview", (r) => !r.postDataJSON().card && !r.postDataJSON().after);
    try {
      await page.evaluate(() => {
        window.backgroundPreview = updatePreview();
      });
      await held.wait();
      await board();
      await field("purpose");
      assert.equal(await input().inputValue(), "Typed in source");
      await input().fill("Card extension");
      await fieldDone();
      await page.evaluate((p) => changeDependency(p, "c", false), A);
      held.release();
      await page.evaluate(() => window.backgroundPreview);
      assert.match(await page.evaluate((p) => store.source(p), A), /after: \["b", "c"\]/);
      assert.match(await page.evaluate((p) => store.source(p), A), /Card extension/);
    } finally {
      await held.close();
    }
    await rm(join(info.root, C), { force: true });
  });

  await test("Clean automatic updates preserve reading position; private notes and archives remain reachable", async () => {
    await fixture(rich + "\r\n" + "More reading.\r\n\r\n".repeat(30));
    await leave();
    await page.evaluate(() => {
      $("workspace").scrollTop = 120;
    });
    const scroll = await page.locator("#workspace").evaluate((el) => el.scrollTop);
    await writeFile(join(info.root, A), (await source()) + "\r\nFresh on focus.\r\n");
    await page.evaluate(() => syncDocuments());
    assert.equal(await page.locator("#workspace").evaluate((el) => el.scrollTop), scroll);
    assert.match(await source(), /Fresh on focus/);
    await open("docdoki/notes/evidence.md");
    assert.match(await page.locator("#reading").innerText(), /useful observation/);
    await page.locator("#catalog details summary").click();
    await open("docdoki/stages/archive/follow-old.md");
    assert.match(await page.locator("#reading").innerText(), /Archived knowledge/);
    await sidebar("work");
    assert.match(await page.locator("#reading").innerText(), /Local work/);
    const path = "docdoki/private/specs/local.md";
    await edit(path, (s) => s + "\nPrivate adjustment\n");
    await changes();
    await page.locator("#copy-agent").click();
    assert.equal(await page.locator("#private-warning").isVisible(), true);
    assert.match(await page.evaluate(() => buildPrompt()), /\[PRIVATE\]/);
    assert.ok(
      (await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])).every(
        (k) => k === "ddpanel-lang",
      ),
    );
    await discard(path);
  });
}
