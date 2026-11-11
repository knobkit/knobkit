import { button, code, col, grow, knobkit } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
// 100 KB: 2000 lines of 50 characters (49 and the line break)
const line = (i: number): string => `line ${String(i).padStart(4, "0")} ${"abcdefghij".repeat(4).slice(0, 39)}`;
const text = Array.from({ length: 2000 }, (_, i) => line(i + 1)).join("\n") + "\n";
const editor = code({ value: text });
const read = button({ label: "read" });

export const app = knobkit({ title: "t24", fill: true, widgets: col(read, grow(editor), rec.widget) });

// the handler keeps its own copy of the text, from the changes alone
let copy = text;
app.setup(() => {
  copy = text; // per session: the server process outlives one test's window
});
app.on(editor.edited, (e) => {
  for (const c of [...e.changes].reverse()) copy = copy.slice(0, c.from) + c.insert + copy.slice(c.to);
  rec.push("edited", { bytes: JSON.stringify(e).length, changes: e.changes });
});
app.on(read.clicked, async () => {
  const value = await editor.value();
  rec.push("read", { length: value.length, head: value.slice(0, 400), copyEquals: copy === value, value: value.slice(49_900, 50_400) });
});
