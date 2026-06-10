# __PROJECT_NAME__

A [knobkit](https://github.com/knobkit/knobkit) app that runs **entirely in the browser** (`mount`).

```bash
npm install
npm run dev      # start the dev server
npm run build    # build a static app to dist/
```

Edit `demo.tsx` — declare widgets, register `app.on(event, handler)`, and the handlers run
client-side. The entry file is whatever `"main"` in package.json points to, so rename it freely.
Requires Node ≥ 22.
