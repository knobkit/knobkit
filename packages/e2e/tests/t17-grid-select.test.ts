import { expect, test } from "vitest";
import { journey, recorded, sleep, trigger, waitRecorded } from "../harness/index.js";
import { cell } from "../harness/grid.js";

// KNOBKIT.md task 17: the grid reports row selection
journey("t17", (j) => {
  test("clicking a row gives the handler the row's index", async () => {
    const page = await j.open();
    await cell(page, 2, 0).click();
    expect(await waitRecorded(page, "selected")).toEqual({ row: 2, item: { name: "plums", count: 3 } });

    // another cell of the same row is the same row: nothing more is sent
    await cell(page, 2, 1).click();
    await sleep(300);
    expect((await recorded(page)).filter((r) => r.name === "selected").length).toBe(1);

    // another row, by its second column
    await cell(page, 0, 1).click();
    expect((await waitRecorded(page, "selected", 2)).row).toBe(0);

    // and with the keyboard
    await page.keyboard.press("ArrowDown");
    expect((await waitRecorded(page, "selected", 3)).row).toBe(1);

    // a handler can read which row the user is on
    await trigger(page, "which");
    expect(await waitRecorded(page, "which")).toBe(1);
  });

  test("clicking a row's number selects the row", async () => {
    const page = await j.open();
    await page.locator('.pu-table revogr-data[slot="content"] .rgCell[data-rgrow="3"]').first().click();
    expect((await waitRecorded(page, "selected")).row).toBe(3);
  });
});
