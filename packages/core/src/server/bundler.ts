import { fileURLToPath } from "node:url";
import { allWidgetDefs } from "../widget.js";

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

export async function createViteDev(): Promise<DevMiddleware> {
  const { createServer, searchForWorkspaceRoot } = await import("vite");
  const vite = await createServer({
    appType: "custom",
    server: {
      middlewareMode: true,
      fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
    },
    resolve: { dedupe: ["react", "react-dom"] },
    optimizeDeps: { entries: [] },
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
