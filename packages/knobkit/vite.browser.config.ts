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

const stubServe: Plugin = {
  name: "stub-serve",
  enforce: "pre",
  resolveId(source) {
    return /\/server\/serve(\.js)?$/.test(source) ? resolve(here, "src/client/serve-stub.ts") : null;
  },
};

export default defineConfig({
  plugins: [stubServe, tsSource],
  esbuild: { jsx: "automatic" },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: resolve(here, "src/client/browser.ts"),
      preserveEntrySignatures: "strict",
      onwarn(warning, warn) {
        if (warning.code === "INEFFECTIVE_DYNAMIC_IMPORT") return;
        warn(warning);
      },
      output: {
        codeSplitting: false,
        entryFileNames: "knobkit.browser.js",
        assetFileNames: "knobkit.browser.[ext]",
      },
    },
  },
});
