# knobkit Architecture

knobkit is built around one constraint: **the browser owns all widget state**. Everything else follows
from that. A knobkit app is authored as widgets plus event handlers, then the same app can run in two
execution tiers:

- `app.mount("#root")`: the browser owns state and runs handlers.
- `app.serve()`: the browser owns state, while a stateless Node process runs handlers.

The public authoring surface stays the same in both tiers because handlers do not touch state
directly. They read through async widget methods, write by sending structured edits, and may return an
event to re-enter the event pipeline.

## System Shape

```text
author code
  demo.tsx: widgets + on(event, handler)
      |
      v
App
  subscriptions + watches + setup callbacks
      |
      v
declare walk
  widget tree -> initial Doc (serializable)
      |
      v
browser doc
  instances: Map<Id, { type, props, state }>
      |
      v
React widget views (per-id subscriptions)
```

The server tier does not introduce another state store. In `serve()` the server receives events over a
WebSocket, runs handlers, pulls the state a handler reads on demand, and sends structured edits back
to the browser. The only state the server keeps is the session table (resume buffers), never app data.

## Packages

The repo splits into a kernel and a standard library:

- **`@knobkit/core`** — the engine: the document model, edits and reducer, codec, protocol, outbox,
  dispatch, `defineWidget`, the mount runtime, and the serve runtime. Isomorphic and dependency-free
  at runtime.
- **`knobkit`** — batteries: the built-in widgets (each a `def.ts` + `view.tsx` pair), media helpers,
  and the `knobkit` CLI (`dev`/`build`/`serve`/`playground`). It re-exports the core authoring
  surface, so app code imports everything from `"knobkit"`.

Built-in widgets use only the public core API — `@knobkit/core` never imports from `knobkit` (this is
test-enforced). A third-party widget package has exactly the same powers as the built-ins: it depends
on `@knobkit/core`, namespaces its widget type `"<pkg>/<name>"`, and its views load the same way.

## Authored App Model

Author code creates widget objects and passes them to `knobkit({ widgets })`:

```ts
const name = text({ placeholder: "Ada" });
const greet = button({ label: "Greet" });
const out = output();

const app = knobkit({ widgets: col(name, greet, out) });

app.on(greet.clicked, async () => {
  out.set(`Hello, ${(await name.value()).trim() || "world"}!`);
});
```

`knobkit()` returns an `App` that records subscriptions (`on`), watches (`watch`), and `setup`
callbacks. It holds no runtime widget state. At mount/serve time a declare walk converts the widget
tree into the initial **Doc** — the serializable document the browser will own.

## State Model

The browser owns one **doc**: `instances: Map<Id, { type, props, state }>`. Declared widgets get ids
`#0…#n`, runtime-spawned instances get `#s<n>`, and the app shell itself is the ordinary instance
`#app` (its state holds `root`, `title`, `theme`, and so on — all runtime-editable).

UI structure is state: layout containers hold `state.items: Id[]`. Dynamic UI is therefore just data —
adding a widget at runtime is an `instanceAdd` plus an edit to a container's `items` (that's what
`panel.add(w)` does).

Every instance also carries two reserved attrs, `$enabled` and `$busy`, which feed the input gate
(below).

## Edits and the Reducer

All mutation crosses boundaries as **Edit tuples** `[id, op, path, ...args]` with the op set
`set / append / appendN / appendText / insert / removeAt / move / inc / patch / instanceAdd /
instanceRemove`; `-1` in a path means the last array index. Paths are the shared addressing model:

```ts
["value"]
["messages", -1, "content"]   // stream a token into the last message
```

The reducer that applies edits is pure. Before edits go out, the outbox coalesces adjacent ones
(set-absorption, append merging, …) — a transformation property-tested to be equivalent to applying
the uncoalesced sequence. This path + op model lets every widget share one store and one transport
while still exposing domain-specific methods such as `chat.append(token)` or
`table.setCell(row, key, value)`.

## Protocol

Serve runs over one WebSocket (`/__pu`) carrying one sequenced log per direction; every frame is
`{ seq, ack, kind, … }`. Frame kinds:

- `event` — a dispatched event, with optional emit-time `snap` state snapshots;
- `chan` — a channel frame (mic PCM, webcam frames, …);
- `edit` — structured edits;
- `read` / `result` — on-demand state reads;
- `watch` — watched-path change pushes;
- `note` — observable diagnostics (including gate drops);
- `sys` — `hello` / `welcome` / `resume` / `ping` / `pong`.

Frames are encoded as CBOR: TypedArrays ride natively (RFC 8746), `undefined` and `Date` round-trip,
and nothing is ever base64-encoded.

Sessions resume. The server buffers unacked frames per session; on reconnect the client sends
`hello{session, cursor}` and the server replays the tail (acks prune the buffer, dedup handles
replays). An unknown or expired session gets a fresh `welcome{doc, subs}`. `setup()` runs once per
**session**, not per socket. Heartbeat pings every 15s; the connection closes after two missed pongs,
and sessions are collected 5 minutes after disconnect.

## Scheduling

