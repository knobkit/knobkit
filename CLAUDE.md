# CLAUDE.md

Guidance for working in this repo. Pairs with [README.md](./README.md) (user-facing).

## What knobkit is

A widget + event framework. The **browser owns all state**; `on(event, handler)` handlers run either in
the browser (`mount`) or on a **stateless** Node server (`serve`) that pulls the state it reads on
demand and writes by sending structured edits. The same authored `demo.tsx` runs either tier — only the
final `mount()`/`serve()` call differs.

## Layout

Monorepo (pnpm): one package `packages/knobkit`, examples in `examples/*`.

```
packages/knobkit/src/
  lib/        isomorphic: knobkit.ts (authoring + handler registry + setup()), declare.ts (the decl),
              bound.ts (ambient context resolver + Bound: read/edit/enable/busy), ctx.ts (makeBound
              from transport fns), controls.ts (enable/disable/setEnabled/busy/busyStart/busyEnd),
              stream.ts (push -> AsyncGenerator), event.ts, on.ts, types.ts, widget.ts,
              widgets/*.ts (structure + read/edit methods)
  client/     browser: runtime.ts (the store), app.tsx (render), entry.tsx (serve bootstrap),
              mount.tsx, context.ts (browser ctx), widgets/<name>/index.tsx + .css (views),
              widgets/registry.tsx (type -> view)
  server/     node: serve.ts (http + socket.io), context.ts (AsyncLocalStorage ctx)
```

## Commands

```bash
pnpm -F knobkit build      # build:lib (tsc -> dist/lib) + build:client (vite -> dist/client.js/.css) + typecheck
pnpm -F knobkit test       # vitest
pnpm -F knobkit typecheck  # tsc --noEmit (whole src incl. tests)
pnpm typecheck         # all packages incl. examples
pnpm -F knobkit-example-<name> dev
```

`serve()` reads `dist/client.js` / `dist/client.css`, so run `build:client` before serving (and after
any client change — a stale bundle is a classic "it broke" cause). It also serves code-split chunks
from `dist/assets/*.js`, so client code **may use lazy `import()`** — a heavy widget (e.g. `code`'s
CodeMirror) loads only when rendered. ESM with `NodeNext`: imports use `.js` extensions even for
`.ts`/`.tsx` sources.

## State model

Widget state is **uniform structured JSON** — an attribute map per widget: `chat { messages }`,
`text { value }`, `mic { live }`, `audio { src }`, `button { label }`, `log { lines }`. No bespoke
per-widget state shapes. Reads and writes address an attribute by **path** (`["messages"]`,
`["messages", -1, "content"]` — `-1` is the last array element). Layout containers (`row`/`col`/`grid`,
`lib/widgets/layout.ts`) are widgets too — their state is `{ items }`, the keys of their children, so a
handler restructures the UI with the same edits as any other state (`panel.add(w)` appends to `items`).

## Architecture: a decl + a generic store

- **decl** (`lib/declare.ts`) is pure data: `{ widgets: [{ key, type, state, enabled, props, events }],
  root, serverEvents }`. Structure + wiring only. `serverEvents` = event types that have an `on(...)`
  handler. The authored `widgets` is a **tree of widget objects** (a single widget, an array = implicit
  `col`, or nested `row`/`col`/`grid`); `declare()` walks it, generates each widget's `key` (keys are an
  internal detail — never authored), and lowers a container's child objects to key refs in its `items`
  state. `root` is the key to render from; the browser recurses via the view `slot(key)` prop. `keyFor`
  (object→key) comes from the same deterministic walk, so handlers address widgets by object.
- **store** (`client/runtime.ts`) = the browser, owning one cell `{ state, enabled, busy }` per widget.
  `enabled` (persistent disable) and `busy` (transient working state) are orthogonal flags; **both** gate
  out the widget's input events. It has **no per-widget logic** — only generic operations:
  - `emit(type, payload)` — the local bus: drop the event if its owning widget is disabled **or busy**
    (the gate), else route to the transport if it has a handler.
  - `applyEdit(key, op, path, value)` — apply a structured edit (`set` / `append` / `appendText`) by path.
  - `setEnabled(key, value)`, `setBusy(key, value)`, `read(key, path)`.
  - per-key subscription: a change notifies only that key's listeners.

