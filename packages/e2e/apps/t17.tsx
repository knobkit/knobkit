import { button, col, grow, knobkit, table } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const grid = table({
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
const which = button({ label: "which" });

export const app = knobkit({ title: "t17", fill: true, widgets: col(which, grow(grid), rec.widget) });

app.on(grid.selected, (e) => rec.push("selected", e));
app.on(which.clicked, async () => rec.push("which", await grid.selectedRow()));
