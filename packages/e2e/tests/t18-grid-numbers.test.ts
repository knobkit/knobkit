import { expect, test } from "vitest";
import { journey, recorded, sleep, trigger, waitRecorded } from "../harness/index.js";
import { cell, typeInto } from "../harness/grid.js";

// KNOBKIT.md task 18: the grid delivers numbers as numbers
journey("t18", (j) => {
  test("4 typed into a number column reaches the handler as the number 4", async () => {
    const page = await j.open();
    await typeInto(page, 1, 1, "4");
    const e = await waitRecorded(page, "edited");
    expect(e).toEqual({ row: 1, key: "count", value: 4 });
    expect(typeof e.value).toBe("number");
  });

  test("the grid's data, read by a handler, holds the number 4", async () => {
    const page = await j.open();
    await typeInto(page, 1, 1, "4");
    await waitRecorded(page, "edited");
    await trigger(page, "read");
    const rows = await waitRecorded(page, "data");
    expect(rows).toEqual([
      { name: "apples", count: 1 },
      { name: "pears", count: 4 },
      { name: "plums", count: 3 },
    ]);
    expect(typeof rows[1].count).toBe("number");
  });

  test("a text column still delivers text, and a number column refuses what is not a number", async () => {
    const page = await j.open();
    await typeInto(page, 0, 0, "7");
    expect(await waitRecorded(page, "edited")).toEqual({ row: 0, key: "name", value: "7" });
    await typeInto(page, 2, 1, "lots");
    await sleep(400);
    expect((await recorded(page)).filter((r) => r.name === "edited").length).toBe(1);
    await expect.poll(() => cell(page, 2, 1).textContent()).toBe("3");
    await trigger(page, "read");
    expect((await waitRecorded(page, "data"))[2]).toEqual({ name: "plums", count: 3 });
  });
});
