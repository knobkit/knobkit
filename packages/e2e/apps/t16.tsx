import { button, col, grow, knobkit, table } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const grid = table({
  reorderable: true,
  columns: [
    { key: "name", label: "Name" },
    { key: "count", label: "Count", type: "number" },
  ],
  rows: [
    { name: "apples", count: 1 },
    { name: "pears", count: 2 },
    { name: "plums", count: 3 },
    { name: "quinces", count: 4 },
  ],
});
const read = button({ label: "read" });

export const app = knobkit({ title: "t16", fill: true, widgets: col(read, grow(grid), rec.widget) });

app.on(grid.reordered, (e) => rec.push("reordered", e));
app.on(read.clicked, async () => rec.push("data", await grid.data()));
