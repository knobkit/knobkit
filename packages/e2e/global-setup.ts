import type { TestProject } from "vitest/node";
import { startApp } from "./harness/server.js";

// One browser-only dev server for the whole run: every fixture is a lazy chunk of one entry, so
// they share a dependency cache instead of each rebuilding it.
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const mount = await startApp("mount", { port: Number(process.env["E2E_MOUNT_PORT"] ?? 4170) });
  project.provide("mountUrl", mount.url);
  return () => mount.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mountUrl: string;
  }
}
