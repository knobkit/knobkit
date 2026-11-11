# Changes for hosting an agent harness

knobkit is to be the widget kit for an agent harness: a loop that calls a model, runs tools, and
waits for a person at some steps. This lists what knobkit needs for that, found by running one
journey (a developer asks for a code change, reviews the edit, corrects the agent while it works)
in both tiers and by reading the widget sources against two further journeys (cutting a video,
writing a researched report).

**How each item is known:** *ran* — it showed up when the journey was run; *read* — found in the
source, not run.

| # | Change | Known | Status |
|---|---|---|---|
| 1 | Build for an Electron window that has Node access | ran | open |
| 2 | Packaged Electron setup | read | open |
| 3 | Chat: tool calls in the conversation, with results | ran | done |
| 4 | Chat: accept / reject on a tool call, answering for that call | ran | done |
| 5 | Chat: message ids, so streamed text goes to a named message | read | done |
| 6 | Chat: a place for queued messages and errors | ran | done |
| 7 | Chat: input stays visible in a long conversation | ran | done |
| 8 | Layout: `grow()` in a column in a split pane collapses its child | ran | open |
| 9 | Video: report time, let the user mark a span | read | open |
| 10 | Clip list: picture, length, click event | read | open |
| 11 | Table: reorderable rows | read | open |
| 12 | Code: agent edits that keep the user's cursor | read | open |
| 13 | A document editor for prose | read | open |
| 14 | Tabs: add a labelled tab at runtime | read | open |
| 15 | A claim shown next to its source | read | open |
| 16 | Serve: listen on this machine only, refuse other origins | ran | open |
| 17 | Serve: tell server code when a session ends | ran | open |
| 18 | Serve: write to every open session from outside a handler | ran | open |
| 19 | Serve: start from code with options | ran | open |
| 20 | Merge the scopes branch | read | open |

## Running inside Electron

**1. Build for an Electron window that has Node access.** The agent reads files and runs
commands, so in a `mount` app it needs Node inside the window. `knobkit build` targets a plain
browser: Node built-ins are stubbed and `mountConfig` is not extensible (`configFile: false`). The
journey ran with a hand-written vite config that used `knobkit/vite`'s `viewRefTransform`, emitted
CommonJS, kept `node:*` and the model SDKs external, and loaded the bundle with `require` from a
page opened with `loadFile`. A CLI target (or an exported config) should produce this.

**2. Packaged Electron setup.** `examples/electron-chat` loads the page from `knobkit dev`. There
is no example of a built app loaded from files. Not tried.

## Chat

Done on this branch; see the `chat` entry in the README for the API.

**3. Tool calls in the conversation.** A message was `{ role, content, image? }`. Tool calls had
to go to a separate `log`.

**4. Accept / reject on a tool call.** The only option was two `button`s, whose `clicked` event
carries nothing, so a decision could not say which call it answered.

**5. Message ids.** `append(token)` writes to the last message. Anything said during a stream
would receive the tokens.

**6. Queued messages and errors.** A message typed while the agent works, and a failed model
call, had to be shown in a separate `output`.

**7. Input stays visible.** The chat grew with its content; in a pane the input was pushed below
the fold.

## Layout

**8. `grow()` in a column in a split pane collapses its child.** `[data-fill] .pu-layout-col >
.pu-field-grow` sets `flex: 1 1 0`. A `col` declares no vertical fill, so inside a split-pane
panel its root has no definite height and a child with basis 0 resolves to nothing. Observed with
`splitPane(col(grow(chat), output), …)`: the chat and a `diff` both rendered at zero height. A
`col` that is itself offered a definite height should pass it down.

## Video editing

**9. Video.** `video` renders `<video controls>` and has no events. Marking the part of a clip
that is wanted needs the current time and a way to set a start and an end.

**10. Clip list.** `gallery` shows images with captions and reports nothing. A set of clips needs
a picture, a length and a `selected` event per item.

**11. Reorderable rows.** `table` edits cells (`edited`); rows cannot be moved, inserted or
removed by the user. A plan of cuts is an ordered list the user rearranges.

## Research and writing

**12. Code: keep the user's cursor.** A programmatic `set` replaces the whole document
(`changes: { from: 0, to: cur.length }`). When the agent writes while the user edits, the
selection is lost. Edits should be applied as a minimal change.

**13. Prose editor.** `code` is a code editor. A draft report that the user and the agent both
change needs a markdown or rich-text editor.

**14. Tabs.** `tabs.add(child)` appends to `items` only; `labels`, `badges` and `closable` are
separate arrays, so a tab added at runtime is labelled "Tab N". Needed to show several agents at
once.

**15. Claim next to source.** No widget pairs a passage with the source it rests on.

## Serve tier (a harness that runs with no window open)

**16. Local only.** `server.listen(port)` binds every interface, and the WebSocket upgrade does
not check `Origin`. Observed: the page answered on the LAN address, and a socket with a foreign
`Origin` was accepted. An agent that edits files must not be reachable from the network or from
another site's page. Needs a `host` option defaulting to loopback, and an origin check.

**17. Session end.** A long-lived writer captures a `Bound` per session in `setup`. Nothing tells
it when the session is collected, so it keeps writing; each dead session buffers up to 8,192
frames. Observed: three sessions attached after two windows had closed.

**18. Writing to every session.** An agent loop runs outside any handler and must update every
open window. This needs `runBound`, which `knobkit` does not export (`@knobkit/core` does), and a
hand-kept set of sessions. A supported "for each session" writer would replace both.

**19. Start from code.** `serve()` reads `KNOBKIT_DEV`, `KNOBKIT_BUILD` and `KNOBKIT_VIEW_DEPS`,
resolves `dist/client` from `process.cwd()`, and calls `process.exit` in build mode. A shell that
launches harnesses needs these as options.

## Unmerged work

**20. Scopes branch** (`claude/cordis-knobkit-architecture-797526`, four commits, 2026-08-20):
per-session subscription registries, scopes whose disposal removes their handlers and widgets, a
`binder` for edits made outside a dispatch, and `Session.reload()`. It bears on 14, 17 and 18.
Read, not run.