The only widget-specific client code is the **view** (`client/widgets/*`). Views render `state.<attr>`,
`emit` events, and `set(path, value)` their own state locally (e.g. a controlled input reflecting typing
— no round-trip).

## How one file runs on two tiers

Widget methods resolve their data through an **ambient context** (`lib/bound.ts` resolver →
`lib/ctx.ts` `makeBound`). The `Bound` is: `read(widget, path) → Promise` (pull one attribute),
`edit(widget, op, path, value)`, `enable(widget, value)`, `busy(widget, value)`. **Reads are async** —
getters like `history()` / `value()` / `all()` return Promises; handlers `await` them. Setters
(`say`/`append`/`set`/`push`) send edits.

**`setup(fn)`** (`knobkit.ts`) registers startup fns that run once per session inside a live context — in the
browser on `mount`, per connection on `serve` — so async startup (load weights, fetch user data) that
has no `bound()` at module scope happens there. Non-blocking: the page renders first. `serve()` injects
`knobkit({ loading })` HTML into `#root` (empty by default); mount apps own their `index.html`.

Wire protocol (serve):
- client → server: `request { type, payload }` — just the event, **no state**.
- server → client: `edit`, `enable`, `busy`, `emit` (re-emit a produced event), and `read` via socket
  **ack** (`socket.emitWithAck("read", { key, path })` → client answers `store.read(key, path)`).

- **serve** (`server/serve.ts` + `server/context.ts`): per `request`, run the handlers inside
  `AsyncLocalStorage.run(bound, …)` (concurrency-safe). `read` = `emitWithAck`; `edit`/`enable`/`busy`
  = `socket.emit`; a returned event = `socket.emit("emit", …)`. No server state. `setup` fns run once
  per connection in the same bound.
- **mount** (`client/mount.tsx` + `client/context.ts`): same store; the transport runs handlers
  in-process with a `Bound` whose `read` resolves from the local store and `edit`/`enable` apply to it.
  Context bound via a module global.

## Adding a widget

1. `lib/widgets/<x>.ts` — factory returning `{ type, state: { …attrs }, <events via event()>, <props>,
   ...controls, <methods> }`. Getters `read(this, path)` (async), setters `edit(this, op, path, value)`.
   Export from `lib/widgets/index.ts`.
2. `client/widgets/<x>/index.tsx` (+ `.css`) — a `WidgetView` that renders `state.<attr>`, `emit`s the
   widget's events, and `set`s its own state locally for inputs.
3. Register the type → view in `client/widgets/registry.tsx`.

## Gotchas

- `bound(this)` only resolves **inside a running handler**. Don't call widget methods at module scope.
- **Reads are async** (a real round-trip in serve): `await convo.history()`. A read reflects edits sent
  before it (socket order is preserved), but prefer read-then-write to avoid depending on that.
- The mount browser context is a module global → correct for one in-flight handler; overlapping async
  handlers would share it.
- `busy(fn)` marks a transient working span (its own flag, separate from `enabled`) which **drops the
  input events the widget emits** — like `enabled`, but shown as a loading bar and meant to be temporary.
  Good for `chat` (no re-send mid-generation); don't wrap a handler for a widget that drives its own
  state via its own events. `busyStart()`/`busyEnd()` bracket a span by hand (e.g. a `setup()` load).
- Event payloads cross the socket as JSON; the one binary case is mic PCM (`Float32Array`), which
  `serve.ts` restores from a `Buffer`. A `read` ack can be large (e.g. an uploaded image), so
  `maxHttpBufferSize` is lifted — that's for legitimate large reads, not a workaround.
- Rendering is **per-key** via `useSyncExternalStore` (`app.tsx` `Field`). No global "something changed"
  broadcast — don't add one.

## Conventions

- TypeScript strict, ESM, React 19 for views. Comments are sparse and explain **why** at non-obvious
  seams, not what — match the surrounding density.
- Examples only use the public authored API (`knobkit`, widget factories, `on`, widget methods,
  `mount`/`serve`). If a core change forces an example edit, the API surface probably regressed.
