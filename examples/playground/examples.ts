export interface Example {
  name: string;
  code: string;
}

const echo = `import { knobkit, chat } from "knobkit";

const convo = chat({ placeholder: "Say something…" });

const app = knobkit({
  title: "Echo bot",
  description: "Whatever you send comes back reversed.",
  widgets: [convo],
});

app.on(convo.sent, async ({ text }) => {
  convo.say({ role: "user", content: text });
  convo.say({ role: "assistant", content: [...text].reverse().join("") });
});

app.mount("#root");
`;

const signup = `import { knobkit, text, number, radio, checkboxGroup, button, json } from "knobkit";

const name = text({ placeholder: "Your name" });
const age = number({ value: 18 });
const plan = radio({ choices: ["Free", "Pro", "Team"] });
const interests = checkboxGroup({ choices: ["Design", "Code", "Data", "Audio"] });
const submit = button({ label: "Create account" });
const out = json();

const app = knobkit({
  title: "Sign-up",
  description: "Single-choice plan (radio), multi-choice interests (checkbox group).",
  widgets: [name, age, plan, interests, submit, out],
});

app.on(submit.clicked, async () => {
  out.set({
    name: await name.value(),
    age: await age.value(),
    plan: await plan.value(),
    interests: await interests.value(),
  });
});

app.mount("#root");
`;

const settings = `import { knobkit, slider, checkbox, button, json, tabs, accordion, col } from "knobkit";

const volume = slider({ min: 0, max: 100, value: 40 });
const dark = checkbox({ label: "Dark mode" });
const telemetry = checkbox({ label: "Share usage data" });
const beta = checkbox({ label: "Enable beta features" });
const cache = slider({ min: 0, max: 1000, value: 200 });
const save = button({ label: "Save" });
const out = json();

const app = knobkit({
  title: "Settings",
  description: "Grouped into tabs; the risky knobs hide in a collapsed accordion.",
  widgets: col(
    tabs([
      { label: "General", content: col(volume, dark) },
      { label: "Advanced", content: accordion({ label: "Danger zone", open: false }, telemetry, beta, cache) },
    ]),
    save,
    out,
  ),
});

app.on(save.clicked, async () => {
  out.set({
    volume: await volume.value(),
    dark: await dark.value(),
    telemetry: await telemetry.value(),
    beta: await beta.value(),
    cacheMB: await cache.value(),
  });
});

app.mount("#root");
`;

const layout = `import { knobkit, text, slider, output, row, col } from "knobkit";

const heading = text({ placeholder: "Type a heading…" });
const level = slider({ min: 1, max: 6, value: 1 });
const preview = output({ format: "markdown" });

const app = knobkit({
  title: "Live markdown",
  widgets: row(col(heading, level), preview),
});

async function render() {
  const hashes = "#".repeat(await level.value());
  preview.set(hashes + " " + ((await heading.value()) || "Heading"));
}

app.on(heading.changed, render);
app.on(level.changed, render);

app.mount("#root");
`;

const dataViz = `import { knobkit, table, chart, row } from "knobkit";

const data = [
  { day: "Mon", sales: 12 },
  { day: "Tue", sales: 19 },
  { day: "Wed", sales: 7 },
  { day: "Thu", sales: 15 },
  { day: "Fri", sales: 22 },
];

const grid = table({
  columns: [
    { key: "day", label: "Day" },
    { key: "sales", label: "Sales" },
  ],
  rows: data,
});
const plot = chart({ kind: "bar", x: "day", y: "sales", data });

const app = knobkit({
  title: "Weekly sales",
  widgets: row(grid, plot),
});

app.mount("#root");
`;

const media = `import { knobkit, text, button, gallery, video, row, col } from "knobkit";

const prompt = text({ placeholder: "Describe an image…" });
const make = button({ label: "Generate" });
const grid = gallery();

const load = button({ label: "Load sample clip" });
const clip = video();

const app = knobkit({
  title: "Media",
  description: "Fill a gallery with generated images, or play a video.",
  widgets: col(row(prompt, make), grid, load, clip),
});

// a deterministic colored tile, so the demo needs no model and works offline
function swatch(hue: number, caption: string) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>" +
    "<rect width='240' height='240' fill='hsl(" + hue + ", 65%, 58%)'/></svg>";
  return { src: "data:image/svg+xml;utf8," + encodeURIComponent(svg), caption };
}

app.on(make.clicked, async () => {
  const p = (await prompt.value()) || "abstract art";
  let h = 0;
  for (const ch of p) h = (h * 31 + ch.charCodeAt(0)) % 360;
  grid.set(Array.from({ length: 6 }, (_, i) => swatch((h + i * 53) % 360, p + " #" + (i + 1))));
});

app.on(load.clicked, async () => {
  clip.set("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
});

app.mount("#root");
`;

