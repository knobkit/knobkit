import { col, grow, knobkit, table } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const grid = table({
  columns: [
    { key: "file", label: "File" },
    { key: "state", label: "State" },
  ],
  rows: [
    { file: "papers/attention.pdf", state: "finished" },
    { file: "papers/adam.pdf", state: "reading" },
    { file: "notes.md", state: "waiting" },
  ],
});

export const app = knobkit({ title: "t19", fill: true, widgets: col(grow(grid), rec.widget) });
