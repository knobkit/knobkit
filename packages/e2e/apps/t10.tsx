import { button, knobkit, output, tabs } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const pane = (text: string) => output({ value: text });
const book = tabs([
  { label: "First", content: pane("content of the first tab") },
  { label: "Second", content: pane("content of the second tab") },
  { label: "Third", content: pane("content of the third tab") },
]);
const third = button({ label: "select-third" });
const which = button({ label: "which" });

export const app = knobkit({ title: "t10", widgets: [third, which, book, rec.widget] });

app.on(third.clicked, () => book.select(2));
app.on(which.clicked, async () => rec.push("selected", await book.selected()));
