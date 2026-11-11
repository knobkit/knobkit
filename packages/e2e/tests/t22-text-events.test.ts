import { expect, test } from "vitest";
import { journey, recorded, sleep, waitRecorded } from "../harness/index.js";
import { selectPhrase } from "../harness/select.js";

// KNOBKIT.md task 22: text displays report clicks and selections
journey("t22", (j) => {
  test("highlighted text: clicking a marked span gives its index, label and text", async () => {
    const page = await j.open();
    await page.locator(".pu-hltext-span", { hasText: "Transformer" }).click({ position: { x: 12, y: 8 } });
    expect(await waitRecorded(page, "clicked")).toEqual({ index: 3, label: "model", text: "Transformer" });
    await page.locator(".pu-hltext-span", { hasText: "Vaswani" }).click({ position: { x: 12, y: 8 } });
    expect(await waitRecorded(page, "clicked", 2)).toEqual({ index: 1, label: "person", text: "Vaswani" });
    // text that is not marked is not a span to click
    await page.locator(".pu-hltext").click({ position: { x: 20, y: 12 } });
    await sleep(300);
    expect((await recorded(page)).filter((r) => r.name === "clicked").length).toBe(2);
  });

  test("highlighted text and formatted output: selecting a phrase gives the selected text", async () => {
    const page = await j.open();
    // across a marked span: the label drawn beside it is not part of the text
    await selectPhrase(page, page.locator(".pu-hltext"), "by Vaswani introduced the");
    expect(await waitRecorded(page, "marked-selected")).toEqual({ text: "by Vaswani introduced the" });
    // selecting is not clicking
    expect((await recorded(page)).filter((r) => r.name === "clicked")).toEqual([]);

    // across bold text in rendered markdown
    await selectPhrase(page, page.locator(".pu-md"), "uses attention and nothing");
    expect(await waitRecorded(page, "formatted-selected")).toEqual({ text: "uses attention and nothing" });

    // plain output, and html
    await selectPhrase(page, page.locator(".pu-output"), "a phrase to select");
    expect(await waitRecorded(page, "plain-selected")).toEqual({ text: "a phrase to select" });
    await selectPhrase(page, page.locator(".pu-html"), "html pane with");
    expect(await waitRecorded(page, "html-selected")).toEqual({ text: "html pane with" });

    // each selection went to its own widget, once
    const names = (await recorded(page)).map((r) => r.name);
    expect(names.filter((n) => n.endsWith("-selected"))).toEqual(["marked-selected", "formatted-selected", "plain-selected", "html-selected"]);
  });

  test("code editor: selecting a phrase gives the start, the end and the selected text", async () => {
    const page = await j.open();
    await selectPhrase(page, page.locator(".pu-code .cm-content"), "epsilon zeta");
    // "alpha beta gamma\n" is 17 characters, "delta " 6 more
    expect(await waitRecorded(page, "code-selected")).toEqual({ start: 23, end: 35, text: "epsilon zeta" });

    // with the keyboard, across a line break; one event once it has settled
    await page.locator(".pu-code .cm-content").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Meta+ArrowUp");
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 16; i++) await page.keyboard.press("Shift+ArrowRight");
    expect(await waitRecorded(page, "code-selected", 2)).toEqual({ start: 6, end: 22, text: "beta gamma\ndelta" });
    await sleep(400);
    expect((await recorded(page)).filter((r) => r.name === "code-selected").length).toBe(2);
    // selecting changes nothing in the text
    expect((await recorded(page)).filter((r) => r.name === "code-changed")).toEqual([]);
  });
});
