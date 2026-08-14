import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { viewRefTransform } from "./src/cli/view-transform.js";

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
  plugins: [viewRefTransform(), tsSource],
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      { find: /^@knobkit\/core\/client$/, replacement: resolve(here, "../core/src/client/index.ts") },
      { find: /^@knobkit\/core\/server$/, replacement: resolve(here, "../core/src/server/stub.ts") },
      { find: /^@knobkit\/core$/, replacement: resolve(here, "../core/src/index.ts") },
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: resolve(here, "src/browser.ts"),
      preserveEntrySignatures: "strict",
      output: {
        entryFileNames: "knobkit.browser.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "knobkit.browser.[ext]",
      },
    },
  },
});
