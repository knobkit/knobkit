# knobkit

[![npm version](https://img.shields.io/npm/v/knobkit.svg)](https://www.npmjs.com/package/knobkit) [![license](https://img.shields.io/npm/l/knobkit.svg)](./LICENSE)

Build a web app from **widgets** and **event handlers**. You declare the widgets, register
`on(event, handler)` handlers, and choose where they run: entirely in the browser (`mount`) or on a
stateless server with a thin browser client (`serve`). The same authored file works either way.

```ts
import { knobkit, chat } from "knobkit";

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

app.serve();
```

The same file runs either tier — swap the last line for `app.mount("#root")` to run entirely in the
browser. For a real model-backed chatbot (streaming, history), see [`examples/`](./examples).

## Quick start

Scaffold a new app:

```bash
npm create knobkit@latest my-app   # choose mount (browser) or serve (node)
cd my-app
npm install
npm run dev
```

Skip the prompts with `npm create knobkit@latest my-app -- --mount` (or `--serve`). Already have a
project? `npm install knobkit`. Requires Node ≥ 22.

## CLI

The `knobkit` package installs a `knobkit` command:

```bash
knobkit dev [file]     # dev server — auto-detects mount vs serve (file defaults to demo.tsx)
knobkit build [file]   # build a browser (mount) app to dist/
knobkit serve [file]   # run a server (serve) app
```

Flags: `--mount` / `--serve` force a mode, `--port <n>` sets the dev-server port. Otherwise `knobkit dev`
detects the tier from whether your `demo.tsx` ends in `mount()` or `serve()`.

## Concepts

- **Widgets** hold structured state and render themselves. Handlers interact through widget methods:
  - **read** with async getters — `await convo.history()`, `await box.value()` — pulled from the browser.
  - **write** with structured edits — `convo.say(m)`, `convo.append(token)`, `out.set(v)`, `log.push(line)`.
  - **produce** by `return`ing an event from a handler (it's re-emitted, like a user action).
- **Events** are plain serializable `{ type, payload }`. `widget.sent("hi")` builds one.
- **`on(event, handler)`** registers a handler against a widget's event (`convo.sent`, `go.clicked`).
- **`setup(fn)`** runs once per session — in the browser on `mount`, per connection on `serve` — with a
  live context, so async startup (load model weights, fetch a user's data) that has no context at module
  scope happens here. The page renders first; setup is non-blocking.
- **`busy`** marks a transient working span on a widget — `widget.busy(handler)` wraps an async handler,
  or `widget.busyStart()`/`busyEnd()` bracket one by hand (e.g. a `setup()` load). The widget shows a
  thin indeterminate bar and drops its input events while busy. `disable()`/`enable()` is the persistent
  version (dimmed).
- **`mount` vs `serve`** is the only thing that changes between in-browser and client/server — the
  widgets, handlers, and methods are identical.

## The two runtimes

| | `mount("#root")` | `serve()` |
|---|---|---|
| State | in the browser | in the browser |
| `on(...)` handlers | run in the browser | run on a stateless Node server |
| Transport | local function call | socket.io |
| Use when | everything fits client-side (incl. webgpu models) | the handler needs the server (large models, secrets, native deps) |

In both, **the browser owns all state.** A request carries only the event (`{ type, payload }`) — never
a copy of state. A served handler **pulls just the attributes it reads** from the browser on demand and
**writes by sending structured edits**; it keeps no state of its own. So a value a handler never reads
(say, generated audio) never crosses to the server.

## Widgets

Inputs: `text`, `number`, `slider`, `dropdown`, `checkbox`, `checkboxGroup`, `radio`, `upload`, `mic`,
`webcam`, `chat`, `button`.
Outputs: `output` (plain text or `format: "markdown"`), `json`, `log`, `label`, `html`, `image`,
`gallery`, `annotatedImage` (boxes/labels over an image), `highlightedText` (spans over text), `audio`,
`video`, `file` (download), `progress`, `chart` (bar/line/area), `frame` (embed a URL or a sandboxed
HTML document in an isolated iframe).
Both (editable or read-only): `code` (syntax-highlighted editor/viewer), `table` (data grid).
Custom: `widget({ state, … })`.

## Layout

`widgets` is the widget tree. An array is a vertical stack; `row`, `col`, and `grid` are containers
that nest other widgets — composed with the widget objects themselves, no keys or strings:

```ts
import { knobkit, upload, dropdown, button, output, row, col } from "knobkit";

knobkit({ widgets: col(photo, row(size, go), caption) });
knobkit({ widgets: grid([a, b, c, d], { cols: 2 }) });
```

`tabs` and `accordion` are containers too — `tabs([{ label, content }, …])`,
`accordion({ label, open }, …children)`. Containers are themselves widgets whose state is their
arrangement, so a handler can restructure the UI at runtime — `panel.add(chart)`, `panel.remove(sidebar)`.

## Examples

In [`examples/`](./examples) — each is a single `demo.tsx`. Run one with `pnpm -F knobkit-example-<name> dev`.

[`examples/playground`](./examples/playground) is an in-browser playground: a `code` editor on the
right runs live as a mounted knobkit app on the left, with a `dropdown` of built-in examples — itself a knobkit
app built from `code`/`dropdown`/layout. Run it with `pnpm -F knobkit-example-playground dev`.

## Develop

Requires Node ≥ 22 and pnpm.

```bash
pnpm install
pnpm -F knobkit build     # build the library + browser client bundle
pnpm -F knobkit test      # vitest
pnpm typecheck        # all packages
```

See [CLAUDE.md](./CLAUDE.md) for the architecture and how to add a widget.
