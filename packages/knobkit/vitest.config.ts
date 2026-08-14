import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // NodeNext sources import "./x.js" for "./x.ts"; vite needs the mapping spelled out.
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
    },
  ],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
