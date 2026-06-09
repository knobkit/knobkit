import { existsSync, rmSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build as viteBuild, createServer } from "vite";
import { indexHtml, mountConfig } from "./config.js";

export async function devMount(root: string, entry: string, port?: number): Promise<void> {
  const ownHtml = existsSync(resolve(root, "index.html"));
  const server = await createServer({ ...mountConfig(root, entry, ownHtml), server: { port } });
  await server.listen();
  server.printUrls();
}

export async function buildMount(root: string, entry: string): Promise<void> {
  const htmlPath = resolve(root, "index.html");
  const created = !existsSync(htmlPath);
  if (created) writeFileSync(htmlPath, indexHtml(relative(root, entry)));
  try {
    await viteBuild({
      ...mountConfig(root, entry, true),
      build: { outDir: "dist", emptyOutDir: true },
    });
  } finally {
    if (created) rmSync(htmlPath, { force: true });
  }
}
