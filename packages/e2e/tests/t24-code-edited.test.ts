import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, recorded, trigger, waitRecorded } from "../harness/index.js";
import { codeEditor } from "../harness/editor.js";

/** the editor's own text */
const editorText = (page: Page): Promise<string> =>
  page.locator(".pu-code .cm-content").first().evaluate((el) => (el as unknown as { cmTile: { view: any } }).cmTile.view.state.doc.toString());

// KNOBKIT.md task 24: the code editor sends the change, not the whole text
journey("t24", (j) => {
  test("in a 100 KB document, typing one letter sends less than 1 KB to the handler", async () => {
    const page = await j.open();
    // everything the page sends over a socket, counted from the socket's first frame: the listener
    // has to be there before the socket is, so the page is loaded again with it in place
    let sockets = 0;
    let sent = 0;
    page.on("websocket", (ws) => {
      sockets++;
      ws.on("framesent", (f) => (sent += f.payload.length));
    });
    await page.reload();
    await page.locator("#root .pu-field").first().waitFor();
    expect((await editorText(page)).length).toBe(100_000);

    await codeEditor(page).place(1000, 10);
    await page.waitForTimeout(400);
    const before = sent;
    await page.keyboard.type("x");
    const e = await waitRecorded(page, "edited");
    await page.waitForTimeout(400);

    // what the handler was called with
    expect(e.changes).toEqual([{ from: 999 * 50 + 9, to: 999 * 50 + 9, insert: "x" }]);
    expect(e.bytes).toBeLessThan(1024);
    expect((await recorded(page)).filter((r) => r.name === "edited").length).toBe(1);
    // what went to the server for it (server mode: the handler is there)
    if (j.mode === "serve") {
      expect(sockets).toBeGreaterThan(0);
      expect(sent - before).toBeGreaterThan(0);
    }
    expect(sent - before).toBeLessThan(1024);
  });

  test("after 100 keystrokes, the text a handler reads equals the text in the editor", async () => {
    const page = await j.open();
    await codeEditor(page).place(1000, 10);
    // 100 keystrokes of the kinds an edit is made of: letters, new lines, deletions
    const keys: string[] = [];
    for (let i = 0; i < 100; i++) keys.push(i % 17 === 16 ? "Enter" : i % 11 === 10 ? "Backspace" : "abcdefghijklmnopqrstuvwxyz"[i % 26]!);
    for (const k of keys) await page.keyboard.press(k, { delay: 5 });
    await waitRecorded(page, "edited", 100, 20_000);

    const inEditor = await editorText(page);
    expect(inEditor.length).not.toBe(100_000);
    await trigger(page, "read");
    const read = await waitRecorded(page, "read");
    expect(read.length).toBe(inEditor.length);
    expect(read.head).toBe(inEditor.slice(0, 400));
    expect(read.value).toBe(inEditor.slice(49_900, 50_400)); // the part that was typed in
    // and the copy the handler built from the changes alone is the same text
    expect(read.copyEquals).toBe(true);
    // none of the 100 carried the document
    const sizes = (await recorded(page)).filter((r) => r.name === "edited").map((r) => r.data.bytes as number);
    expect(sizes.length).toBe(100);
    expect(Math.max(...sizes)).toBeLessThan(1024);
  });
});
