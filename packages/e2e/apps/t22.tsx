import { code, col, grow, highlightedText, html, knobkit, output } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const marked = highlightedText({
  value: [
    { text: "The paper by " },
    { text: "Vaswani", label: "person" },
    { text: " introduced the " },
    { text: "Transformer", label: "model" },
    { text: " architecture in 2017." },
  ],
});
const formatted = output({ format: "markdown", value: "# Findings\n\nThe model uses **attention** and nothing else.\n\n- first point\n- second point" });
const plain = output({ value: "plain output with a phrase to select" });
const page = html({ value: "<p>An <em>html</em> pane with a phrase to select.</p>" });
const editor = code({ value: "alpha beta gamma\ndelta epsilon zeta\neta theta iota" });

export const app = knobkit({ title: "t22", fill: true, widgets: col(marked, formatted, plain, page, grow(editor), rec.widget) });

app.on(marked.clicked, (e) => rec.push("clicked", e));
app.on(marked.selected, (e) => rec.push("marked-selected", e));
app.on(formatted.selected, (e) => rec.push("formatted-selected", e));
app.on(plain.selected, (e) => rec.push("plain-selected", e));
app.on(page.selected, (e) => rec.push("html-selected", e));
app.on(editor.selected, (e) => rec.push("code-selected", e));
app.on(editor.changed, () => rec.push("code-changed", true));
