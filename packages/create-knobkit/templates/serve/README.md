# __PROJECT_NAME__

A [knobkit](https://github.com/knobkit/knobkit) app whose handlers run on a **stateless Node server**
(`serve`) — the browser keeps all state and the server pulls only what each handler reads.

```bash
npm install
npm run dev      # start the dev server
npm run serve    # run the server app
```

Edit `demo.tsx` — declare widgets, register `app.on(event, handler)`, and the handlers run on the
server (good for large models, secrets, or native deps). The entry file is whatever `"main"` in
package.json points to, so rename it freely. Requires Node ≥ 22.
