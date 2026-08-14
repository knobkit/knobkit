# knobkit Authoring API Reference

The public authored surface, imported from `"knobkit"`. This is what app code uses — nothing else.
This catalog is hand-written (not typecheck-validated like `projects/`), so when a signature is
uncertain the source of truth is the widget def at `packages/knobkit/src/widgets/<name>/def.ts` in the
knobkit repo, or `node_modules/knobkit/src/widgets/<name>/def.ts` inside a generated app (the package
ships its source) — read it. The complex nested data shapes are summarized here; the def has the
exact types.

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
`.serve({ port?, quiet? })`.

### `knobkit({ … })` config

| Option | Type | Meaning |
|--------|------|---------|
| `widgets` | widget tree (required) | a single widget, an array (implicit `col`), or `row`/`col`/`grid`/`tabs`/`splitPane`/`drawer`/`accordion` nesting |
| `title` | string | app heading |
| `description` | string | sub-heading under the title |
| `theme` | `"system" \| "light" \| "dark"` | color theme (default `system`); flip at runtime with `setTheme` |
| `density` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | spacing/size scale (default `md`); flip with `setDensity` |
| `fill` | boolean | full-bleed app shell that fills the viewport (for split panes / dashboards); default false |

## How handlers touch state

Handlers hold no state. They do exactly three things:

| Action | How | Example |
|--------|-----|---------|
| **read** | `await` an async getter — a real round-trip on serve | `await box.value()`, `await convo.history()`, `await grid.data()` |
| **write** | call a structured-edit setter | `out.set(text)`, `convo.say(msg)`, `convo.append(token)`, `logw.push(line)`, `grid.setRows(rows)` |
| **produce** | `return` an event from the handler | `return other.clicked()` — re-emitted like a user action |

A read observes every write issued before it (the read barrier), so write-then-read is safe within a
handler.

Streams (mic clips, webcam frames) arrive on **channels**, handled with the same `on(...)`; the
`latest` policy drops stale frames automatically while a handler is busy — no hand-rolled
drop-if-busy guards.

## Media

Binary data (images, audio) travels as a **MediaRef** — an opaque handle; the bytes stay out of app
state and cross the wire lazily.

- `toMedia(bytes, mime)` → `MediaRef` — register bytes, get a handle.
- `await mediaBytes(ref)` → the bytes back (a `Uint8Array`).
- `mediaUrl(ref)` → a URL a view or `<img>`/`Image` can load.
- `knobkit/media` adds `dataUrlToBytes`, `bytesToDataUrl`, `pcmToWav`.

Typical decode on the handler side: `new Blob([await mediaBytes(ref)], { type: ref.mime })`.

## Inputs

**Value inputs share one shape**: a single `changed` event whose **payload is the value itself** (not
an object), plus `await w.value()` and `w.set(v)`. There is **no** `.submitted` event — listen on
`changed`, or drive an action from a `button`'s `.clicked` and read `await input.value()`.

| Factory (defaults) | `changed` payload | Notes |
|--------------------|-------------------|-------|
| `text({ placeholder?, lines? })` | `string` (init `""`) | `lines` = textarea rows (default 1) |
| `number({ value?, min?, max?, step? })` | `number` (init `0`) | numeric stepper |
| `dropdown({ choices, value? })` | `string` | `choices: (string \| { value, label? })[]`; `value` defaults to the first choice |

Inputs with their own shape:

| Factory (defaults) | Events / channels | Methods / notes |
|--------------------|-------------------|-----------------|
| `button({ label })` | `clicked` (no payload) | |
| `upload({ label?, accept?, multiple? })` | `picked` (`MediaRef`, per file), `changed` (`UploadFile[]`) | `await value()` → the first file's `MediaRef` or `null`; `await files()` → `UploadFile[] { name, type, size, ref }`; `clear()` empties. Decode with `mediaBytes`/`mediaUrl` |
| `mic({ every?, control?, hold? })` | `clip` channel (`Float32Array`, 16 kHz mono PCM), `toggled` | `start()`, `stop()`, `await toggle()`, `await live()`. `every` ms emits a clip every N ms (0 = one clip per recording) |
| `webcam({ every?, preview? })` | `frame` channel (`MediaRef`, JPEG) | `start()`, `stop()`. `every` ms emits a frame every N ms (**0 = preview only, no frames**) |
| `chat({ placeholder?, voice?, images?, markdown? })` | `sent` (`{ text, image? }` — `image` a `MediaRef`), `recorded` channel (`Float32Array`) | `await history()` → `Message[]`; `say(msg)` appends a whole message; `append(token)` streams into the last message; `clear()`. `markdown: true` renders **assistant** replies as markdown; `images`/`voice` add the attach (+) / hold-to-talk buttons |

`Message = { role: "user" | "assistant" | "system"; content: string; image? }`.

## Outputs

All are write-only (no read getter unless noted).

