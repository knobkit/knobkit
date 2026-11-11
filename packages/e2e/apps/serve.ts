import type { App } from "knobkit";

// Server-mode entry: E2E_APP names the fixture this process serves.
const mod = (await import(`./${process.env["E2E_APP"]}.tsx`)) as { app: App };
await mod.app.serve();
