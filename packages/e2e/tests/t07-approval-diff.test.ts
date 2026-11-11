import { expect, test } from "vitest";
import type { Locator, Page } from "playwright";
import { journey, recorded, waitRecorded } from "../harness/index.js";

const card = (page: Page, id: string): Locator => page.locator(`.pu-chat-tool[data-call="${id}"]`);

/** each diff row of a card: its sign, its text and its background */
const rows = (c: Locator): Promise<{ sign: string; text: string; bg: string; kind: string }[]> =>
  c.locator(".pu-diff-table tr").evaluateAll((trs) =>
    trs.map((tr) => ({
      sign: tr.querySelector(".pu-diff-sign")!.textContent!.trim(),
      text: tr.querySelector(".pu-diff-code")!.textContent!,
      bg: getComputedStyle(tr).backgroundColor,
      kind: tr.className.includes("--add") ? "add" : tr.className.includes("--remove") ? "remove" : "same",
    })),
  );

// KNOBKIT.md task 7: the approval card shows a diff
journey("t07", (j) => {
  test("a call waiting for a decision shows old and new text as a diff, coloured as the diff widget does", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "one", exact: true }).click();
    const c = card(page, "edit-1");
    await c.waitFor();
    const r = await rows(c);
    expect(r.length).toBe(20);
    expect(r.filter((x) => x.kind === "remove").map((x) => x.text)).toEqual(Array.from({ length: 6 }, (_, i) => `let before${i + 1} = "old";`));
    expect(r.filter((x) => x.kind === "add").map((x) => x.text)).toEqual(Array.from({ length: 6 }, (_, i) => `const after${i + 1} = "new";`));
    expect(r.filter((x) => x.kind === "remove").every((x) => x.sign === "−")).toBe(true);
    expect(r.filter((x) => x.kind === "add").every((x) => x.sign === "+")).toBe(true);
    // coloured: added, removed and unchanged rows have three different backgrounds
    const bg = (kind: string): string[] => [...new Set(r.filter((x) => x.kind === kind).map((x) => x.bg))];
    expect(bg("add").length).toBe(1);
    expect(bg("remove").length).toBe(1);
    expect(new Set([bg("add")[0], bg("remove")[0], bg("same")[0]]).size).toBe(3);
    // the same classes the diff widget's own rows carry
    expect(await c.locator("tr.pu-diff-row--add").count()).toBe(6);
    expect(await c.locator("tr.pu-diff-row--remove").count()).toBe(6);
    // not the input as JSON text
    expect(await c.locator("pre").count()).toBe(0);
  });

  test("for a 20-line diff, Accept and Reject are visible together with the diff, without scrolling", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "one", exact: true }).click();
    const c = card(page, "edit-1");
    await c.waitFor();
    await page.waitForTimeout(300);
    // every diff row and both buttons lie inside what the conversation shows, as it stands
    const seen = await c.evaluate((el) => {
      const scroller = el.closest(".pu-chat-messages")!.getBoundingClientRect();
      const inner = el.querySelector(".pu-chat-tool-diff")!.getBoundingClientRect();
      const top = Math.max(0, scroller.top, inner.top);
      const bottom = Math.min(innerHeight, scroller.bottom);
      const within = (r: DOMRect, lo: number, hi: number): boolean => r.height > 0 && r.top >= lo - 0.5 && r.bottom <= hi + 0.5;
      const rowsIn = [...el.querySelectorAll(".pu-diff-table tr")].map((tr) => within(tr.getBoundingClientRect(), top, Math.min(bottom, inner.bottom)));
      const buttons = [...el.querySelectorAll(".pu-chat-tool-actions button")].map((b) => within(b.getBoundingClientRect(), Math.max(0, scroller.top), bottom));
      return { rows: rowsIn.length, rowsIn: rowsIn.filter(Boolean).length, buttons };
    });
    expect(seen).toEqual({ rows: 20, rowsIn: 20, buttons: [true, true] });
    await expect(c.getByRole("button", { name: "Accept", exact: true })).toBeDefined();
    expect(await c.getByRole("button", { name: "Accept", exact: true }).isVisible()).toBe(true);
    expect(await c.getByRole("button", { name: "Reject", exact: true }).isVisible()).toBe(true);
  });

  test("clicking Accept or Reject sends the call's id and the decision", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "one", exact: true }).click();
    await card(page, "edit-1").getByRole("button", { name: "Accept", exact: true }).click();
    expect(await waitRecorded(page, "decided")).toEqual({ id: "edit-1", decision: "accept" });

    const again = await j.open();
    await again.getByRole("button", { name: "one", exact: true }).click();
    await card(again, "edit-1").getByRole("button", { name: "Reject", exact: true }).click();
    expect(await waitRecorded(again, "decided")).toEqual({ id: "edit-1", decision: "reject" });
  });

  test("two calls waiting at once each show their own diff and are decided separately", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "two", exact: true }).click();
    const a = card(page, "edit-a");
    const b = card(page, "edit-b");
    await b.waitFor();
    expect((await rows(a)).map((x) => `${x.kind}:${x.text}`)).toEqual(["same:alpha one", "remove:alpha two", "add:alpha 2"]);
    expect((await rows(b)).map((x) => `${x.kind}:${x.text}`)).toEqual(["same:beta one", "add:beta added"]);

    await b.getByRole("button", { name: "Reject", exact: true }).click();
    expect(await waitRecorded(page, "decided")).toEqual({ id: "edit-b", decision: "reject" });
    // the other is still waiting, with its buttons
    expect(await a.getAttribute("data-status")).toBe("awaiting");
    expect(await b.getByRole("button", { name: "Reject", exact: true }).count()).toBe(0);
    await a.getByRole("button", { name: "Accept", exact: true }).click();
    expect(await waitRecorded(page, "decided", 2)).toEqual({ id: "edit-a", decision: "accept" });
    expect((await recorded(page)).length).toBe(2);
  });
});