Both tiers share one outbound scheduler (the **outbox**). Edits and channel frames queue and coalesce;
a singleton write after idle flushes at end-of-microtask, while sustained streams pace flushes to
~16ms. The result is that wire frames and React commits are **O(flushes), not O(tokens)** — streaming
a thousand tokens into a chat message costs a handful of frames, not a thousand.

Channel sends carry per-channel backpressure policies — `buffer`, `latest`, `drop`, `throttle`. The
`latest` policy (mic, webcam) replaces unsent frames on the sender side *and* skips frames that arrive
while the handler is still running, so live streams need no hand-rolled drop-if-busy guards.

Issuing a read flushes the outbox first — the **read barrier**. That is the read-your-own-writes
invariant: a read observes every write issued before it, so write-then-read is always safe within a
handler. (There is no atomicity across handlers.)

On the inbound side, the client applies edits immediately and notifies per-id subscribers once per
animation frame.

## Dispatch

Event dispatch is one tier-shared engine. Per-subscription policies control concurrency:

- `serial` — one at a time, in order;
- `concurrent` — run as they arrive;
- `latest` — a new event supersedes a running handler's queue;
- `queue` — strict FIFO.

Dispatch validates payloads (Standard Schema v1 when a real schema is given), attaches emit-time
snapshots requested via `on(…, { snap: [lens] })`, and enforces the **gate**: input events and channel
frames from an instance that is disabled or busy (`$enabled` / `$busy`) are dropped with an observable
`note{level:"drop"}` (subscriptions can opt out with `{ gate: false }`).

Handlers may return an event; it is re-dispatched under the same correlation id and **bypasses the
gate**. That is what lets `busy(fn)` spans chain across handlers: the widget drops outside input while
busy, but its own returned events keep flowing.

## Handler Context

Widget methods and lenses do not close over a store. They resolve the ambient **Bound** — the
handler-time capability that knows which doc to read and where to send edits. On Node it is exact
(AsyncLocalStorage); in the browser it is a module slot set at dispatch start, best-effort across
interleaved awaits until AsyncContext ships.

`bound()` only resolves inside a running handler or `setup()` — calling widget methods at module scope
throws. Code that must write from outside a dispatch (an fs watcher, a long-lived timer) captures
`bound()` during setup and uses it explicitly.

Reads are async and batched: `lens.get()` calls within a microtask collapse into one `read` frame. Two
mechanisms avoid read round-trips entirely: `on(…, { snap: [lens] })` attaches consistent-at-emit
snapshots to the event, and `app.watch(lens, handler)` makes the client push watched-path changes to
the server as edit frames (throttleable).

## MediaRef

Binary payloads never live in state. `toMedia(bytes, mime)` registers bytes in the current tier's
media store and returns a **MediaRef** `{ $m, mime, size }` — an opaque handle that crosses the wire
as plain data. Bytes transfer lazily: server→client via `GET /__media` when a view needs them,
client→server via an eager POST when a ref first crosses. The reducer refcounts refs entering and
leaving state; the client pins and unpins its blob store off that count. The server media cache is a
bounded LRU, and `mediaBytes()` on a not-yet-transferred ref waits for the bytes.

## Widgets and Views

A widget is one `defineWidget` artifact — state attrs, props, typed events and channels, structured-
edit ops, async methods — plus a React view:

```ts
export const thing = defineWidget({
  type: "thing",
  state: { value: { initial: "" } },
  props: { placeholder: { default: "" } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
```

The view default-exports a component over `ViewProps`: `{ id, props, state, emit, send, set, slot }`.
`set(path, v)` is a local-only edit for controlled-input reflection — it is transported only if the
path is watched.

**View delivery** differs by tier but always produces lazy chunks:

- `serve` builds a generated entry — one `register(type, () => import(<view path>))` per registered
  widget — through vite middleware in dev or `knobkit build` → `dist/client` for production.
- `mount` bundles the app itself; the CLI's `viewRef` transform rewrites view references into
  statically analyzable lazy imports.

Because views are lazy chunks, heavy dependencies (CodeMirror, xterm, revo-grid, recharts, markdown)
load only when a widget of that type actually renders.

## Rendering

Each instance renders through `Field`, which subscribes to exactly one id with
`useSyncExternalStore`, passes the instance's props and state to the widget view, and applies shell
concerns (disabled, busy, theme, density). The store batches notifications per animation frame. There
is no global "something changed" broadcast — rendering is per-id by design.

## Architectural Invariants

These are the constraints that keep knobkit coherent:

- The browser is the only runtime owner of widget state; the server keeps only session resume state.
- Handlers never receive or mutate the doc directly — reads are async, writes are Edit tuples.
- The reducer is pure; coalescing is equivalence-preserving.
- A read observes every write issued before it (the read barrier).
- Media bytes never ride in state, payloads, or reads — always MediaRefs.
- Rendering subscribes per instance id, never through a global rerender signal.
- `@knobkit/core` never imports from `knobkit`; built-in widgets use only the public core API.
- Examples use only the public authored API, and each stays within its line-count baseline — if a
  core change makes an example longer or uglier, the API regressed.

Breaking these invariants usually means the feature belongs in a widget def, a view, or a generic
core operation, not in an ad hoc path around the architecture.
