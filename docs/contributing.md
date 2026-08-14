# Contributing To knobkit

This document covers day-to-day maintenance of the knobkit repo. For the system design, see
[architecture.md](./architecture.md); for the condensed contributor reference (including the full
widget recipe), see [CLAUDE.md](../CLAUDE.md).

## Repository Layout

```text
packages/core/            @knobkit/core — the engine kernel (doc, edits, protocol, outbox,
                          dispatch, defineWidget, mount + serve runtimes)
packages/knobkit/         knobkit — built-in widgets, media helpers, and the knobkit CLI
packages/create-knobkit/  npm create knobkit scaffolder
examples/                 Example apps, one demo.tsx each
skills/knobkit/           Agent Skill and validated reference projects
docs/                     Architecture and contributing docs
design/                   Design assets
```

## Setup and Commands

Requires **Node ≥ 22** and pnpm.

```bash
pnpm install                # the install prepare step builds both packages' dist/
pnpm build                  # core (tsc + css copy), then knobkit (tsc + css + browser bundle)
pnpm test                   # core vitest + knobkit vitest (includes the token CSS rule)
pnpm typecheck              # all packages, including examples
pnpm -F knobkit-example-<name> dev
node skills/knobkit/references/verify.mjs   # install + typecheck the skill reference projects
```

## Build Notes

Everything is ESM with `NodeNext` resolution: imports use `.js` extensions even when the source file
is `.ts`/`.tsx`.

Inside vite, the CLI aliases both packages to `src/`, so example dev servers pick up source edits
without rebuilds. The **server side** of a serve app runs from `dist`, however — after editing kernel
or server code, rebuild core/knobkit before judging a serve app's behavior.

`serve()` in dev needs `KNOBKIT_DEV=1` (the CLI sets it). Without it, serve delivers `dist/client`
and errors at startup if `knobkit build` hasn't produced one.

## Adding A Widget

The full recipe with a complete `defineWidget` example lives in
[CLAUDE.md](../CLAUDE.md#adding-a-widget). The shape:

1. **One def artifact** — `packages/knobkit/src/widgets/<name>/def.ts`: a single `defineWidget` call
   declaring `state` (runtime-changing attrs), `props` (static config), typed `events` and
   `channels`, `ops` (structured-edit writers), `methods` (async readers over lenses), and
   `view: viewRef(import.meta.url, "./view.js")` — literally that shape; the CLI transform and the
   serve bundler both key off it.

2. **A view** — `view.tsx` next to it, default-exporting a React component over `ViewProps`
   (`{ id, props, state, emit, send, set, slot }` from `@knobkit/core/client`). Render from state,
   emit the widget's public events, use `set(path, value)` for local controlled-input reflection.

3. **CSS** — `<name>.css` next to the view, using **only `--pu-*` tokens** (test-enforced) for
   colors, spacing, typography, radii, and borders.

4. **Export** the factory from `packages/knobkit/src/index.ts`.

5. **Docs** — if the authored API changed, update `packages/knobkit/README.md`,
   `skills/knobkit/references/api.md`, and any affected skill reference project.

Views are always lazy chunks, so a heavy dependency is fine — it loads only when the widget renders.
Decide prop vs state by whether the value changes at runtime: `code`'s `language` is state (it has
`setLanguage`), `terminal({ echo })` is a prop the view honors locally.

Widgets aren't privileged: a third-party widget package depends only on `@knobkit/core`, namespaces
its type `"<pkg>/<name>"`, and has exactly the powers of the built-ins. `@knobkit/core` never imports
from `knobkit` (test-enforced).

## Theming Rules

Two token families in `packages/core/src/client/styles.css` (`@layer tokens`), applied via
document-root attributes:

- `data-theme`: `system`, `light`, `dark` (color)
- `data-density`: `xs`, `sm`, `md`, `lg`, `xl` (dimension)
- `data-fill`: full-bleed layout toggle

Authoring rides in `#app` state via `knobkit({ theme, density, fill })` and is runtime-editable;
serve pre-applies the attributes in the HTML so there is no flash of unstyled content. The attributes
inherit, so containers can scope them to subtrees.

Library-backed widgets still theme through CSS variables — CodeMirror and RevoGrid map their theme
surfaces to `--pu-*` tokens. JS-drawn colors (chart series) read tokens via `seriesPalette()` /
`cssVar()` plus `useThemeVersion()` from `@knobkit/core/client`.

## Common Pitfalls

- Do not call widget methods at module scope. They resolve the ambient `Bound`, which exists only
  inside a running handler or `setup()`. To write from outside a dispatch (fs watcher, long-lived
  timer), capture `bound()` in a setup and use `b.edit([idOf(w), …])`.
- Reads are async and batched; a read observes every write issued before it (the read barrier), so
  write-then-read is safe within a handler. There is no atomicity across handlers.
- Use `busy(fn)` only when dropping that widget's input while working is desired — and never wrap a
  handler for a widget that drives its own state via its own events. `busyStart()`/`busyEnd()`
  bracket by hand inside one dispatch.
- Don't hand-roll drop-if-busy guards for live streams — channel policies do the backpressure. The
  `latest` policy (mic, webcam) replaces unsent frames sender-side and skips frames arriving while
  the handler runs.
- Media bytes never ride in state, payloads, or reads — always `toMedia` / `mediaBytes` / `mediaUrl`.
- Do not add widget-specific logic to the core store or reducer; state mutation always goes through
  structured edits.
- Do not add a global rerender broadcast. Rendering is per instance id
  (`useSyncExternalStore` in `Field`), with notifications batched per animation frame.
- Keep examples on the public authored API. If an example needs internals or gets longer after a
  core change, the public API is missing something — fix the API, not the example.
