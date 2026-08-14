# CLAUDE.md

Guidance for working in this repo. Pairs with [README.md](./README.md) (user-facing).

## What knobkit is

A widget + event framework. The **browser owns all state** as one structured document; `on(event,
handler)` handlers run either in the browser (`mount`) or on a **stateless** Node server (`serve`)
that pulls the state it reads on demand and writes by sending structured edits. The same authored
`demo.tsx` runs either tier — only the final `mount()`/`serve()` call differs.

## Layout

Monorepo (pnpm): kernel `packages/core` (`@knobkit/core`), standard library `packages/knobkit` (`knobkit`),
examples in `examples/*`.

```
packages/core/src/          @knobkit/core — the kernel, isomorphic, dependency-free at runtime
  types.ts                  Doc/Instance/MediaRef/Path; ids: declared #0…#n, spawned #s<n>, root #app
  ops.ts, doc.ts, path.ts   Edit tuples, coalescing (set-absorption, append merge…), pure reducer
  codec.ts                  CBOR: TypedArrays (RFC 8746), undefined, Date; no base64 anywhere
  protocol.ts               frames {seq, ack, kind…}; Link = resume buffer/ack-prune/replay/dedup
  outbox.ts                 outbound scheduler: microtask flush-if-idle, 16ms pacing under streams,
                            channel policies buffer/latest/drop/throttle; flush() = the read barrier
  schema.ts                 Standard Schema v1 (type-only) + t<T>() phantom payload typing
  widget.ts                 defineWidget/Handle/registry/viewRef/instantiate/spawnTree
  lens.ts                   typed paths; get() = RYOW read, everything else = one op
  app.ts                    knobkit(): App (on/watch/setup/use/dispose), declare walk → initial Doc
  dispatch.ts               tier-shared engine: policies serial/concurrent/latest/queue, validation,
                            snapshots, gate → note{drop}, re-dispatch of returned events (same corr)
  context.ts                ambient Bound; browser = module slot, node = ALS (server/context.ts)
  modifiers.ts, media.ts    latest/queue/debounce/throttle; media store slot (toMedia/mediaBytes/…)
  client/                   store (rAF dirty-set notify), Field renderer, registry, mount runtime,
                            WS client (hello/welcome/resume), blob store, note overlay, styles.css
  server/                   serveApp: WS /__pu, session table (the only server state), heartbeat,
                            media LRU + /__media, vite dev middleware over a *generated* entry
packages/knobkit/src/       knobkit — the standard library; re-exports the core authoring surface
  widgets/<name>/           def.ts (defineWidget) + view.tsx (default export) + <name>.css
  media.ts                  knobkit/media: dataUrlToBytes, bytesToDataUrl, pcmToWav (+ core re-exports)
  cli/                      knobkit bin: dev/build/serve/playground, mount vite config,
                            view-transform.ts (viewRef → lazy import thunk), playground-app.ts
  browser.ts                knobkit/browser prebuilt (no-bundler runtime; serve() stubbed)
```

## Commands

```bash
pnpm build                  # core (tsc + css copy) then knobkit (tsc + css + browser bundle)
pnpm test                   # core vitest (67 tests) + knobkit vitest (token CSS rule)
pnpm typecheck              # all packages incl. examples
pnpm -F knobkit-example-<name> dev
```

Workspace dev needs `packages/core/dist` + `packages/knobkit/dist` built (install `prepare` does it);
the **CLI aliases both packages to `src/` inside vite**, so example dev picks up source edits without
rebuilds — but the *server side* of a serve app runs from `dist`, so rebuild core/knobkit after
editing kernel/server code. ESM with `NodeNext`: imports use `.js` extensions even for `.ts`/`.tsx`.

## State model

The client owns one **doc**: `instances: Map<Id, { type, props, state }>`. `#app` is an ordinary
instance (`state = { root, title, theme, … }` — runtime-editable). UI structure is state: containers
hold `state.items: Id[]`; dynamic UI = `instanceAdd` + an `items` edit (`panel.add(w)`).

Mutations are **Edit tuples** `[id, op, path, ...args]` with ops `set/append/appendN/appendText/
insert/removeAt/move/inc/patch/instanceAdd/instanceRemove`; `-1` = last array index. The reducer is
pure; the outbox coalesces adjacent edits (property-tested equivalent to the uncoalesced sequence).

Reserved attrs on every instance: `$enabled`, `$busy`. The **gate**: input events/channel frames from
a disabled-or-busy instance are dropped with an observable `note{level:"drop"}` (per-subscription
override `{ gate: false }`). Re-dispatched (handler-returned) events bypass the gate — that's what
lets `busy(fn)` spans chain across handlers sharing a corr.

**MediaRef** `{ $m, mime, size }`: bytes never live in state. `toMedia()` registers bytes in the
tier's store; refs cross the wire as data; bytes transfer lazily (server→client via GET /__media,
client→server via eager POST when a ref first crosses). The reducer refcounts refs entering/leaving
state; the client pins/unpins its blob store off that.

## Protocol & scheduling

One sequenced log per direction; every frame `{ seq, ack, … }`. Kinds: `event` (with optional
emit-time `snap`), `chan`, `edit`, `read`/`result`, `watch`, `note`, `sys` (hello/welcome/resume/
ping/pong). Sessions resume: the server buffers unacked frames, `hello{session, cursor}` replays the
tail; unknown/expired session → fresh `welcome{doc, subs}`; `setup()` runs once per **session**.
Heartbeat ping every 15s, close after 2 missed pongs. Session GC 5 min after disconnect.

