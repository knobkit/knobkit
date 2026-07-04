# knobkit Architecture

knobkit is built around one constraint: **the browser owns all widget state**. Everything else follows
from that. A knobkit app is authored as widgets plus event handlers, then the same app can run in two
execution modes:

- `app.mount("#root")`: the browser owns state and runs handlers.
- `app.serve()`: the browser owns state, while a stateless Node process runs handlers.

The public authoring surface stays the same in both modes because handlers do not touch state
directly. They read through async widget methods, write through structured edits, and may return an
event to re-enter the event pipeline.

## System Shape

```text
author code
  widgets + handlers
      |
      v
Knobkit instance
  handler registry + setup callbacks
      |
      v
AppDecl
  serializable widget tree + event routing metadata
      |
      v
browser store
  cells: { state, enabled, busy }
      |
      v
React widget views
```

The server tier does not introduce another state store. In `serve()` mode the server receives events,
runs handlers, asks the browser for state when needed, and sends edit operations back to the browser.

## Authored App Model

Author code creates widget objects and passes them to `knobkit({ widgets })`.

```ts
const name = text({ placeholder: "Ada" });
const greet = button({ label: "Greet" });
const out = output();

const app = knobkit({ widgets: [name, greet, out] });

app.on(greet.clicked, async () => {
  out.set(`Hello, ${(await name.value()).trim() || "world"}!`);
});
```

Widget objects have three different kinds of information:

- declaration data: `type`, initial `state`, props, and event constructors;
- methods: async readers and structured writers implemented through `bound(this)`;
- optional child widgets for layout containers.

`Knobkit` stores the handler registry by event type and records setup callbacks. It does not store
runtime widget state.

## Declaration Pipeline

`lib/declare.ts` converts authored widgets into `AppDecl`, a serializable render description:

```ts
{
  title,
  description,
  widgets: [{ key, type, state, enabled, props, events }],
  root,
  serverEvents,
  theme,
  density,
  fill
}
```

Important properties of the declaration step:

- Widget keys are internal and deterministic for the declaration walk.
- Arrays are lowered to an implicit `col` container.
- Layout containers are ordinary widgets whose state is `{ items: childKeys }`.
- Function-valued event constructors become `events` metadata so the browser can rebuild emitters.
- Non-function widget fields become props.
- `serverEvents` records which event types have handlers.

The declaration is the boundary between authoring objects and browser rendering. The browser renders
from `AppDecl`; handlers still refer to original widget objects, and `Knobkit.keyFor(widget)` maps
those objects back to declaration keys.

## Browser Store

`client/runtime.ts` is the only runtime state store. It creates one cell per declared widget:

```ts
{
  state,
  enabled,
  busy
}
```

The store intentionally has no widget-specific logic. It implements only generic operations:

- `emit(type, payload)`: route an event through the transport if the event has a registered handler.
- `applyEdit(key, op, path, value)`: apply `set`, `append`, or `appendText` to a structured path.
- `setEnabled(key, value)`: update persistent input availability.
- `setBusy(key, value)`: update transient working state.
- `read(key, path)`: read a structured path.
- `subscribe(key, fn)`: notify only subscribers for the changed widget key.

The store also owns input gating. If the widget that emitted an event is disabled or busy, the event is
dropped before transport.

Paths are the shared read/write addressing model:

```ts
["value"]
["messages"]
["messages", -1, "content"] // -1 means last array element
```

This path model lets every widget use the same store and transport operations while still exposing
domain-specific methods such as `chat.append(token)` or `table.setCell(row, key, value)`.

## Rendering Model

`client/app.tsx` renders `AppDecl` using the browser store.

Each widget renders through `Field`, which:

- subscribes to exactly one widget key with `useSyncExternalStore`;
- rebuilds event constructors from declaration metadata;
- passes the current `cell.state`, `enabled`, `emit`, local `set`, and `slot` renderer to the widget
  view;
- applies shell state such as disabled, busy, density, theme, grid span, and grow.

`client/widgets/registry.tsx` is the only global mapping from widget `type` to React view. Views are
widget-specific, but the store and renderer around them are generic.

Views can call `set(path, value)` for immediate local state updates, such as controlled text input.
That local update still goes through the same store edit path; it just avoids a server round-trip for
interactive UI reflection.

## Handler Context

Widget methods do not close over a store. They resolve the current runtime through `bound(this)`.

`Bound` is the handler-time capability interface:

```ts
read(widget, path) -> Promise<T>
edit(widget, op, path, value)
enable(widget, value)
busy(widget, value)
key(widget)
```

`lib/ctx.ts` builds a `Bound` from lower-level transport functions and `Knobkit.keyFor(widget)`.

This indirection is what makes the same handler work in both tiers:

- in `mount()`, `read` resolves from the local browser store and edits apply directly to it;
- in `serve()`, `read` asks the browser over socket.io and edits are emitted back to the browser.

`bound(this)` is valid only while a handler or `setup()` callback is running. Calling widget methods at
module scope is an error because no runtime context exists yet.

## Mount Mode

`client/mount.tsx` runs entirely in the browser:

```text
user input
  -> store.emit(type, payload)
  -> local transport
  -> handler runs in browser Bound
  -> Bound edits local store
  -> subscribed widget views rerender
```

Returned events from handlers go back through `store.emit`, so produced events obey the same routing
and gating as user events.

Setup callbacks run after the initial render inside the browser `Bound`.

## Serve Mode

`server/serve.ts` serves the app declaration, browser client bundle, CSS, and any code-split assets.
`client/entry.tsx` boots the browser runtime by fetching `/api/decl`, opening the socket, creating the
store, and rendering the app.

Event flow in `serve()`:

```text
browser widget view
  -> store.emit(type, payload)
  -> socket request { type, payload }
  -> server handler runs in AsyncLocalStorage Bound
  -> read: socket ack asks browser store
  -> edit/enable/busy: socket message back to browser
  -> browser applies operation to store
  -> subscribed widget views rerender
```

The server never receives a state snapshot with the event request. It pulls only the paths a handler
reads. It also does not persist read results between requests. Each browser connection gets setup
callbacks run once in the same per-socket `Bound`.

Returned events are sent to the browser as `emit` messages. The browser then calls `store.emit`, so the
event re-enters the normal browser-owned event pipeline.

## Transport Contract

The transport boundary is intentionally small:

```text
browser -> server
  request { type, payload }

server -> browser
  edit { key, op, path, value }
  enable { key, value }
  busy { key, value }
  emit { type, payload }

server -> browser -> server
  read { key, path } with ack(value)
```

The only special payload handling is mic PCM in `serve.ts`: socket.io may deliver typed array data as
a `Buffer`, so the server restores it to `Float32Array` before invoking handlers.

## Architectural Invariants

These are the constraints that keep knobkit coherent:

- The browser is the only runtime owner of widget state.
- The server tier is stateless with respect to widgets and sessions.
- Handlers never receive or mutate store cells directly.
- Widget methods read and write through `Bound`.
- Reads are async in all authored code.
- State mutations cross boundaries as structured edits, not widget-specific commands.
- The browser store has no widget-specific logic.
- Rendering subscribes per widget key, not through a global rerender signal.
- Examples and generated apps use only the public authored API.

Breaking these invariants usually means the feature belongs in a widget method, view, or generic store
operation, not in an ad hoc path around the architecture.
