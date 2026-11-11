import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(dirname(createRequire(import.meta.url).resolve("knobkit/package.json")), "dist/cli/index.js");

export interface Running {
  url: string;
  proc: ChildProcess;
  output(): string;
  stop(): Promise<void>;
}

async function up(url: string, proc: ChildProcess, output: () => string): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`knobkit dev exited (${proc.exitCode}):\n${output()}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`knobkit dev did not come up at ${url}:\n${output()}`);
}

/** whether something already answers on the port */
const taken = (port: number): Promise<boolean> =>
  Promise.all(
    ["127.0.0.1", "::1"].map(
      (host) =>
        new Promise<boolean>((res) => {
          const s = connect({ port, host });
          s.once("connect", () => {
            s.destroy();
            res(true);
          });
          s.once("error", () => res(false));
        }),
    ),
  ).then((hits) => hits.some(Boolean));

/** end the process and everything under it (it leads its own process group) */
const endGroup = (proc: ChildProcess): Promise<void> =>
  new Promise<void>((res) => {
    const gone = proc.exitCode !== null || proc.signalCode !== null;
    if (!gone) proc.once("exit", () => res());
    try {
      process.kill(-proc.pid!, "SIGKILL"); // also when it has gone itself: what it started may not have
    } catch {
      return res();
    }
    if (gone) res();
  });

/** `knobkit dev` on a fixture: `"mount"` serves every fixture browser-only, a name serves that one from Node. */
export async function startApp(app: string, opts: { port: number; env?: Record<string, string> }): Promise<Running> {
  const mount = app === "mount";
  const args = mount
    ? [cli, "dev", "apps/mount.tsx", "--mount", "--port", String(opts.port)]
    : [cli, "dev", "apps/serve.ts", "--serve", "--port", String(opts.port)];
  // a server left on the port by an earlier run would answer in this one's place, with whatever it has loaded
  if (await taken(opts.port)) throw new Error(`port ${opts.port} is already in use: is a dev server left over from an earlier run?`);
  const proc = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...opts.env, ...(mount ? {} : { E2E_APP: app }) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // its own process group, so stop() takes the watcher's children with it
  });
  let out = "";
  proc.stdout!.on("data", (d: Buffer) => (out += d.toString()));
  proc.stderr!.on("data", (d: Buffer) => (out += d.toString()));
  const url = `http://localhost:${opts.port}/`;
  try {
    await up(url, proc, () => out);
  } catch (err) {
    await endGroup(proc); // it did not come up: do not leave it, or what it started, behind
    throw err;
  }
  return { url, proc, output: () => out, stop: () => endGroup(proc) };
}
