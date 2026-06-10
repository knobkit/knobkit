import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

function tsxBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("tsx/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin: string | Record<string, string> };
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.tsx;
  return resolve(dirname(pkgPath), bin);
}

export function runServe(file: string, opts: { port?: number; quiet?: boolean } = {}): Promise<void> {
  const env = { ...process.env };
  if (opts.port) env.KNOBKIT_PORT = String(opts.port);
  if (opts.quiet) env.KNOBKIT_QUIET = "1";
  const child = spawn(process.execPath, [tsxBin(), "watch", file], { stdio: "inherit", env });
  return new Promise((res) => {
    child.on("exit", (code) => {
      if (code) process.exitCode = code;
      res();
    });
  });
}
