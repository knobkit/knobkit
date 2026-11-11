import type { App } from "knobkit";

// Browser-only entry for every fixture: ?app=<name> picks one. Each fixture is its own chunk.
const apps = import.meta.glob<{ app: App }>("./t*.tsx");
const name = new URLSearchParams(location.search).get("app");
const load = apps[`./${name}.tsx`];
if (!load) document.body.textContent = `no fixture "${name}"`;
else void load().then((m) => m.app.mount("#root"));
