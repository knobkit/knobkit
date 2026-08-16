import { createRequire } from "node:module";

/**
 * Views are lazy chunks, so vite's dep scanner never sees the libraries they pull (recharts, xterm,
 * revo-grid, CodeMirror, markdown). Left undeclared they are discovered at render time, which forces
 * a re-bundle and a reload — and the re-bundle re-emits the shared react chunk, so a view rendering
 * across that swap gets a second React and throws "Invalid hook call".
 *
 * Declaring them up front keeps discovery to a single pass. They resolve through `knobkit` (vite's
 * nested-dependency syntax) because an app depends on knobkit, not on knobkit's dependencies.
 *
 * Derived by exclusion, so a *non-view* runtime dep added to knobkit's package.json lands here by
 * default and fails dev startup at esbuild — add it below when that happens.
 */
const NOT_VIEW_DEPS = new Set(["react", "react-dom", "@knobkit/core", "tsx", "vite"]);

const pkg = createRequire(import.meta.url)("knobkit/package.json") as { dependencies?: Record<string, string> };

export const VIEW_DEPS = Object.keys(pkg.dependencies ?? {})
  .filter((d) => !NOT_VIEW_DEPS.has(d))
  .map((d) => `knobkit > ${d}`);

/** The env a knobkit dev server needs; shared so the spawned child and the in-process playground agree. */
export function devEnv(): Record<string, string> {
  return { KNOBKIT_DEV: "1", KNOBKIT_VIEW_DEPS: VIEW_DEPS.join(",") };
}
