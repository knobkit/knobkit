import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { searchForWorkspaceRoot, type InlineConfig, type Plugin } from "vite";

export function ensureTsconfig(root: string): void {
  const path = resolve(root, "tsconfig.json");
  if (existsSync(path)) return;
  const body = { extends: "knobkit/tsconfig.base.json", include: ["**/*.ts", "**/*.tsx"] };
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n");
  console.log("knobkit: created tsconfig.json");
}

export function knobkitSource(root: string): string | null {
  try {
    const require = createRequire(resolve(root, "_.js"));
    const src = resolve(dirname(require.resolve("knobkit/package.json")), "src/lib/index.ts");
    return existsSync(src) ? src : null;
  } catch {
    return null;
  }
}

const tsSource: Plugin = {
  name: "knobkit:ts-source",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || !source.startsWith(".") || !source.endsWith(".js")) return null;
    const base = resolve(dirname(importer), source);
    for (const cand of [base.replace(/\.js$/, ".tsx"), base.replace(/\.js$/, ".ts")]) {
      if (existsSync(cand)) return cand;
    }
    return null;
  },
};

export function indexHtml(entry: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>knobkit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${entry}"></script>
  </body>
</html>
`;
}

function virtualIndex(entry: string): Plugin {
  return {
    name: "knobkit:index",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/" && url !== "/index.html") return next();
        res.statusCode = 200;
        res.setHeader("content-type", "text/html");
        res.end(await server.transformIndexHtml(req.originalUrl ?? "/", indexHtml(entry)));
      });
    },
  };
}

export function mountConfig(root: string, entry: string, ownHtml: boolean): InlineConfig {
  const src = knobkitSource(root);
  const entryRel = relative(root, entry);
  return {
    configFile: false,
    root,
    plugins: [tsSource, ...(ownHtml ? [] : [virtualIndex(entryRel)])],
    esbuild: { jsx: "automatic" },
    resolve: {
      dedupe: ["react", "react-dom"],
      ...(src ? { alias: { knobkit: src } } : {}),
    },
    ...(ownHtml ? {} : { optimizeDeps: { entries: [entryRel] } }),
    server: { fs: { allow: [searchForWorkspaceRoot(root)] } },
  };
}