const sentiment = `import { knobkit, text, button, label, col } from "knobkit";

const input = text({ placeholder: "Type a sentence…", lines: 2 });
const go = button({ label: "Classify" });
const result = label();

const POSITIVE = ["love", "great", "wonderful", "amazing", "happy", "good", "best", "awesome", "delightful"];
const NEGATIVE = ["hate", "terrible", "awful", "bad", "worst", "sad", "angry", "broken", "horrible"];

const app = knobkit({
  title: "Sentiment",
  description: "A toy classifier that counts cheerful vs grumpy words and shows confidences.",
  widgets: col(input, go, result),
});

app.on(go.clicked, async () => {
  const words = ((await input.value()) || "this is a wonderful and amazing day").toLowerCase().split(/[^a-z]+/);
  let pos = 1;
  let neg = 1;
  for (const w of words) {
    if (POSITIVE.includes(w)) pos++;
    if (NEGATIVE.includes(w)) neg++;
  }
  const total = pos + neg;
  result.set({
    confidences: [
      { label: "positive", score: pos / total },
      { label: "negative", score: neg / total },
    ],
  });
});

app.mount("#root");
`;

const entities = `import { knobkit, text, button, highlightedText, col } from "knobkit";

const input = text({ placeholder: "Type a sentence…", lines: 2 });
const go = button({ label: "Tag entities" });
const out = highlightedText();

const ENTITIES = {
  PERSON: ["ada", "alan", "alice", "bob", "grace"],
  PLACE: ["paris", "london", "tokyo", "berlin", "cairo"],
  ORG: ["acme", "nasa", "ibm", "sony", "bbc"],
};

const app = knobkit({
  title: "Entity tagger",
  description: "A toy NER that colors known people, places, and organizations.",
  widgets: col(input, go, out),
});

app.on(go.clicked, async () => {
  const src = (await input.value()) || "Ada met Alan in Paris to tour NASA.";
  // split into words + whitespace runs, keeping both so the text reflows exactly
  const spans = src.split(/(\\s+)/).map((tok) => {
    const w = tok.toLowerCase().replace(/[^a-z]/g, "");
    for (const label of Object.keys(ENTITIES)) {
      if (w && ENTITIES[label].includes(w)) return { text: tok, label };
    }
    return { text: tok };
  });
  out.set(spans, { PERSON: "#2563eb", PLACE: "#16a34a", ORG: "#d97706" });
});

app.mount("#root");
`;

const detection = `import { knobkit, button, annotatedImage, col } from "knobkit";

// an offline "photo": an SVG scene of emoji, encoded as a data URL (no model, works offline).
// viewBox + width/height pins the 0..480 coordinate space to the intrinsic size, so the boxes (in
// those same pixels) stay aligned even when the panel scales the image down.
// dominant-baseline is NOT inherited, so it must sit on each <text>, not the <g>, or the emoji
// render with their baseline at y (above the box) instead of centered on it.
const scene =
  "<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320' viewBox='0 0 480 320'>" +
  "<rect width='480' height='320' fill='#dbeafe'/>" +
  "<rect y='250' width='480' height='70' fill='#bbf7d0'/>" +
  "<g font-size='90' text-anchor='middle'>" +
  "<text x='90' y='95' dominant-baseline='central'>☀️</text>" +
  "<text x='255' y='100' dominant-baseline='central'>🪁</text>" +
  "<text x='375' y='215' dominant-baseline='central'>🏠</text>" +
  "</g>" +
  "</svg>";
const src = "data:image/svg+xml;utf8," + encodeURIComponent(scene);

const detect = button({ label: "Detect objects" });
const out = annotatedImage();

const app = knobkit({
  title: "Object detection",
  description: "The image loads on start; press Detect to overlay labeled boxes.",
  widgets: col(detect, out),
});

app.setup(() => out.set(src)); // show the image as soon as the app starts

app.on(detect.clicked, async () => {
  // pixel boxes [xmin, ymin, xmax, ymax] framing each emoji, straight from "the model"
  out.set(src, [
    { label: "sun", box: [45, 50, 100, 140] },
    { label: "kite", box: [150, 55, 240, 145] },
    { label: "house", box: [230, 170, 320, 260] },
  ]);
});

app.mount("#root");
`;

const composed = `import { knobkit, number, button, row, col, embed } from "knobkit";

function counter(name) {
  const n = number({ value: 0 });
  const inc = button({ label: name });
  return knobkit({ widgets: row(n, inc) }).on(inc.clicked, async () => n.set((await n.value()) + 1));
}

const app = knobkit({
  title: "Composed apps",
  description: "Two independent counter apps, each authored on its own, embedded with embed().",
  widgets: col(embed(counter("Apples +1")), embed(counter("Bananas +1"))),
});

app.mount("#root");
`;

export const EXAMPLES: Example[] = [
  { name: "Echo bot", code: echo },
  { name: "Sign-up", code: signup },
  { name: "Composed apps", code: composed },
  { name: "Settings", code: settings },
  { name: "Live markdown", code: layout },
  { name: "Table & chart", code: dataViz },
  { name: "Media", code: media },
  { name: "Sentiment", code: sentiment },
  { name: "Entity tagger", code: entities },
  { name: "Object detection", code: detection },
];
