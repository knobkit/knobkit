---
name: knobkit
description: >
  Build a runnable knobkit app fast — scaffold the project, choose the mount (browser) vs serve
  (Node) tier, then author a complete demo.tsx by adapting a real, typecheck-validated reference
  project. Use when the user says "build a knobkit app", "make a knobkit demo/chat/transcriber",
  "scaffold a knobkit app", "add a knobkit UI", "I want a widget app", or describes an interactive
  AI/ML web app to stand up quickly (chatbot, image describer, form→table→chart, live transcription,
  webcam filter). Triggers even when "knobkit" isn't named but the app shape matches.
---

# Build a knobkit app

<purpose>
Get the user from "I want an app that does X" to a complete, runnable knobkit `demo.tsx` quickly and
correctly. The win condition is a real app: the right widgets declared, handlers wired with the actual
authoring API, the correct tier chosen, and the commands to run it — not isolated snippets.
</purpose>

<core_principle>
**One file, two tiers. The browser owns all state.** A knobkit app is widgets + `on(event, handler)`
functions. The same `demo.tsx` runs in the browser (`app.mount("#root")`) or on a stateless Node
server (`app.serve()`) — only the last line differs. Handlers never hold state: they **read** widget
attributes with async getters (`await box.value()`), **write** with structured setters (`out.set(v)`,
`convo.say(m)`), and **produce** by returning an event.

**Author by adapting a reference project, not from memory.** `references/projects/` holds complete,
typecheck-validated knobkit apps. Find the one closest to the request, read it, and adapt it — its
shape (declare → `knobkit({...})` → `on(...)` → `mount`/`serve`), its `package.json`, and its
`tsconfig.json` are all correct by construction. The exact API surface is in `references/api.md`; when
a signature is still unclear, the source of truth is the factory at
`node_modules/knobkit/src/lib/widgets/<name>.ts` (the package ships its source).
Inside the knobkit monorepo, read `packages/knobkit/src/lib/widgets/<name>.ts` instead.
</core_principle>

<reference_projects dir="references/projects">
Each is a real app — `demo.tsx` + `package.json` + `tsconfig.json` — kept honest by
`references/verify.mjs` (`node verify.mjs` installs each + `tsc --noEmit` against knobkit). Read the
ONE closest to the request and adapt it; copy it wholesale to start a new project.

  <project name="hello-mount" tier="mount" use="minimal app — a value input + button + output; the 'quick simple app'" />
  <project name="chat-local" tier="mount" use="chatbot with a small local model in the browser; streaming replies; markdown rendering" />
  <project name="caption-serve" tier="serve" use="upload an image; a server-side model processes it → output" />
  <project name="form-table-chart" tier="mount" use="a form whose entries accumulate into a table + chart, with a derived column recomputed each submit" />
  <project name="live-meeting" tier="serve" use="continuous mic clips → a running transcript (log) + a chat analyst that reads the transcript as context" />
  <project name="webcam-live" tier="mount" use="continuous webcam frames → per-frame processing → image; shows the frame-drop guard for live streams" />
</reference_projects>

<process>

<step name="understand">
**Pin down what the app does — inputs, outputs, and where the work runs.**

Ask only what you can't infer. Cover, conversationally (one or two questions, not a form):

- **What does it do?** The core interaction — "chat with a local model", "upload an image → caption",
  "enter rows → plot a chart", "transcribe the mic live".
- **Inputs and outputs?** Maps to widgets and to a reference project (see `<reference_projects>`).
- **What runs the work?** A local browser model (WebGPU via transformers.js), a server-side model, an
  API needing a secret, or pure compute. This drives the tier.

If the request is already clear, go straight on. Don't over-interview — this skill is for building fast.

▶ Next: `choose_tier`
</step>

<step name="choose_tier">
**Choose mount (browser) or serve (Node) — it's the only line that changes.**

| Pick | `app.mount("#root")` | `app.serve()` |
|------|----------------------|---------------|
| Handlers run | in the browser | on a stateless Node server |
| Reach for it when | everything fits client-side: WebGPU models, no secrets, ships as static files | the handler needs the server: large models, API keys/secrets, native deps, heavy CPU |
| Build/run | `knobkit dev`, `knobkit build` (static `dist/`) | `knobkit dev`, `knobkit serve` |

Default to **mount** for self-contained demos and in-browser ML; choose **serve** the moment a handler
needs a secret, a native dependency, or a model too big for the browser. State lives in the browser
**either way**. If unsure, pick mount (faster loop, and one line moves it to serve later) and say so.

▶ Next: `scaffold`
</step>

<step name="scaffold">
**Create the project — by copying the nearest reference, or the official scaffolder.**

Pick the closest entry from `<reference_projects>` for the chosen tier. Then either:

- **Copy the reference project** as the starting point — `demo.tsx` + `package.json` +
  `tsconfig.json` are a complete, valid scaffold; you'll adapt `demo.tsx` next. (Rename the package in
  `package.json`.) Drop deps the app won't use.
- **Or run the official scaffolder** for a blank start: `npm create knobkit@latest <dir> -- --mount`
  (or `--serve`).

The non-negotiables either way: `package.json` `main` points at the entry, `tsconfig.json` extends
`knobkit/tsconfig.base.json`, and the entry ends in `mount("#root")` or `serve()`.

If the user is **already in a knobkit project** (a `demo.tsx` + a `knobkit` dependency exist), don't
scaffold — edit the existing entry, using the nearest reference as the guide.

