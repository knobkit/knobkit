import { existsSync, rmSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build as viteBuild, createServer } from "vite";
import { indexHtml, mountConfig } from "./config.js";

export async function devMount(
  root: string,
  entry: string,
  opts: { port?: number; quiet?: boolean } = {},
): Promise<string | undefined> {
  const ownHtml = existsSync(resolve(root, "index.html"));
  const server = await createServer({
    ...mountConfig(root, entry, ownHtml),
    server: { port: opts.port },
    ...(opts.quiet ? { logLevel: "warn" as const } : {}),
  });
  await server.listen();
  if (!opts.quiet) server.printUrls();
  return server.resolvedUrls?.local[0];
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
