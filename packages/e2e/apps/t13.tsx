import { button, col, frame, grow, knobkit, row, text } from "knobkit";

const address = text({ placeholder: "address" });
const go = button({ label: "go" });
const reload = button({ label: "reload" });
const page = frame();

export const app = knobkit({ title: "t13", fill: true, widgets: col(row(address, go, reload), grow(page)) });

app.on(go.clicked, async () => page.set(await address.value()));
app.on(reload.clicked, () => page.reload());
