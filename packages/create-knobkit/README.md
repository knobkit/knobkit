# create-knobkit

Scaffold a new [knobkit](https://github.com/knobkit/knobkit) app.

```bash
npm create knobkit@latest my-app
# or: pnpm create knobkit my-app
# or: yarn create knobkit my-app
```

You'll be asked for a directory and a runtime:

- **mount** — runs entirely in the browser (state + handlers client-side).
- **serve** — handlers run on a stateless Node server; the browser keeps all state.

Then:

```bash
cd my-app
npm install
npm run dev
```

### Non-interactive

```bash
npm create knobkit@latest my-app -- --serve --yes
```

| Flag | Effect |
|---|---|
| `--mount` | Browser runtime |
| `--serve` | Node-server runtime |
| `-y`, `--yes` | Accept defaults, no prompts |

Requires Node ≥ 22 to run the generated app.
