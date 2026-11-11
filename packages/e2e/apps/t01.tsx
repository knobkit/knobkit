import { button, code, col, grow, knobkit, row } from "knobkit";
import { recorder } from "./_rec.js";

export const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1} of the document`).join("\n");

const editor = code({ value: lines(20) });
const rec = recorder();
const b = (label: string) => button({ label });
const addEnd = b("add-end");
const addAt2 = b("add-at-2");
const same = b("same");
const long = b("long");
const change390 = b("change-390");
const read = b("read");
const auto = b("auto");
let autoOn = false;
let typed = 0;

export const app = knobkit({
  title: "t01",
  fill: true, // the editor gets a bounded box, so a long document scrolls inside it
  widgets: col(row(addEnd, addAt2, same, long, change390, read, auto), grow(editor), rec.widget),
});

const three = "\nadded 1\nadded 2\nadded 3";

app.on(addEnd.clicked, async () => editor.set((await editor.value()) + three));
app.on(addAt2.clicked, async () => {
  const l = (await editor.value()).split("\n");
  l.splice(1, 0, "added 1", "added 2", "added 3");
  editor.set(l.join("\n"));
});
app.on(same.clicked, async () => editor.set(await editor.value()));
app.on(long.clicked, () => editor.set(lines(400)));
app.on(change390.clicked, async () => {
  const l = (await editor.value()).split("\n");
  l[389] = "line 390 was changed by a handler";
  editor.set(l.join("\n"));
});
app.on(read.clicked, async () => rec.push("text", await editor.value()));
app.setup(() => {
  autoOn = false; // per session: the server process outlives one test's window
  typed = 0;
});
app.on(auto.clicked, () => {
  autoOn = true;
  typed = 0;
});

// every change the user makes is recorded; with "auto" on, the fifth one makes the handler add a
// section at the end, as an agent writing to the file the user is typing in would
app.on(editor.changed, async (text) => {
  rec.push("changed", text.length);
  if (autoOn && ++typed === 5) editor.set((await editor.value()) + "\n\n## A section added by the handler\nwith two lines");
});
