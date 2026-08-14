import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

function tsxBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("tsx/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin: string | Record<string, string> };
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin["tsx"]!;
  return resolve(dirname(pkgPath), bin);
}

/** Run a serve app under tsx watch with the vite dev middleware active. */
export function runServe(file: string, opts: { port?: number; quiet?: boolean } = {}): Promise<void> {
  const env: Record<string, string | undefined> = { ...process.env, KNOBKIT_DEV: "1" };
  if (opts.port) env["KNOBKIT_PORT"] = String(opts.port);
  if (opts.quiet) env["KNOBKIT_QUIET"] = "1";
  const child = spawn(process.execPath, [tsxBin(), "watch", file], { stdio: "inherit", env });
  return new Promise((res) => {
    child.on("exit", (code) => {
      if (code) process.exitCode = code;
      res();
    });
  });
}

/** Serve-tier build: run the app once with KNOBKIT_BUILD=1 — serve() emits dist/client and exits. */
export function buildServe(file: string): Promise<void> {
  const child = spawn(process.execPath, [tsxBin(), file], {
    stdio: "inherit",
    env: { ...process.env, KNOBKIT_BUILD: "1", KNOBKIT_QUIET: "1" },
  });
  return new Promise((res, rej) => {
    child.on("exit", (code) => (code ? rej(new Error(`knobkit build failed (exit ${code})`)) : res()));
  });
}
