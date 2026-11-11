import { button, folderPicker, knobkit } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
// server mode: the folder the list starts at, set by the harness (the test) through the environment
const root = typeof process !== "undefined" ? process.env["E2E_ROOT"] : undefined;
const picker = folderPicker({ root });
const readOne = button({ label: "read-one" });

export const app = knobkit({ title: "t26", widgets: [readOne, picker, rec.widget] });

app.on(picker.picked, (e) => rec.push("picked", { name: e.name, path: e.path, files: e.files.map((f) => ({ path: f.path, size: f.size })) }));
app.on(readOne.clicked, async () => {
  const bytes = await picker.read("part-1/file-042.bin");
  rec.push("bytes", Array.from(bytes));
});
