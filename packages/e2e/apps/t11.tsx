import { button, knobkit, output, tabs } from "knobkit";

const book = tabs([{ label: "First", content: output({ value: "content of the first tab" }) }]);
const add = button({ label: "add" });
let n = 0;

export const app = knobkit({ title: "t11", widgets: [add, book] });

app.setup(() => {
  n = 0;
});
// one call: the tab, its label and its content
app.on(add.clicked, () => {
  n++;
  book.addTab({ label: `Added ${n}`, content: output({ value: `content added by call ${n}` }) });
});
