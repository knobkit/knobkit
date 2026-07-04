# knobkit Authoring API Reference

The public authored surface, imported from `"knobkit"`. This is what app code uses — nothing else.
This catalog is hand-written (not typecheck-validated like `projects/`), so when a signature is
uncertain the source of truth is the factory at `packages/knobkit/src/lib/widgets/<name>.ts` in the
knobkit repo, or `node_modules/knobkit/src/lib/widgets/<name>.ts` inside a generated app — read it.
The complex nested data shapes are summarized here; the factory has the exact types.

## The shape of every app

```ts
import { knobkit, /* widget factories */, row, col } from "knobkit";

// 1. declare widgets at module scope
const box = text({ placeholder: "…" });
const out = output();

// 2. compose the app (widgets is a tree; an array is an implicit col)
const app = knobkit({ title: "My app", description: "What it does.", widgets: col(box, out) });

// 3. wire handlers — read (await), write (setters), or return an event to produce one
app.on(box.changed, async (value) => {   // value inputs emit `changed`; the payload IS the value
  out.set(value.toUpperCase());
});

// 4. choose the tier (the only line that changes between browser and server)
app.mount("#root");   // browser   — OR —   app.serve();   // stateless Node
```

`knobkit(config)` returns an app with `.on(event, handler)`, `.setup(fn)`, `.mount(selector)`, and
`.serve({ port?, quiet? })`. A standalone `on` is also exported, equivalent to `app.on`.

### `knobkit({ … })` config

| Option | Type | Meaning |
|--------|------|---------|
| `widgets` | widget tree (required) | a single widget, an array (implicit `col`), or `row`/`col`/`grid`/`tabs`/`accordion` nesting |
| `title` | string | app heading |
| `description` | string | sub-heading under the title |
| `theme` | `"system" \| "light" \| "dark"` | color theme (default `system`) |
| `density` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | spacing/size scale (default `md`) |
| `fill` | boolean | full-bleed app shell that fills the viewport (for split panes / dashboards); default false |
| `loading` | string | raw HTML placed in `#root` before mount, for `serve()` only |

## How handlers touch state

Handlers hold no state. They do exactly three things:

| Action | How | Example |
|--------|-----|---------|
| **read** | `await` an async getter — a real round-trip on serve | `await box.value()`, `await convo.history()`, `await grid.data()` |
| **write** | call a structured-edit setter | `out.set(text)`, `convo.say(msg)`, `convo.append(token)`, `log.push(line)`, `grid.setRows(rows)` |
| **produce** | `return` an event from the handler | `return other.clicked()` — re-emitted like a user action |

Reads reflect edits sent before them (socket order is preserved), but prefer read-then-write to avoid
depending on ordering.

## Inputs

**Value inputs share one shape.** `text`, `number`, `slider`, `dropdown`, `checkbox`, `checkboxGroup`,
and `radio` have a single `changed` event whose **payload is the value itself** (not an object), plus
`await w.value()` and `w.set(v)`. `upload` is the file-input variant: `changed` emits the selected
`UploadFile[]`, `await upload.value()` returns the first file or `null`, and `await upload.files()`
returns all files. There is **no** `.submitted` / `.uploaded` event — listen on `changed`, or drive an
action from a `button`'s `.clicked` and read `await input.value()`.

| Factory (defaults) | `changed` payload | Notes |
|--------------------|-------------------|-------|
| `text({ placeholder?, lines? })` | `string` (init `""`) | `lines` = textarea rows (default 1) |
| `number({ value?, min?, max? })` | `number` (init `0`) | numeric stepper |
| `slider({ value?, min?, max?, step? })` | `number` | `min` 0, `max` 100, `step` 1, `value` defaults to `min` |
| `dropdown({ choices, value? })` | `string` | `choices: string[]` (required); `value` defaults to `choices[0]` |
| `checkbox({ label?, value? })` | `boolean` (init `false`) | a single toggle |
| `checkboxGroup({ choices, value? })` | `string[]` (init `[]`) | multi-select from `choices` |
| `radio({ choices, value? })` | `string` | single-select; `value` defaults to `choices[0]` |
| `upload({ accept?, multiple? })` | `UploadFile[]` (init `[]`) | `UploadFile = { name, type, size, url }`; `url` is a data URL. `value()` returns the first file or `null`; `files()` returns all; `set(files)` replaces; `clear()` empties. `accept` default `"*/*"`, `multiple` default `false` |

Inputs with their own shape:

| Factory (defaults) | Events | Read / Write / methods |
|--------------------|--------|------------------------|
| `button({ label })` | `clicked` (no payload) | `set({ label })` to relabel |
| `mic({ every?, control?, hold? })` | `clip` (Float32Array PCM), `toggled` (boolean) | `every` ms = emit a clip every N ms (0 = only on hold/toggle); `control` shows the built-in button (default true); `hold` = push-to-talk (default true). Methods: `start()`, `stop()`, `await toggle()`, `await live()` |
| `webcam({ every?, control?, preview?, facing? })` | `frame` (string data URL), `toggled` (boolean) | `every` ms = emit a frame every N ms (**0 = preview only, no frames**); `preview` shows the video (default true); `facing` `"user"`/`"environment"`. Methods: `start()`, `stop()`, `await toggle()`, `await live()` |
| `chat({ placeholder?, voice?, images?, markdown? })` | `sent` (`{ text, image? }`), `recorded` (Float32Array) | `await chat.history()` → `Message[]`; `chat.say(msg)` appends a whole message; `chat.append(token)` streams into the last message. `markdown: true` renders **assistant** replies as markdown (user text stays literal); `images`/`voice` add the attach (+) / hold-to-talk buttons |

