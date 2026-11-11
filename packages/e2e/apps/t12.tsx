import { button, code, col, frame, grow, knobkit, output, row, tabs, terminal, toMedia, video } from "knobkit";
import { fixtureBytes } from "./_files.js";

const player = video();
const page = frame({ src: "data:text/html,<title>embedded</title><h1>An embedded page</h1>" });
const editor = code({ value: Array.from({ length: 400 }, (_, i) => `line ${i + 1} of the document`).join("\n") });
const term = terminal();
const book = tabs([
  { label: "Video", content: player },
  { label: "Page", content: page },
  { label: "Code", content: editor },
  { label: "Terminal", content: term },
  { label: "Other", content: output({ value: "another tab" }) },
]);
const seek = button({ label: "seek-4" });

export const app = knobkit({ title: "t12", fill: true, widgets: col(row(seek), grow(book)) });

app.setup(async () => {
  term.writeln("hello from the terminal");
  term.writeln("second line of output");
  player.set(toMedia(await fixtureBytes("clip-10s.webm"), "video/webm"));
});
app.on(seek.clicked, () => player.seek(4));
