import { button, chat, col, grow, knobkit, row } from "knobkit";
import { recorder } from "./_rec.js";

const convo = chat();
const rec = recorder();
const one = button({ label: "one" });
const two = button({ label: "two" });

export const app = knobkit({ title: "t07", fill: true, widgets: col(row(one, two), grow(convo), rec.widget) });

// a 20-line diff: 8 lines kept, 6 removed, 6 added
const kept = (from: number, n: number): string[] => Array.from({ length: n }, (_, i) => `const kept${from + i} = ${from + i};`);
export const oldText = [...kept(1, 4), ...Array.from({ length: 6 }, (_, i) => `let before${i + 1} = "old";`), ...kept(5, 4)].join("\n");
export const newText = [...kept(1, 4), ...Array.from({ length: 6 }, (_, i) => `const after${i + 1} = "new";`), ...kept(5, 4)].join("\n");

app.setup(() => {
  // enough said already that the conversation has scrolled
  for (let i = 0; i < 30; i++) convo.say({ role: i % 2 ? "assistant" : "user", content: `Earlier message ${i + 1}, to fill the conversation.` });
});

app.on(one.clicked, () => {
  convo.tool({ id: "edit-1", name: "edit", input: { path: "src/app.ts" }, status: "awaiting", diff: { path: "src/app.ts", oldContent: oldText, newContent: newText } });
});
app.on(two.clicked, () => {
  convo.tool({ id: "edit-a", name: "edit", status: "awaiting", diff: { path: "a.ts", oldContent: "alpha one\nalpha two", newContent: "alpha one\nalpha 2" } });
  convo.tool({ id: "edit-b", name: "edit", status: "awaiting", diff: { path: "b.ts", oldContent: "beta one", newContent: "beta one\nbeta added" } });
});
app.on(convo.decided, (d) => rec.push("decided", d));
