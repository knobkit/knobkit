# <img src="https://raw.githubusercontent.com/knobkit/knobkit/main/design/logo.svg" height="28" alt="" /> knobkit

[![CI](https://github.com/knobkit/knobkit/actions/workflows/ci.yml/badge.svg)](https://github.com/knobkit/knobkit/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/knobkit.svg)](https://www.npmjs.com/package/knobkit) [![license](https://img.shields.io/npm/l/knobkit.svg)](https://github.com/knobkit/knobkit/blob/main/LICENSE)

**Create TypeScript webapps in minutes. Ship, host and share everywhere.** Declare widgets, write `on(event, handler)` functions — done. The
same `demo.tsx` runs entirely in the browser (`mount`) or on a stateless Node server (`serve`); change
the last line to swap. **The browser owns all state** — the server keeps none, so there are no sessions.

**[knobkit.dev](https://knobkit.dev)** — 30-second tour + a live playground (nothing to install).

> 🛠️ **Building with an AI agent?** The **[knobkit-skills](https://github.com/knobkit/knobkit-skills)**
> Agent Skill is the recommended way to scaffold and build a knobkit app fast — works in Claude Code
> or any [Agent Skills](https://agentskills.io)–compatible agent.

<a href="https://knobkit.dev"><img src="https://knobkit.dev/demo.gif" alt="knobkit — scaffold, run the dev server, edit, watch the browser update live" width="100%" /></a>

```ts
import { knobkit, mic, output } from "knobkit";
import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base.en");
const recorder = mic();
const transcript = output();

const app = knobkit({ title: "Transcribe", widgets: [recorder, transcript] });

app.on(recorder.clip, async (samples) => {
  const { text } = (await transcriber(samples)) as { text: string };
  transcript.set(text.trim() || "(silence)");
});

app.serve(); // runs Whisper on Node — change to app.mount("#root") to run it in the browser via WebGPU
```

See [`examples/`](https://github.com/knobkit/knobkit/tree/main/examples) — chatbots, image captioning,
live transcription, webcam filters, a Drive-style file manager; each a single `demo.tsx`.

## Quick start

```bash
npm create knobkit@latest my-app   # prompts mount (browser) vs serve (node); or pass --mount / --serve
cd my-app && npm install && npm run dev
```

Already have a project? `npm install knobkit`. Requires **Node ≥ 22**.

## CLI

```bash
knobkit dev         # dev server — auto-detects the tier from mount()/serve() in the entry
knobkit build       # build a mount app to static files in dist/
knobkit serve       # run a serve app
knobkit playground  # split-pane REPL: editor + live preview, file picker, edits round-trip to disk
```

Entry = your package.json `"main"` (override with `knobkit dev other.tsx`). `--mount` / `--serve` force
the tier; `--port <n>` sets the port (playground default 4317).

## How it works

A handler is a plain `on(event, async fn)`. Inside it you do exactly three things:

- **read** widget state with async getters — `await box.value()`, `await convo.history()` (a real
  round-trip on serve);
- **write** with structured setters — `out.set(v)`, `convo.say(m)`, `log.push(line)`;
- **produce** by `return`ing an event from the handler (re-emitted, like a user action).

`setup(fn)` runs once per session for async startup (load weights, fetch data). `widget.busy(fn)` wraps
a handler in a transient working span (a bar; drops the widget's input while running); `disable()` /
`enable()` is the persistent version. Widget methods only work inside a handler or `setup`.

| | `mount("#root")` | `serve()` |
|---|---|---|
| `on(...)` handlers | run in the browser | run on a stateless Node server |
| transport | local call | socket.io |
| use when | fits client-side (incl. WebGPU models) | needs the server (large models, secrets, native deps) |

`mount` builds to static files you can host anywhere; `serve` adds no session state. Widgets, handlers,
and methods are identical across both — only the last line changes.

## Widgets

**Value inputs** all share one shape: a `changed` event whose **payload is the value**, plus
`await w.value()` and `w.set(v)`. (No `.submitted`/`.uploaded` — listen on `changed`, or use a
`button`'s `.clicked` and read `await input.value()`.)

| Factory (defaults) | `changed` value | Notes |
|---|---|---|
| `text({ placeholder?, lines? })` | `string` | `lines` = textarea rows (default 1) |
| `number({ value?, min?, max? })` | `number` | numeric stepper (init 0) |
| `slider({ value?, min?, max?, step? })` | `number` | `min` 0, `max` 100, `step` 1 |
| `dropdown({ choices, value? })` | `string` | `choices: string[]`; `value` defaults to `choices[0]` |
| `checkbox({ label?, value? })` | `boolean` | single toggle |
| `checkboxGroup({ choices, value? })` | `string[]` | multi-select |
| `radio({ choices, value? })` | `string` | single-select |
| `upload({ accept?, multiple? })` | `{ files: UploadFile[] }` | each `UploadFile` is `{ name, type, size, url }` (`url` is a data URL); `value()` is the first file, `files()` all; `accept` default `*/*` |

**Other inputs:**

| Factory (defaults) | Events | Methods |
|---|---|---|
| `button({ label })` | `clicked` | `set({ label })` |
| `mic({ every?, control?, hold? })` | `clip` (Float32Array), `toggled` | `start()`, `stop()`, `await toggle()`, `await live()`. `every` ms emits a clip every N ms (0 = hold/toggle only) |
| `webcam({ every?, control?, preview?, facing? })` | `frame` (data URL), `toggled` | same controls. `every` ms emits a frame every N ms (0 = preview only); `facing` `"user"`/`"environment"` |
| `chat({ placeholder?, voice?, images?, markdown? })` | `sent` (`{ text, image? }`), `recorded` | `await history()`, `say(msg)`, `append(token)`. `markdown` renders assistant replies; `images`/`voice` add attach/talk buttons |

**Navigation:**

| Factory (defaults) | Events | Methods |
|---|---|---|
| `tree({ nodes?, expanded?, selected? })` | `selected`, `activated`, `expanded`, `collapsed`, `contextmenu` (`{ id, x, y }`), `renamed` (`{ id, name }`) | `await nodes()`, `await selection()`, `setNodes`, `select(id)`, `expand(id)`, `collapse(id)`, `setChildren(id, kids)`, `rename(id)` (inline edit). `TreeNode: { id, label, icon?, children?, hasChildren? }` |
| `breadcrumb({ crumbs? })` | `selected` (`{ id }`) | `await path()`, `set(crumbs)`, `push(crumb)`. `Crumb: { id, label }` |
| `menu()` | `selected` (`{ action, target }`) | `open({ x, y, items, target? })`, `close()`. `MenuItem: { id, label, icon?, danger?, disabled?, separator? }` — pair with a widget's `contextmenu` event for right-click |

**Outputs** (write-only; `set(...)` replaces the value):

| Factory (defaults) | Write / methods | Notes |
|---|---|---|
| `output({ format? })` | `set(text)` | `format: "markdown"` renders GFM |
| `json()` | `set(value)` | pretty-printed JSON |
| `log()` | `push(line)`, `await all()` | append-only lines |
| `label()` | `set(string \| { label?, confidences? })` | classifier result; `confidences: { label, score }[]` → bars |
| `html({ value? })` | `set(markup)` | raw HTML |
| `image()` | `set(urlOrDataUrl)` | one image |
| `gallery()` | `set(items)`, `add(item)` | `item: { src, caption? }` |
| `audio({ autoplay? })` / `video({ autoplay?, loop? })` | `set(src)` | URL or data URL |
| `progress({ label? })` | `set(value, label?)` | `value` is 0..1 |
| `file()` | `set({ name?, url } \| url)` | offer a download |
| `annotatedImage()` | `set(src, annotations?, colorMap?)` | `Annotation: { label, box?: [x0,y0,x1,y1], mask? }` |
| `highlightedText()` | `set(spans, colorMap?)` | `span: { text, label? }` (label omitted = plain) |
| `chart({ x, y, kind?, data? })` | `await data()`, `setData(rows)`, `push(point)` | `x` = category key; `y` = key or `string[]`; `kind` bar/line/area; height follows density |
| `frame({ src?, doc?, sandbox?, title? })` | `load(url)`, `show(doc)`, `clear()` | iframe; event `loaded` |

**Editable or read-only:**

| Factory (defaults) | Events | Methods |
|---|---|---|
| `code({ value?, language?, editable?, wrap? })` | `changed` (string) | `await value()`, `set(src)`, `setLanguage(lang)`. `editable: false` = viewer; `wrap` soft-wraps |
| `table({ columns?, rows?, editable? })` | `edited`, `activated`, `contextmenu` | `await data()`, `setRows`, `setColumns`, `addRow`, `setCell`. `Column: { key, label?, type?, width?: xs..xl }`; height follows density |

**Custom:** `widget({ state, view, fold?, behavior? })` builds a widget from scratch — `state` is its
data, `view(state, emit)` renders it, `fold` applies events to state.

## Layout

`widgets` is a tree of widget objects (no keys/strings). An array is an implicit `col`:

```ts
knobkit({ widgets: col(photo, row(size, go), caption) });
grid([a, b, c, d], { cols: 2 });
tabs([{ label: "One", content: a }, { label: "Two", content: b }]);
accordion({ label: "Advanced", open: false }, x, y);
sidebar(nav, main, { open: true }); // collapsible fixed-width nav + content pane
```

`row` lays its children out in equal slots; reshape the split without pixels:

```ts
row(span(table, 2), detail);   // table takes 2 slots, detail 1
grow(editor);                  // flex-fill the remaining space (great under fill: true)
```

Scope theme/density to one subtree — they're per-widget overrides of the app-level setting:

```ts
density(sidebar(nav, main), "sm"); // a tighter nav; the rest of the app stays md
theme(preview, "dark");
```

Containers are widgets whose state is their arrangement, so a handler can restructure the UI at
runtime — `panel.add(chart)`, `await panel.remove(old)`, `panel.show(a, b)` (replace its children).

## Theming

Set on `knobkit({ … })`, or flip at runtime with `setTheme` / `setDensity`:

- **`theme`** — `"system"` (default) | `"light"` | `"dark"`.
- **`density`** — `"xs" | "sm" | "md" | "lg" | "xl"` (default `md`) — spacing, control sizes, radii, type.
- **`fill: true`** — full-bleed shell that fills the viewport (for split panes / dashboards) instead of
  the centered card.

Everything renders from CSS custom properties (`--pu-bg`, `--pu-accent`, `--pu-gap`, the `--pu-series-*`
chart palette, …); theme/density just remap them, so one switch restyles the whole kit (including the
`code` editor, `table`, and `chart`). The attributes inherit, so you can scope them to one container; to
rebrand, override the tokens in your CSS (e.g. `:root { --pu-accent: rebeccapurple }`).

## Develop

```bash
pnpm install
pnpm -F knobkit build   # library + browser client bundle
pnpm -F knobkit test    # vitest
pnpm typecheck          # all packages
```

See [CLAUDE.md](https://github.com/knobkit/knobkit/blob/main/CLAUDE.md) for the architecture and how to
add a widget.

## License

[MIT](https://github.com/knobkit/knobkit/blob/main/LICENSE)
