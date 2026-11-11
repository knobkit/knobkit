import { knobkit, output, row, sidebar } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const nav = sidebar([
  {
    label: "Sources",
    items: [
      { id: "wiki", label: "en.wikipedia.org/wiki/Attention_Is_All_You_Need" },
      { id: "notes", label: "Notes" },
    ],
  },
]);

export const app = knobkit({ title: "t20", widgets: [row(nav, output({ value: "the page" })), rec.widget] });

app.on(nav.selected, (e) => rec.push("selected", e));
