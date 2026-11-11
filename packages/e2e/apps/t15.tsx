import { button, gallery, knobkit } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const tile = (fill: string): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${fill}"/></svg>`)}`;
const shots = gallery({
  items: [
    { src: tile("#c33"), caption: "first frame" },
    { src: tile("#3a3"), caption: "second frame" },
    { src: tile("#36c"), caption: "third frame" },
  ],
});
const which = button({ label: "which" });

export const app = knobkit({ title: "t15", widgets: [which, shots, rec.widget] });

app.on(shots.clicked, (e) => rec.push("clicked", e));
app.on(which.clicked, async () => rec.push("selected", await shots.selected()));
