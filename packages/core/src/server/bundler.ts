import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_PATH } from "../protocol.js";
import { allWidgetDefs } from "../widget.js";

/** Two Reacts in one page is an immediate "Invalid hook call" — collapse them to the app's copy. */
export const REACT_DEDUPE = ["react", "react-dom"];

/**
 * React is CJS-only, so vite's dep optimizer is what gives it working named exports in dev. Both
 * tiers keep the widget packages out of the scanner's reach (mount excludes them so viewRefTransform
 * sees the defs; serve renders from a generated entry), and vite's rule for that case is explicit:
 * "If an ESM dependency is excluded from optimization, but has a nested CommonJS dependency, the
 * CommonJS dependency should be added to optimizeDeps.include."
 * https://vite.dev/config/dep-optimization-options
 *
 * These resolve from the app root — apps declare react/react-dom alongside knobkit, which also
 * gives `dedupe` an unambiguous target when an app pulls its own react.
 *
 * Shared with the mount tier, which imports them from `@knobkit/core/server` — safe only because the
 * CLI is Node-only and never bundled. The `browser` condition on that subpath resolves to
 * `server/stub.ts`, so anything bundling this for the browser would silently get `undefined`.
 */
export const REACT_DEPS = [...REACT_DEDUPE, "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"];

/**
 * Where vite's HMR websocket lives when it rides the app's http server. Off the default "/" so the
 * serve upgrade handler can route by path, the same way it routes WS_PATH, instead of sniffing
 * vite's private subprotocol names. Client and server both derive it by joining `base` with this.
 */
export const HMR_PATH = "/__hmr";

export const VIRTUAL_ENTRY = "virtual:knobkit-entry";
const RESOLVED_ENTRY = "\0knobkit-entry";

export function generateEntrySource(): string {
  // absolute path: the app's node_modules may not expose @knobkit/core directly (pnpm strictness) —
  // resolve our own client subpath relative to this module instead
  const clientPath = fileURLToPath(new URL("../client/index.js", import.meta.url));
  const lines = [`import { register, boot } from ${JSON.stringify(clientPath)};`];
  for (const [type, def] of allWidgetDefs()) {
    if (!def.view) continue;
    const path = def.view.load
      ? null // load thunks are for in-browser realms; the generated entry needs a path
      : fileURLToPath(new URL(def.view.specifier, def.view.base));
    if (path) lines.push(`register(${JSON.stringify(type)}, () => import(${JSON.stringify(path)}));`);
  }
  lines.push("boot();");
  return lines.join("\n");
}

export function entryPlugin() {
  return {
    name: "knobkit-entry",
    resolveId(source: string) {
      if (source === VIRTUAL_ENTRY || source === "/entry.js" || source === "/__app/entry.js") return RESOLVED_ENTRY;
      return null;
    },
    load(id: string) {
      if (id === RESOLVED_ENTRY) return generateEntrySource();
      return null;
    },
  };
}

export interface DevMiddleware {
  handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse): void;
  transformHtml(url: string, html: string): Promise<string>;
  close(): Promise<void>;
}

export interface ViteDevOptions {
  /** The app root — vite's fs allowlist and dep cache hang off it. */
  root: string;
  /**
   * The app's http server. In middleware mode vite has none of its own to carry HMR, and left to
   * itself it opens a standalone websocket on a fixed port (24678) — which collides when two knobkit
   * servers share a dev session (the playground runs the app under edit alongside its own UI) and is
   * a second port to forward in containers and remote dev. Riding the app's server avoids both.
   */
  server: import("node:http").Server;
  /** Distinguishes this server's dep cache from any other knobkit server over the same app root. */
  port: number;
  /** Lazily-imported view libraries to prebundle, in vite's `<pkg> > <dep>` form. See REACT_DEPS. */
  viewDeps: string[];
}

export async function createViteDev({ root, server, port, viewDeps }: ViteDevOptions): Promise<DevMiddleware> {
  const { createServer, searchForWorkspaceRoot } = await import("vite");
  const vite = await createServer({
    appType: "custom",
    server: {
      middlewareMode: true,
      fs: { allow: [searchForWorkspaceRoot(root)] },
      hmr: { server, path: HMR_PATH },
    },
    // one dep cache per server: two knobkit servers can share an app root (the playground runs the
    // app under edit alongside its own UI) and whether by differing config or by discovering a dep
    // the other hasn't, either one re-optimizing over a shared node_modules/.vite serves the other's
    // views 504 Outdated Optimize Dep. The http port is the one id that is unique per server and
    // stable across restarts, so the cache stays warm.
    cacheDir: resolve(root, "node_modules/.vite", `knobkit-${port}`),
    resolve: { dedupe: REACT_DEDUPE },
    optimizeDeps: { entries: [], include: [...REACT_DEPS, ...viewDeps] }, // see REACT_DEPS
    plugins: [entryPlugin()],
  });
  return {
    handle: (req, res) => vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end("Not found");
    }),
    transformHtml: (url, html) => vite.transformIndexHtml(url, html),
    close: () => vite.close(),
  };
}

/** Build the serve-tier client bundle (CLI `knobkit build`, serve mode). */
export async function buildServeClient(outDir: string): Promise<void> {
  const { build } = await import("vite");
  await build({
    // the server mounts this bundle under APP_PATH; without a matching base vite emits
    // preload URLs rooted at "/" that 404 (the imports themselves still resolve, relative
    // to the entry chunk — so it "works" while logging a 404 per chunk on every load)
    base: `${APP_PATH}/`,
    plugins: [entryPlugin()],
    build: {
      outDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        input: VIRTUAL_ENTRY,
        output: {
          entryFileNames: "entry.js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: (info) =>
            info.names?.some((n) => n.endsWith(".css")) ? "style.css" : "assets/[name]-[hash][extname]",
        },
      },
    },
  });
}
