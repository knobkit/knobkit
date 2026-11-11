# <img src="https://raw.githubusercontent.com/knobkit/knobkit/main/design/logo.svg" height="28" alt="" /> knobkit

[![CI](https://github.com/knobkit/knobkit/actions/workflows/ci.yml/badge.svg)](https://github.com/knobkit/knobkit/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/knobkit.svg)](https://www.npmjs.com/package/knobkit) [![license](https://img.shields.io/npm/l/knobkit.svg)](https://github.com/knobkit/knobkit/blob/main/LICENSE)

**Create TypeScript webapps in minutes. Ship, host and share everywhere.** Declare widgets, write `on(event, handler)` functions — done. The
same `demo.tsx` runs entirely in the browser (`mount`) or on a stateless Node server (`serve`); change
the last line to swap. **The browser owns all state** — the server holds none of your app's data, so
restarts and reconnects are free.

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
live transcription, webcam filters, an agent dashboard, a drive-style file browser, an Electron
desktop app; each a single `demo.tsx`.

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
- **write** with structured setters — `out.set(v)`, `convo.say(m)`, `logw.push(line)`;
- **produce** by `return`ing an event from the handler (re-emitted, like a user action).

Streams (mic clips, webcam frames) arrive on **channels**, handled with the same `on(...)`; the
`latest` policy drops stale frames automatically while a handler is busy — no hand-rolled guards.

`setup(fn)` runs once per session for async startup (load weights, fetch data). `widget.busy(fn)` wraps
a handler in a transient working span (a bar; drops the widget's input while running); `disable()` /
`enable()` is the persistent version. Widget methods only work inside a handler or `setup`.

| | `mount("#root")` | `serve()` |
|---|---|---|
| `on(...)` handlers | run in the browser | run on a stateless Node server |
| transport | local call | WebSocket (auto-resume on reconnect) |
| use when | fits client-side (incl. WebGPU models) | needs the server (large models, secrets, native deps) |

`mount` builds to static files you can host anywhere; `serve` keeps no app state on the server. Widgets,
handlers, and methods are identical across both — only the last line changes.

Binary data (images, audio) travels as a **MediaRef** — an opaque handle you get from
`toMedia(bytes, mime)` and turn back with `await mediaBytes(ref)` or `mediaUrl(ref)`; the bytes
themselves stay out of app state and cross the wire lazily. `knobkit/media` adds `dataUrlToBytes`,
`bytesToDataUrl`, `pcmToWav`.

## Widgets

**Value inputs** share one shape: a `changed` event whose **payload is the value**, plus
`await w.value()` and `w.set(v)`.

| Factory (defaults) | `changed` value | Notes |
|---|---|---|
| `text({ placeholder?, lines? })` | `string` | `lines` = textarea rows (default 1) |
| `number({ value?, min?, max?, step? })` | `number` | numeric stepper (init 0) |
| `dropdown({ choices, value? })` | `string` | `choices: (string \| { value, label? })[]`; `value` defaults to the first choice. `await setChoices(choices)` replaces the choices during a run; a selected value not among them is cleared to `""` |
| `slider({ value?, min?, max?, step? })` | `number` | `min` 0, `max` 100, `step` 1; `value` defaults to `min`. `await setRange(min, max, step?)` replaces the range during a run; a value outside it moves to its nearer end |
| `checkbox({ label?, value? })` | `boolean` | single toggle |
| `checkboxGroup({ choices, value? })` | `string[]` | multi-select. `await setChoices(choices)` replaces the choices during a run; ticked values not among them are dropped |
| `radio({ choices, value? })` | `string` | single-select; `value` defaults to the first choice. `await setChoices(choices)` replaces the choices during a run; a selected value not among them is cleared to `""` |

**Other inputs:**

| Factory (defaults) | Events / channels | Methods |
|---|---|---|
| `button({ label })` | `clicked` | |
| `upload({ accept?, multiple?, label? })` | `picked` (`MediaRef`, per file), `changed` (`UploadFile[]`) | `await value()`, `await files()`, `clear()`. `UploadFile: { name, type, size, ref }` |
| `mic({ every?, control?, hold? })` | `clip` channel (`Float32Array`, 16 kHz mono PCM) | `start()`, `stop()`, `await toggle()`, `await live()`. `every` ms emits a clip every N ms (0 = one clip per recording) |
| `webcam({ every?, preview? })` | `frame` channel (`MediaRef`, JPEG) | `start()`, `stop()`. `every` ms emits a frame every N ms (0 = preview only) |
| `chat({ placeholder?, voice?, images?, markdown? })` | `sent` (`{ text, image? }`), `decided` (`{ id, decision }`), `recorded` channel (`Float32Array`) | `await history()`, `say(msg)`, `append(token)`, `appendTo(id, token)`, `clear()`; tool calls and queued messages below. `markdown` renders assistant replies; `images`/`voice` add attach/talk buttons |

**An agent's conversation** — `chat` also shows what an agent does between its replies:

```ts
convo.say({ id: "r1", role: "assistant", content: "" });
convo.appendTo("r1", token);                      // streams into that message, wherever it now sits
convo.tool({ id: "c1", name: "read", input: { path: "src/app.js" } });
convo.toolResult("c1", text);                     // or toolResult(id, message, true) for a failure
convo.tool({ id: "c2", name: "edit", input, status: "awaiting" });   // shows Accept / Reject
convo.tool({ id: "c3", name: "edit", status: "awaiting",             // …and the change as a diff
  diff: { path: "src/app.js", oldContent, newContent } });

app.on(convo.decided, ({ id, decision }) => { /* "accept" | "reject", for the call `id` */ });

convo.runStarted();                               // shows Stop beside the input; runEnded() removes it
app.on(convo.stopped, () => { /* arrives while the handler for the message is still running */ });

convo.queue(text);                                // sent while the agent works: shown as queued
convo.dequeue();                                  // taken up (or setQueued(list))
convo.say({ role: "error", content: "The model call failed" });
```

A `Message` is `{ id?, role, content, image? }` with `role` one of `user`, `assistant`, `system`,
`tool`, `error`. A tool call is `{ id, name, input?, status, result?, diff? }` with `status` one of
`running`, `awaiting`, `done`, `error`, `rejected`; `toolStatus(id, status)` sets it and
`await toolCalls()` reads them. `history()` returns tool calls as `{ role: "tool", call: id }`
entries. A message sent while an earlier `sent` handler is still running is shown at once, marked
*waiting*, until its own handler begins — there is nothing to write for it. In a container that gives it height (a split pane, tabs, a `fill` page) the conversation
scrolls and the input stays in place.

**Outputs** (write-only):

| Factory (defaults) | Write / methods | Notes |
|---|---|---|
| `output({ format? })` | `set(text)`, `append(text)`, `clear()` | `format: "markdown"` renders GFM; `append` streams tokens |
| `log({ maxLines? })` | `push(line)`, `pushStyled(line, level?)`, `setFilter(q)`, `clear()`, `await all()` | append-only lines; levels color-code |
| `json()` | `set(value)` | pretty-printed JSON |
| `label()` | `set(string \| { label?, confidences? })` | classifier result; `confidences: { label, score }[]` → bars |
| `html({ value? })` | `set(markup)` | raw HTML |
| `progress({ label? })` | `set(value, label?)` | `value` is 0..1 |
| `file()` | `set({ name?, url } \| url)` | offer a download; `url` may be a `MediaRef` |
| `image()` | `show(srcOrRef)`, `clear()` | `MediaRef` or URL |
| `gallery()` | `set(items)`, `add(item)`, `select(index \| null)`, `await selected()` | `item: { src, caption? }`; `src` `MediaRef` or URL. Event `clicked` (`{ index, caption? }`) when the user clicks a thumbnail; the clicked one is shown as selected |
| `audio({ autoplay? })` | `set(srcOrRef)` | `MediaRef` or URL |
| `video({ autoplay?, loop? })` | `set(srcOrRef)`, `seek(seconds)`, `play()`, `pause()`, `playRange(from, to)`, `await position()`, `await playing()`, `await duration()` | `MediaRef` or URL. Events for what the user does with the controls: `played`, `paused`, `seeked`, and `progress` about twice a second while playing — each `{ position }` in seconds. `seek` moves the player without loading the clip again; what a handler's own commands cause is not sent back as an event |
| `annotatedImage()` | `set(src, annotations?, colorMap?)` | `Annotation: { label, box?: [x0,y0,x1,y1], mask? }` |
| `highlightedText()` | `set(spans, colorMap?)` | `span: { text, label? }` (label omitted = plain) |
| `frame({ src? })` | `set(url)`, `reload()` | iframe with its address and an open-in-a-new-window control; `reload()` loads the same address again. Events `loaded` and `refused` (`{ src }`): on `serve`, `set(url)` asks the site whether it allows embedding, and a site that does not gets a message in the pane and `refused` instead of a blank frame. `mount` cannot tell — the browser reports a refused page as loaded |
| `chart({ x, y, kind?, data? })` | `setData(rows)` | `x` = category key; `y` = key or `string[]`; `kind` bar/line/area |
| `diff()` | `setFiles(files)` | `FileDiff: { path, oldContent, newContent, language?, status? }` |
| `statusBadge(status?, { variants? })` | `set(status)` | dot + label; `variants` maps custom statuses to idle/running/waiting/completed/failed/error |
| `toast()` | `show(message, variant?)` | transient notifications; `variant` info/success/warning/error |

**Editable or read-only:**

| Factory (defaults) | Events | Methods |
|---|---|---|
| `code({ value?, language?, readOnly? })` | `changed` (string) | `await value()`, `set(src)`, `setLanguage(lang)` |
| `table({ columns?, rows?, editable?, reorderable?, maxHeight? })` | `edited` (`{ row, key, value }`), `reordered` (`{ from, to }`), `selected` (`{ row, item }`, when the user goes to another row by a click or the keyboard), `contextmenu` (`{ item, row, x, y }`) | `await data()`, `await selectedRow()`, `setRows`, `setColumns`, `addRow`, `setCell`. `Column: { key, label?, type?, width? }`. A `type: "number"` column holds and delivers numbers: `4` typed there arrives as the number 4, an emptied cell as `null`, and text that is not a number is not taken. `reorderable: true` gives each row a handle to drag it to another place (a line shows where it will land); the rows are then in the new order for `data()`, and column sorting is off. A column without a `width` is as wide as its header and its text need; when the grid is too narrow for that the columns are narrowed to fit, and a cell that is cut shows its full text on hover |
| `terminal({ rows?, cols?, scrollback?, echo? })` | `data` (string), `resized` | `write(text)`, `writeln(line)`, `clear()`. `echo` echoes typed input locally |

**Navigation:**

| Factory (defaults) | Events | Methods |
|---|---|---|
| `toolbar(items?)` | `clicked` (`{ id }`) | `setItems(items)`. `ToolbarItem: { id, label, icon?, disabled?, variant?, separator? }` |
| `tree(nodes \| { nodes?, expanded?, selected? })` | `selected`/`activated` (`{ id, data? }`), `expanded`/`collapsed`, `contextmenu` (`{ id, x, y }`), `renamed` (`{ id, name }`) | `setNodes`, `setChildren(id, nodes)`, `expand(id)`, `collapse(id)`, `select(id)`, `rename(id)`. `TreeNode: { id, label, icon?, children?, hasChildren?, data? }` |
| `breadcrumb({ crumbs? })` | `selected` (`{ id }`) | `set(crumbs)`. `Crumb: { id, label }` |
| `menu()` | `selected` (`{ action, target }`) | `open({ x, y, items, target? })`, `close()`. `MenuItem: { id, label, icon?, danger?, disabled?, separator? }` |
| `sidebar(sections?)` | `selected` (`{ id }`) | `setSections(sections)`. Section: `{ label, items: { id, label, icon?, badge? }[] }`. A label too long for the sidebar is cut, and shows in full on hover |

## Layout

`widgets` is a tree of widget objects (no keys/strings). An array is an implicit `col`:

```ts
knobkit({ widgets: col(photo, row(size, go), caption) });
grid([a, b, c, d], { cols: 2 });
tabs([{ label: "One", content: a }, { label: "Two", content: b }]);
splitPane(editor, preview, { direction: "horizontal", ratio: 0.5 });
drawer(nav, main, { open: true });
accordion({ label: "Advanced", open: false }, x, y);
```

Containers are widgets whose state is their arrangement, so a handler can restructure the UI at
runtime — `panel.add(chart)`, `await panel.removeChild(chart)`. A widget made inside a handler takes
handlers the same way: call `app.on(w.changed, fn)` there, and it applies to that user's session.

`tabs`: `book.select(2)` brings the third tab to the front, as a click does; `await book.selected()` reads
which one is open; `book.addTab({ label, content, badge?, closable? })` adds a tab during a run. A tab's content is drawn when the tab is first
opened and stays on the page afterwards, so a video, an embedded page, an editor or a terminal is as it
was left when its tab is opened again.

Slot modifiers tune one child in place: `span(w, 2)` claims extra grid/row slots, `grow(w)` absorbs
a `col`'s leftover space, and `density(w, "sm")` / `theme(w, "dark")` restyle just that subtree.

Height works the same way at every depth. In a page that fills the window (`fill: true`), widgets
that scroll their own content — `chat`, `code`, `terminal`, `table`, `tree`, `log`, `diff`, `output`,
`frame` — are held to the space their container has, however the containers are nested; several in
one `col` share it evenly, and `grow(w)` gives it to one. Everything else keeps its own height. On an
ordinary page nothing is held, and the page scrolls.

## Build your own widget

Widgets aren't privileged — every built-in is written against the same public API. A widget is one
`defineWidget` call plus a React view:

```ts
// counter/def.ts
import { defineWidget, t, viewRef } from "knobkit";

export const counter = defineWidget({
  type: "counter",
  state: { count: { initial: 0 } },                // runtime-changing attrs
  props: { step: { default: 1 } },                 // static config
  events: { changed: { payload: t<number>() } },   // or a Standard Schema for real validation
  ops: (at) => ({ add: at("count").op("inc"), reset: at("count").op("set", 0) }),
  methods: (self) => ({ value: () => self.at("count").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
```

```tsx
// counter/view.tsx
import type { ViewProps } from "knobkit";

export default function CounterView({ props, state, emit }: ViewProps<{ count: number }, { step: number }>) {
  return <button onClick={() => emit("changed", state.count + props.step)}>{state.count}</button>;
}
```

Drop it straight into your app (`widgets: [counter(), …]`), or publish it: a widget package depends
only on **`@knobkit/core`** (the engine kernel — as a peer dependency, no widget-library baggage),
namespaces its type `"<pkg>/<name>"`, and gets exactly the powers of the built-ins. Views load as
lazy chunks, so heavy dependencies cost nothing until rendered. See
[CLAUDE.md](https://github.com/knobkit/knobkit/blob/main/CLAUDE.md) for the full recipe.

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

Monorepo: `packages/core` is the engine (`@knobkit/core`), `packages/knobkit` the widget kit + CLI.

```bash
pnpm install
pnpm build            # core, then knobkit (library + browser bundle)
pnpm test             # vitest, both packages
pnpm typecheck        # all packages incl. examples
```

See [CLAUDE.md](https://github.com/knobkit/knobkit/blob/main/CLAUDE.md) for the architecture and how to
add a widget.

## License

[MIT](https://github.com/knobkit/knobkit/blob/main/LICENSE)
