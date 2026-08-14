import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { searchForWorkspaceRoot, type InlineConfig, type Plugin } from "vite";
import { viewRefTransform } from "./view-transform.js";

// K-Tile favicon as a data URI so apps get one without serving an extra file.
const SVG = [
  "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E",
  "%3Crect x='4' y='4' width='56' height='56' rx='14' fill='%232563eb'/%3E",
  "%3Cg stroke='%23fff' stroke-width='7' stroke-linecap='round'%3E",
  "%3Cline x1='23' y1='16' x2='23' y2='48'/%3E",
  "%3Cline x1='23' y1='33' x2='42' y2='18'/%3E",
  "%3Cline x1='23' y1='33' x2='42' y2='46'/%3E",
  "%3C/g%3E",
  "%3Ccircle cx='23' cy='33' r='6.5' fill='%23fff'/%3E",
  "%3Ccircle cx='23' cy='33' r='2.8' fill='%231d4ed8'/%3E",
  "%3C/svg%3E",
].join("");

export const FAVICON_TAG = `<link rel="icon" href="data:image/svg+xml,${SVG}" />`;

export function ensureTsconfig(root: string): void {
  const path = resolve(root, "tsconfig.json");
  if (existsSync(path)) return;
  const body = { extends: "knobkit/tsconfig.base.json", include: ["**/*.ts", "**/*.tsx"] };
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n");
  console.log("knobkit: created tsconfig.json");
}

// In the monorepo, alias the packages to their sources so example dev never runs against a stale
// dist. Installed consumers resolve dist normally (and get the viewRef transform over node_modules).
function sourceAliases(root: string): Array<{ find: string | RegExp; replacement: string }> {
  const require = createRequire(resolve(root, "_.js"));
  const aliases: Array<{ find: string | RegExp; replacement: string }> = [];
  const tryAlias = (find: string | RegExp, pkg: string, sub: string): void => {
    try {
      const src = resolve(dirname(require.resolve(`${pkg}/package.json`)), sub);
      if (existsSync(src)) aliases.push({ find, replacement: src });
    } catch {
      /* not installed from source */
    }
  };
  tryAlias(/^knobkit$/, "knobkit", "src/index.ts");
  tryAlias(/^knobkit\/media$/, "knobkit", "src/media.ts");
  tryAlias(/^@knobkit\/core\/client$/, "@knobkit/core", "src/client/index.ts");
  tryAlias(/^@knobkit\/core\/server$/, "@knobkit/core", "src/server/stub.ts");
  tryAlias(/^@knobkit\/core$/, "@knobkit/core", "src/index.ts");
  return aliases;
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
    ${FAVICON_TAG}
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
  const entryRel = relative(root, entry);
  return {
    configFile: false,
    root,
    plugins: [viewRefTransform(), tsSource, ...(ownHtml ? [] : [virtualIndex(entryRel)])],
    esbuild: { jsx: "automatic" },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: sourceAliases(root),
    },
    // keep the widget packages out of esbuild prebundling so viewRefTransform sees their defs
    optimizeDeps: { exclude: ["knobkit", "@knobkit/core"], ...(ownHtml ? {} : { entries: [entryRel] }) },
    server: { fs: { allow: [searchForWorkspaceRoot(root)] } },
  };
}
