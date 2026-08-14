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
live transcription, webcam filters, an agent dashboard; each a single `demo.tsx`.

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
| `dropdown({ choices, value? })` | `string` | `choices: (string \| { value, label? })[]`; `value` defaults to the first choice |

**Other inputs:**

| Factory (defaults) | Events / channels | Methods |
|---|---|---|
| `button({ label })` | `clicked` | |
| `upload({ label? })` | `picked` (`MediaRef`) | `await value()`, `clear()` |
| `mic({ every?, control?, hold? })` | `clip` channel (`Float32Array`, 16 kHz mono PCM) | `start()`, `stop()`, `await toggle()`, `await live()`. `every` ms emits a clip every N ms (0 = one clip per recording) |
| `webcam({ every?, preview? })` | `frame` channel (`MediaRef`, JPEG) | `start()`, `stop()`. `every` ms emits a frame every N ms (0 = preview only) |
| `chat({ placeholder?, voice?, images?, markdown? })` | `sent` (`{ text, image? }`), `recorded` channel (`Float32Array`) | `await history()`, `say(msg)`, `append(token)`, `clear()`. `markdown` renders assistant replies; `images`/`voice` add attach/talk buttons |

**Outputs** (write-only):

| Factory (defaults) | Write / methods | Notes |
|---|---|---|
| `output({ format? })` | `set(text)`, `append(text)`, `clear()` | `format: "markdown"` renders GFM; `append` streams tokens |
| `log({ maxLines? })` | `push(line)`, `pushStyled(line, level?)`, `setFilter(q)`, `clear()`, `await all()` | append-only lines; levels color-code |
| `image()` | `show(srcOrRef)`, `clear()` | `MediaRef` or URL |
| `audio({ autoplay? })` | `set(srcOrRef)` | `MediaRef` or URL |
| `frame({ src? })` | `set(url)` | iframe |
| `chart({ x, y, kind?, data? })` | `setData(rows)` | `x` = category key; `y` = key or `string[]`; `kind` bar/line/area |
| `diff()` | `setFiles(files)` | `FileDiff: { path, oldContent, newContent, language?, status? }` |
| `statusBadge(status?, { variants? })` | `set(status)` | dot + label; `variants` maps custom statuses to idle/running/waiting/completed/failed/error |
| `toast()` | `show(message, variant?)` | transient notifications; `variant` info/success/warning/error |

**Editable or read-only:**

| Factory (defaults) | Events | Methods |
|---|---|---|
| `code({ value?, language?, readOnly? })` | `changed` (string) | `await value()`, `set(src)`, `setLanguage(lang)` |
| `table({ columns?, rows?, editable?, maxHeight? })` | `edited` (`{ row, key, value }`) | `await data()`, `setRows`, `setColumns`, `addRow`, `setCell`. `Column: { key, label?, type?, width? }` |
| `terminal({ rows?, cols?, scrollback?, echo? })` | `data` (string), `resized` | `write(text)`, `writeln(line)`, `clear()`. `echo` echoes typed input locally |

**Navigation:**

| Factory (defaults) | Events | Methods |
|---|---|---|
| `toolbar(items?)` | `clicked` (`{ id }`) | `setItems(items)`. `ToolbarItem: { id, label, icon?, disabled?, variant?, separator? }` |
| `tree(nodes?)` | `selected` (`{ id, data? }`) | `setNodes(nodes)`. `TreeNode: { id, label, icon?, children?, data? }` |
| `sidebar(sections?)` | `selected` (`{ id }`) | `setSections(sections)`. Section: `{ label, items: { id, label, icon?, badge? }[] }` |

## Layout

`widgets` is a tree of widget objects (no keys/strings). An array is an implicit `col`:

```ts
knobkit({ widgets: col(photo, row(size, go), caption) });
grid([a, b, c, d], { cols: 2 });
tabs([{ label: "One", content: a }, { label: "Two", content: b }]);
splitPane(editor, preview, { direction: "horizontal", ratio: 0.5 });
accordion({ label: "Advanced", open: false }, x, y);
```

Containers are widgets whose state is their arrangement, so a handler can restructure the UI at
runtime — `panel.add(chart)`, `await panel.removeChild(chart)`.

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