Scheduler (both tiers): edits/chans queue and coalesce; singleton after idle flushes end-of-microtask,
streams pace to ~16ms so frames and React commits are **O(flushes), not O(tokens)**. Issuing a read
flushes the queue first (**read barrier**) — that's the read-your-own-writes invariant. The client
applies inbound edits immediately and notifies per-id subscribers once per animation frame.

Handler state access: `lens.get()` calls batch per microtask into one `read`; `on(…, { snap: [lens] })`
attaches emit-time snapshots (zero-RTT, consistent-at-emit reads); `app.watch(lens, handler)` makes
the client push watched-path changes back as C→S edit frames (throttleable).

## Adding a widget

One artifact: `src/widgets/<x>/def.ts` in the standard library (or any npm package — third-party types must be
namespaced `"<pkg>/<name>"`):

```ts
export const thing = defineWidget({
  type: "thing",
  state: { value: { initial: "" } },              // runtime-changing attrs (uniform seeding:
  props: { placeholder: { default: "" } },        //   thing({ value, placeholder }) both work)
  events: { changed: { payload: t<string>() } },  // or a Standard Schema for real validation
  channels: { clip: { policy: "latest", data: t<Float32Array>() } },
  ops: (at) => ({ set: at("value").op("set"), clear: at("value").op("set", "") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),    // literally this shape — the CLI transform and the
});                                               // serve bundler both key off it
```

`view.tsx` **default-exports** a React component over `ViewProps` (`@knobkit/core/client`):
`{ id, props, state, emit(name, payload), send(chan, data), set(path, v), slot(id) }`. `set` is a
local-only edit (transported only if watched). Export the factory from `src/index.ts`. CSS next to
the view, **only `--pu-*` tokens** (test-enforced; see Theming).

View delivery: serve builds a **generated entry** (one `register(type, () => import(<view path>))`
per registered def) via vite middleware (dev, `KNOBKIT_DEV=1`) or `knobkit build` → `dist/client`;
mount bundles the app itself and the CLI's `viewRef` transform makes view imports statically
analyzable. Views are always lazy chunks — heavy deps (CodeMirror, xterm, revo-grid, recharts,
markdown) load only when rendered; `chat` and `output` share one markdown chunk.

## Theming

Carried over verbatim from the old engine: two token families in `core/src/client/styles.css`
(`@layer tokens`) applied via document-root attributes — **color** `data-theme` (`system`/`light`/
`dark`, dark block duplicated for the media query + forced cases) and **dimension** `data-density`
(`xs…xl`), plus the `data-fill` full-bleed layout toggle. Authoring: `knobkit({ theme, density,
fill })` rides in `#app` state (serve pre-applies attrs in the HTML — no FOUC) and is runtime-editable.
JS-drawn colors (chart series) read tokens via `seriesPalette()`/`cssVar()` + `useThemeVersion()`
from `@knobkit/core/client`.

## Gotchas

- Widget methods and lenses resolve the ambient `Bound` **inside a running handler/setup** — module
  scope throws. To write from outside a dispatch (fs watcher, timer callback captured long-term),
  capture `bound()` in a setup and use `b.edit([idOf(w), …])` (see `cli/playground-app.ts`).
- **Reads are async** and batched; a read observes every write issued before it (read barrier), so
  write-then-read is safe within a handler. No atomicity across handlers.
- `busy(fn)` drops the widget's *input* while working (loading bar); handler-returned events bypass
  the gate and extend the span (same corr). Don't wrap a handler for a widget that drives its own
  state via its own events. `busyStart()/busyEnd()` bracket by hand inside one dispatch.
- Channel policies do the backpressure: `latest` (mic/webcam) replaces unsent frames sender-side AND
  skips frames arriving while the handler runs — no hand-rolled drop-if-busy guards.
- The mount browser context is a module slot set at dispatch start — exact on node (ALS), best-effort
  across interleaved awaits in the browser until AsyncContext ships.
- Media bytes never ride in state, payloads, or reads — always `toMedia`/`mediaBytes`/`mediaUrl`.
  The server media cache is a bounded LRU; a `mediaBytes` on a not-yet-POSTed ref waits for it.
- Rendering is per-id (`useSyncExternalStore` in `Field`); the store batches notifies per animation
  frame. No global "something changed" broadcast — don't add one.
- Widget config is a **prop** if static, **state** if runtime-changing: `code`'s `language` is state
  (`setLanguage`), `terminal({ echo })` is a prop the view honors locally.
- `serve()` in dev needs `KNOBKIT_DEV=1` (the CLI sets it); without it, it serves `dist/client` and
  errors at startup if `knobkit build` hasn't produced one.

## Conventions

- TypeScript strict, ESM, React 19 for views. Comments are sparse and explain **why** at non-obvious
  seams, not what — match the surrounding density.
- Examples only use the public authored API. If a core change makes an example longer or uglier,
  the API surface regressed; fix the API, not the example.
- `@knobkit/core` never imports from `knobkit` (test-enforced). Built-in widgets use only the public
  core API — a third-party widget package has exactly the same powers.
