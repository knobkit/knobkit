import { button, col, frame, grow, knobkit, row, text } from "knobkit";
import { recorder } from "./_rec.js";

const address = text({ placeholder: "address" });
const go = button({ label: "go" });
const page = frame();
const rec = recorder();

export const app = knobkit({ title: "t14", fill: true, widgets: col(row(address, go), grow(page), rec.widget) });

app.on(go.clicked, async () => page.set(await address.value()));
app.on(page.loaded, (e) => rec.push("loaded", e));
app.on(page.refused, (e) => rec.push("refused", e));