| Factory (defaults) | Write / methods | Notes |
|--------------------|-----------------|-------|
| `output({ format? })` | `set(text)`, `append(text)`, `clear()` | `format: "markdown"` renders GFM; `append` streams tokens |
| `log({ maxLines? })` | `push(line)`, `pushStyled(line, level?)`, `setFilter(q)`, `clear()`, `await all()` | append-only lines; levels (`info`/`warn`/`error`/`debug`) color-code |
| `image()` | `show(srcOrRef)`, `clear()` | a `MediaRef` or URL |
| `audio({ autoplay? })` | `set(srcOrRef)` | a `MediaRef` or URL |
| `frame({ src? })` | `set(url)` | iframe |
| `chart({ x, y, kind?, data? })` | `setData(rows)` | `x` = category-axis key; `y` = one series key or `string[]` for several; `kind` `"bar"`/`"line"`/`"area"` (default bar); rows are `Record<string, unknown>` |
| `diff()` | `setFiles(files)` | `FileDiff: { path, oldContent, newContent, language?, status? }` |
| `statusBadge(status?, { variants? })` | `set(status)` | dot + label; `variants` maps custom statuses to idle/running/waiting/completed/failed/error |
| `toast()` | `show(message, variant?)` | transient notifications; `variant` info/success/warning/error |

## Editable or read-only (both)

| Factory (defaults) | Events | Read / write / methods |
|--------------------|--------|------------------------|
| `code({ value?, language?, readOnly? })` | `changed` (string) | syntax-highlighted CodeMirror. `await value()`, `set(src)`, `setLanguage(lang)` (switches grammar at runtime). `language` e.g. `"tsx"`, `"python"`, `"json"`, `"markdown"` |
| `table({ columns?, rows?, editable?, maxHeight? })` | `edited` (`{ row, key, value }`) | RevoGrid. `Column: { key, label?, type?, width? }`; rows are `Record<string, unknown>`. `await data()`, `setRows(rows)`, `setColumns(cols)`, `addRow(row)`, `setCell(row, key, value)` |
| `terminal({ rows?, cols?, scrollback?, echo? })` | `data` (string), `resized` | xterm. `write(text)`, `writeln(line)`, `clear()`. `echo` echoes typed input locally |

## Navigation

| Factory (defaults) | Events | Methods |
|--------------------|--------|---------|
| `toolbar(items?)` | `clicked` (`{ id }`) | `setItems(items)`. `ToolbarItem: { id, label, icon?, disabled?, variant?, separator? }` |
| `tree(nodes \| { nodes?, expanded?, selected? })` | `selected`/`activated` (`{ id, data? }`), `expanded`/`collapsed`, `contextmenu` (`{ id, x, y }`), `renamed` (`{ id, name }`) | `setNodes`, `setChildren(id, nodes)`, `expand(id)`, `collapse(id)`, `select(id)`, `rename(id)`. `TreeNode: { id, label, icon?, children?, hasChildren?, data? }` |
| `breadcrumb({ crumbs? })` | `selected` (`{ id }`) | `set(crumbs)`. `Crumb: { id, label }` |
| `menu()` | `selected` (`{ action, target }`) | `open({ x, y, items, target? })`, `close()` — a context menu; pair with `tree`/`table` `contextmenu` events. `MenuItem: { id, label, icon?, danger?, disabled?, separator? }` |
| `sidebar(sections?)` | `selected` (`{ id }`) | `setSections(sections)`. Section: `{ label, items: { id, label, icon?, badge? }[] }` |

## Layout

Containers are widgets too — `widgets` is a tree of widget objects (no keys/strings):

```ts
[a, b]                       // implicit col
col(a, b, c)                 // vertical stack
row(a, b)                    // horizontal
grid([a, b, c, d], { cols: 2 })
tabs([{ label: "One", content: a }, { label: "Two", content: b }])
splitPane(editor, preview, { direction: "horizontal", ratio: 0.5 })
drawer(nav, main, { open: true })   // collapsible side panel + main pane
accordion({ label: "Advanced", open: false }, x, y)
```

A container's state is its arrangement, so a handler can restructure the UI at runtime:
`panel.add(chart)` appends a child, `await panel.removeChild(chart)` removes one.

Slot modifiers tune one child in place: `span(w, 2)` claims extra grid/row slots, `grow(w)`
absorbs a `col`'s leftover space, `density(w, "sm")` / `theme(w, "dark")` restyle that subtree.

## setup, busy, enable

- **`app.setup(async () => { … })`** — runs once per session (browser on mount, per session on serve)
  inside a live context, so widget methods work. For async startup (load weights, fetch data); the
  page renders first. Bracket long loads with `w.busyStart()` / `w.busyEnd()`. (Heavy model
  *constants* are often loaded at module scope with top-level `await` instead — see `caption-serve`.)
- **`widget.busy(handler)`** — wraps an async handler in a transient "working" span: a thin bar, and
  the widget **drops its input events** while busy. Ideal for `chat` (no re-send mid-generation).
- **`widget.disable()` / `.enable()`** — the persistent (dimmed) version; also gates input events.

Widget methods only work inside a handler or `setup` — never at module scope.

## Project files (manual scaffold; the reference projects are complete copies of this)

`package.json`:
```json
{
  "name": "my-app", "private": true, "type": "module", "main": "demo.tsx",
  "scripts": { "dev": "knobkit dev", "build": "knobkit build", "typecheck": "tsc --noEmit" },
  "dependencies": { "knobkit": "^0.1.0" },
  "devDependencies": { "typescript": "^6.0.3" }
}
```
For a serve app, swap the `build` script for `"serve": "knobkit serve"`. Requires **Node ≥ 22**.

`tsconfig.json`: `{ "extends": "knobkit/tsconfig.base.json", "include": ["**/*.ts", "**/*.tsx"] }`

The entry file's last line (`mount("#root")` vs `serve()`) is what `knobkit dev` uses to pick the tier.
