# Contributing To knobkit

This document covers day-to-day maintenance of the knobkit repo. For the system design, see
[architecture.md](./architecture.md).

## Repository Layout

```text
packages/knobkit/
  src/lib/      Public authoring API, widget factories, declaration, handler context
  src/client/   Browser store, React renderer, widget views, mount runtime
  src/server/   Stateless Node serve runtime
  src/cli/      knobkit dev/build/serve/playground commands

packages/create-knobkit/  npm create knobkit scaffolder
examples/                 Example apps
skills/knobkit/            Agent Skill and validated reference projects
design/                   Design assets and mockups
```

## Commands

```bash
pnpm install
pnpm -F knobkit typecheck
pnpm -F knobkit test
pnpm -F knobkit build
pnpm typecheck
pnpm verify:skill
```

`pnpm -F knobkit build` runs the library build, both browser builds, and package typecheck. Use it
before validating changes that affect the distributed package or serve runtime.

`pnpm verify:skill` installs and typechecks the Agent Skill reference projects under
`skills/knobkit/references/projects`.

## Build Notes

The package uses ESM with NodeNext resolution. Source imports use `.js` extensions even when importing
TypeScript source files.

`build:client` runs Vite twice:

- `client/entry.tsx` -> `dist/client.js` and `dist/client.css` for `app.serve()`.
- `client/browser.ts` -> `dist/knobkit.browser.js` and `dist/knobkit.browser.css` for the
  `knobkit/browser` no-bundler runtime.

`app.serve()` reads `dist/client.js` and `dist/client.css`. If client code changes and you run a built
serve app directly, rebuild the client bundle first. Code-split chunks are served from
`dist/assets/*.js`, so heavy client widgets may use lazy `import()`.

## Adding A Widget

1. Add `packages/knobkit/src/lib/widgets/<name>.ts`.

   The factory should return a widget object with:

   ```ts
   {
     type,
     state,
     eventConstructors,
     nonFunctionProps,
     ...controls,
     methods
   }
   ```

   The names above describe the roles, not literal property names: event constructors are fields like
   `clicked` or `changed`, and declaration props are ordinary non-function fields such as `accept`,
   `multiple`, or `markdown`.

   Getters must call `bound(this).read(...)`; setters must call `bound(this).edit(...)`.

2. Export the widget from `packages/knobkit/src/lib/widgets/index.ts`.

3. Add the view at `packages/knobkit/src/client/widgets/<name>/index.tsx`.

   The view receives `state`, `enabled`, `emit`, `set`, and `slot`. It should render from state, emit
   public widget events, and use `set(path, value)` for local controlled-input reflection.

4. Add CSS only if needed.

   Widget CSS should use `--pu-*` tokens for colors, spacing, typography, radii, and borders. Avoid
   hard-coded visual values unless the widget genuinely needs a non-token value.

5. Register the view in `packages/knobkit/src/client/widgets/registry.tsx`.

6. Add tests.

   Use focused tests for widget methods, event behavior, local state updates, server behavior, or any
   interaction with `busy`, `enabled`, layout, or theming.

7. Update public docs and skill references if the authored API changed.

   Check:

   - `packages/knobkit/README.md`
   - `skills/knobkit/references/api.md`
   - relevant skill reference projects

## Theming Rules

The root theme axes are:

- `data-theme`: `system`, `light`, `dark`
- `data-density`: `xs`, `sm`, `md`, `lg`, `xl`
- `data-fill`: full-viewport app shell

Theme and density attributes inherit, so layout containers can scope them to subtrees. Use
`theme(widget, mode)` and `density(widget, level)` for scoped authored overrides.

Library-backed widgets should still theme through CSS variables. CodeMirror and RevoGrid should map
their theme surfaces to `--pu-*` tokens. JS-drawn colors, such as chart series, should read tokens via
`packages/knobkit/src/client/theme.ts`.

## Playground Notes

`knobkit playground` is implemented as a knobkit serve app, not as a separate editor framework.

`src/cli/playground.ts` starts the target app on a preview port, sets environment variables for the
playground app, then imports `playground-app.ts`.

`src/cli/playground-app.ts` renders:

- a `code` editor;
- an optional file picker;
- a `frame` pointed at the target app;
- a `fill: true` split layout.

Editor changes are debounced and written to disk. External file changes are watched and pushed back
into the editor through a captured `Bound`. Serve-tier previews are reloaded by briefly clearing and
restoring the frame source.

## Common Pitfalls

- Do not call widget methods at module scope. They require a live handler or `setup()` context.
- Always await reads such as `value()`, `history()`, `data()`, `files()`, and `all()`.
- Do not add server-side widget state. In serve mode, the server asks the browser for state.
- Do not add widget-specific logic to `client/runtime.ts`.
- Do not bypass structured edits for state mutation.
- Do not add a global rerender broadcast. Rendering is per widget key.
- Use `busy(fn)` only when dropping that widget's duplicate input events is desired.
- Keep examples on the public API. If an example needs internals, the public API is probably missing
  something.