▶ Next: `author`
</step>

<step name="author">
**Adapt the reference project's demo.tsx to the user's app.**

Read the chosen reference project's `demo.tsx` and `references/api.md`, then shape the four parts:

1. **Declare widgets** at module scope — `const box = text({ placeholder: "…" }); const out = output();`
2. **Compose** — `knobkit({ title, description, widgets })`. `widgets` is a tree: a single widget, an
   array (implicit `col`), or `row`/`col`/`grid`/`tabs`/`accordion` nesting. Add `fill: true` for a
   full-bleed split-pane/dashboard layout.
3. **Wire handlers** — `app.on(go.clicked, async () => { … })` or `app.on(box.changed, async (value) => { … })`
   (value inputs emit `changed`; the payload **is** the value). `await` reads, call setters to write,
   `return` an event to produce one. Wrap with `widget.busy(handler)` for spans that shouldn't accept
   input mid-work (e.g. chat generation).
4. **Pick the tier** — end with `app.mount("#root")` or `app.serve()`.

Keep the reference's proven idioms: model loads via a module-scope `const model = await pipeline(...)`
(inferred type — never annotate a pipeline, the union is too complex), streaming via `say` + `append`,
and a frame/clip **drop guard** for live streams (see `webcam-live`).

▶ Next: `run`
</step>

<step name="run">
**Install, typecheck, and run — confirm it actually works.**

```bash
cd <dir> && npm install
npm run typecheck     # catches API misuse before runtime — run this
npm run dev           # mount: opens a dev server; serve: runs the Node server
```

`knobkit dev` auto-detects the tier from whether the entry ends in `mount()` or `serve()`. For a
production mount build, `npm run build` emits static files to `dist/`.

Run `typecheck` and report honestly — if it fails, fix the handler (usually a missing `await` on a
read or a wrong method name) and rerun. Then give the user the dev URL / command and a one-line summary
of what the app does and how to interact with it.

▶ Next: `offer_playground`
</step>

<step name="offer_playground">
**Offer the live editor-and-preview REPL for fast refinement — don't force it.**

`knobkit playground` runs the app's dev server and wraps it in an editor (left) +
live preview (right), on **either tier**. A file picker switches between the project's source files;
edits save to disk and the preview updates, and they round-trip — when **you** (the agent) edit a file,
the change shows up in the open editor too. Ideal for the tweak → see → refine loop.

After the app runs, ask the user whether they want a live editor + preview to refine the app
interactively (offer the choice however your harness asks the user — a prompt or a structured
question). If yes, run `knobkit playground` (`--port <n>` changes the default 4317); otherwise keep
`knobkit dev`.

It's an **option, not the default** — for headless/CI or users who prefer their own editor, plain
`knobkit dev` is right. If `knobkit playground` is unavailable, fall back to `knobkit dev`.

▶ Done.
</step>

</process>

<rules>
Getting these wrong produces a broken app:
- **Reads are async** — `const v = await box.value();`, never `box.value()` without `await`. Same for
  `history()`, `data()`, `all()`.
- **Widget methods only run inside a handler or `setup`** — declaring widgets at module scope is fine;
  *calling their methods* there is not (`bound()` only resolves in a live context).
- **Value inputs emit only `changed`**, and the payload IS the value (no `.submitted` / `.uploaded`).
  Drive one-shot actions from a `button`'s `.clicked` + `await input.value()`.
- **`mount("#root")` needs the selector**; `serve()` takes none.
- **Live streams need a drop guard** — a `processing` flag that ignores frames/clips arriving faster
  than the handler can keep up (see `webcam-live`).
- **transformers.js**: pin `@huggingface/transformers@^3.5.1` and use the `pipeline()` API (not
  version-specific model classes) — that's what typechecks and what the reference projects use.
</rules>

<guardrails>
- NEVER invent widget types, factory options, or methods. The catalog is in `references/api.md`; the
  source of truth is the factory at `packages/knobkit/src/lib/widgets/<name>.ts` in the knobkit repo,
  or `node_modules/knobkit/src/lib/widgets/<name>.ts` inside a generated app. Verify before relying on
  a signature.
- NEVER call a widget method at module scope — only inside a handler or `setup`.
- NEVER add server-side state — handlers are stateless; the browser owns all state on both tiers.
- Examples must use only the public authored API (`knobkit`, widget factories, `on`, widget methods,
  `mount`/`serve`). Reaching for an internal means the approach is wrong.
- Don't over-interview, and don't synthesize an app from memory when a reference project covers the
  shape — adapt the reference.
- If the request doesn't fit a widget+event app, say so and explain what knobkit handles.
</guardrails>

<success_criteria>
- [ ] The app's interaction, inputs, and outputs are understood (asked only what couldn't be inferred)
- [ ] A tier (mount vs serve) is chosen with a reason tied to where the work runs
- [ ] The nearest reference project was used as the scaffold/guide
- [ ] A project exists with a valid `package.json` entry and a `tsconfig.json` extending the base
- [ ] `demo.tsx` declares real widgets, composes `knobkit({...})`, wires `on(...)`, and ends in the
      chosen `mount`/`serve` call
- [ ] Handlers use async reads, structured-edit writes, and `busy`/drop-guards where apt
- [ ] No fabricated widgets/methods; uncertain signatures verified against the factories
- [ ] `typecheck` passes (or failures are reported and fixed), and the user is told how to run it
</success_criteria>
