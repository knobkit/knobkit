import { expect, test } from "vitest";
import { journey, trigger, waitRecorded } from "../harness/index.js";
import { dragRow, firstColumn } from "../harness/grid.js";

// KNOBKIT.md task 16: grid rows can be reordered by dragging
journey("t16", (j) => {
  test("dragging row 3 above row 1 gives the handler from 2, to 0", async () => {
    const page = await j.open();
    expect(await firstColumn(page)).toEqual(["apples", "pears", "plums", "quinces"]);
    await dragRow(page, 2, -1);
    expect(await waitRecorded(page, "reordered")).toEqual({ from: 2, to: 0 });
    await expect.poll(() => firstColumn(page)).toEqual(["plums", "apples", "pears", "quinces"]);
  });

  test("the grid's data, read by a handler, is in the new order", async () => {
    const page = await j.open();
    await dragRow(page, 2, -1);
    await waitRecorded(page, "reordered");
    await trigger(page, "read");
    expect(await waitRecorded(page, "data")).toEqual([
      { name: "plums", count: 3 },
      { name: "apples", count: 1 },
      { name: "pears", count: 2 },
      { name: "quinces", count: 4 },
    ]);

    // and downwards: the first row dropped below the last
    await dragRow(page, 0, 3);
    expect(await waitRecorded(page, "reordered", 2)).toEqual({ from: 0, to: 3 });
    await trigger(page, "read");
    expect((await waitRecorded(page, "data", 2)).map((r: { name: string }) => r.name)).toEqual(["apples", "pears", "quinces", "plums"]);
    await expect.poll(() => firstColumn(page)).toEqual(["apples", "pears", "quinces", "plums"]);
  });
});
