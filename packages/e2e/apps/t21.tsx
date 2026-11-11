import { button, checkboxGroup, dropdown, knobkit, radio, slider } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const pick = dropdown({ choices: ["a", "b", "c"], value: "b" });
const one = radio({ choices: ["a", "b", "c"], value: "b" });
const many = checkboxGroup({ choices: ["a", "b", "c"], value: ["a", "b"] });
const level = slider({ min: 0, max: 100, value: 50 });
const fresh = button({ label: "new-choices" });
const overlap = button({ label: "overlapping-choices" });
const narrow = button({ label: "range-0-10" });
const read = button({ label: "read" });

export const app = knobkit({ title: "t21", widgets: [fresh, overlap, narrow, read, pick, one, many, level, rec.widget] });

app.on(fresh.clicked, async () => {
  await pick.setChoices(["x", { value: "y", label: "Why" }, "z"]);
  await one.setChoices(["x", "y", "z"]);
  await many.setChoices(["x", "y", "z"]);
  rec.push("set", true);
});
// the selected values are among these: they stay
app.on(overlap.clicked, async () => {
  await pick.setChoices(["b", "q"]);
  await one.setChoices(["b", "q"]);
  await many.setChoices(["b", "q"]);
  rec.push("set", true);
});
app.on(narrow.clicked, async () => {
  await level.setRange(0, 10);
  rec.push("set", true);
});
app.on(read.clicked, async () =>
  rec.push("values", { pick: await pick.value(), one: await one.value(), many: await many.value(), level: await level.value() }),
);
app.on(pick.changed, (v) => rec.push("pick", v));
app.on(one.changed, (v) => rec.push("one", v));
app.on(many.changed, (v) => rec.push("many", v));
app.on(level.changed, (v) => rec.push("level", v));
