import { col, knobkit, table } from "knobkit";

// an ordinary page (no `fill`): the grid has no height on offer and fits its rows
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
const long = table({
  columns: [{ key: "n", label: "N", type: "number" }],
  rows: Array.from({ length: 100 }, (_, n) => ({ n })),
  maxHeight: 300,
});

export const app = knobkit({ title: "t29", widgets: col(grid, long) });
