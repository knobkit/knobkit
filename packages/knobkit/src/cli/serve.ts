import { execFileSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { devEnv } from "./view-deps.js";

function tsxBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("tsx/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin: string | Record<string, string> };
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin["tsx"]!;
  return resolve(dirname(pkgPath), bin);
}

/** Every process started, directly or not, by `pid` (none on Windows, which has no `ps`). */
function descendants(pid: number): number[] {
  if (process.platform === "win32") return [];
  let rows: [number, number][];
  try {
    rows = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((l) => l.trim().split(/\s+/).map(Number) as [number, number]);
  } catch {
    return [];
  }
  const found: number[] = [];
  const walk = (parent: number): void => {
    for (const [child, of] of rows) {
      if (of !== parent) continue;
      found.push(child);
      walk(child);
    }
  };
  walk(pid);
  return found;
}

const SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 } as const;
const GRACE_MS = 1000;

/**
 * When this process is told to end, end what it started too: the watcher and the app under it.
 * Left alone they outlive the command and keep the port. They are asked first, and killed if they
 * have not gone within a second.
 */
function endWith(child: ChildProcess): void {
  let ending = false;
  for (const [name, number] of Object.entries(SIGNALS)) {
    process.on(name, () => {
      if (ending) return;
      ending = true;
      const pids = child.pid ? [child.pid, ...descendants(child.pid)] : [];
      const send = (signal: NodeJS.Signals): void => {
        for (const pid of pids) {
          try {
            process.kill(pid, signal);
          } catch {
            /* already gone */
          }
        }
      };
      const running = (): boolean =>
        pids.some((pid) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch {
            return false;
          }
        });
      send("SIGTERM");
      const asked = Date.now();
      const check = setInterval(() => {
        if (running() && Date.now() - asked < GRACE_MS) return;
        clearInterval(check);
        send("SIGKILL");
        process.exit(128 + number); // the exit code of a process ended by this signal
      }, 20);
    });
  }
}

/** Run a serve app under tsx watch with the vite dev middleware active. */
export function runServe(file: string, opts: { port?: number; quiet?: boolean } = {}): Promise<void> {
  const env: Record<string, string | undefined> = { ...process.env, ...devEnv() };
  if (opts.port) env["KNOBKIT_PORT"] = String(opts.port);
  if (opts.quiet) env["KNOBKIT_QUIET"] = "1";
  const child = spawn(process.execPath, [tsxBin(), "watch", file], { stdio: "inherit", env });
  endWith(child);
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