`Message = { role: "user" | "assistant" | "system"; content: string; image? }`.

## Outputs

All are write-only (no read getter unless noted). `set(...)` replaces the displayed value.

| Factory (defaults) | `set(...)` / methods | Notes |
|--------------------|----------------------|-------|
| `output({ format? })` | `set(text: string)` | `format: "markdown"` renders GFM; default plain text |
| `json()` | `set(value: unknown)` | pretty-printed JSON |
| `log()` | `push(line)`, `await all()` | append-only lines; `all()` reads the array |
| `label()` | `set(string \| { label?, confidences? })` | classifier result; `confidences: { label, score }[]` (0..1) renders bars; top score becomes the headline |
| `html({ value? })` | `set(markup: string)` | raw HTML escape hatch |
| `image()` | `set(urlOrDataUrl: string)` | one image |
| `gallery()` | `set(items)`, `add(item)` | `item: { src, caption? }` — a grid of images |
| `audio({ autoplay? })` | `set(src: string)` | URL or data URL |
| `video({ autoplay?, loop? })` | `set(src: string)` | URL or data URL |
| `progress({ label? })` | `set(value: number, label?)` | `value` is a 0..1 fraction |
| `file()` | `set({ name?, url } \| url)` | offer a download; name defaults to the URL's last segment |
| `annotatedImage()` | `set(src, annotations?, colorMap?)` | detection/segmentation overlay. `Annotation = { label, box?: [xmin,ymin,xmax,ymax], mask? }` (box in natural-size px); `colorMap?: Record<label,color>` |
| `highlightedText()` | `set(spans, colorMap?)` | NER/diff. `HighlightSpan = { text, label? }` (label null/omitted = plain run); `colorMap?` pins label colors |
| `chart({ x, y, kind?, data? })` | `await data()`, `setData(rows)`, `push(point)` | `x` = category-axis key; `y` = one series key or `string[]` for several; `kind` `"bar"`/`"line"`/`"area"` (default bar); rows are `Record<string, unknown>` |
| `frame({ src?, doc?, sandbox?, title? })` | `load(url)`, `show(doc)`, `clear()` | iframe; `load` a URL or `show` a sandboxed HTML doc string; event `loaded` |

## Editable or read-only (both)

| Factory (defaults) | Events | Read / Write / methods |
|--------------------|--------|------------------------|
| `code({ value?, language?, editable?, wrap? })` | `changed` (string) | syntax-highlighted CodeMirror. `editable: false` = read-only viewer; `wrap: true` soft-wraps. `await code.value()`, `code.set(src)`, `code.setLanguage(lang)` (switches grammar at runtime — `language` is state). `language` e.g. `"tsx"`, `"python"`, `"css"`, `"json"`, `"markdown"` |
| `table({ columns?, rows?, editable? })` | `edited` (`{ row, key, value }`) | RevoGrid. `Column = { key, label?, type?: "text"\|"number", width? }`; rows are `Record<string, unknown>`. `editable: false` by default (display table). `await data()`, `await columnsOf()`, `setRows(rows)`, `setColumns(cols)`, `addRow(row)`, `setCell(row, key, value)` |

## Layout

Containers are widgets too. Pass them to `widgets:`.

```ts
[a, b]                       // implicit col
col(a, b, c)                 // vertical stack
row(a, b)                    // horizontal
grid([a, b, c, d], { cols: 2 })
tabs([{ label: "One", content: a }, { label: "Two", content: b }])
accordion({ label: "Advanced", open: false }, x, y)
```

A container's state is its child keys, so a handler can restructure the UI at runtime: `panel.add(w)`
appends a child, `await panel.remove(w)` removes one. `embed(otherApp)` nests a whole knobkit app as
a widget.

## setup, busy, enable

- **`app.setup(async () => { … })`** — runs once per session (browser on mount, per connection on
  serve) inside a live context, so widget methods work. For async startup (load weights, fetch data);
  the page renders first. Bracket long loads with `w.busyStart()` / `w.busyEnd()`. (Heavy model
  *constants* are often loaded at module scope with top-level `await` instead — see `chat-local`.)
- **`widget.busy(handler)`** — wraps an async handler in a transient "working" span: a thin bar, and
  the widget **drops its input events** while busy. Ideal for `chat` (no re-send mid-generation).
- **`widget.disable()` / `.enable()` / `.setEnabled(bool)`** — the persistent (dimmed) version; also
  gates input events.

## Project files (manual scaffold; the reference projects are complete copies of this)

`package.json`:
```json
{
  "name": "my-app", "private": true, "type": "module", "main": "demo.tsx",
  "scripts": { "dev": "knobkit dev", "build": "knobkit build", "typecheck": "tsc --noEmit" },
  "dependencies": { "knobkit": "^0.0.8" },
  "devDependencies": { "typescript": "^6.0.3" }
}
```
For a serve app, swap the `build` script for `"serve": "knobkit serve"`.

`tsconfig.json`: `{ "extends": "knobkit/tsconfig.base.json", "include": ["**/*.ts", "**/*.tsx"] }`

The entry file's last line (`mount("#root")` vs `serve()`) is what `knobkit dev` uses to pick the tier.
