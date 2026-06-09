import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

const tsSource: Plugin = {
  name: "ts-source",
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

export default defineConfig({
  plugins: [tsSource],
  esbuild: { jsx: "automatic" },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: { knobkit: resolve(here, "../../packages/knobkit/src/lib/index.ts") },
  },
  server: { fs: { allow: [resolve(here, "../..")] } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, "index.html"),
        preview: resolve(here, "preview.html"),
      },
    },
  },
});
