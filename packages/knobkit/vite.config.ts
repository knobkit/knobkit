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
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(here, "src/client/entry.tsx"),
      output: {
        entryFileNames: "client.js",
        // lazy import()s (e.g. CodeMirror grammars) split into hashed chunks under assets/, which
        // serve() serves on demand — so a grammar's bytes only ship when an app actually uses it.
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "client.[ext]",
      },
    },
  },
});
