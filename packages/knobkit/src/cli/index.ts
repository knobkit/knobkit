#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureTsconfig } from "./config.js";
import { buildMount, devMount } from "./mount.js";
import { runServe } from "./serve.js";

const HELP = `knobkit — build a web app from widgets and event handlers

Usage:
  knobkit dev [file]     Start a dev server (auto-detects mount vs serve)
  knobkit build [file]   Build a browser (mount) app to dist/
  knobkit serve [file]   Run a server (serve) app    (same as: knobkit dev --serve)

  file defaults to demo.tsx

Flags:
  --mount      Force browser (mount) mode
  --serve      Force server (serve) mode
  --port <n>   Dev server port (mount)
`;

interface Args {
  file: string;
  mount: boolean;
  serve: boolean;
  port?: number;
}

function parse(argv: string[]): Args {
  const out: Args = { file: "demo.tsx", mount: false, serve: false };
  let sawFile = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mount") out.mount = true;
    else if (a === "--serve") out.serve = true;
    else if (a === "--port") out.port = Number(argv[++i]);
    else if (a.startsWith("--port=")) out.port = Number(a.slice("--port=".length));
    else if (!a.startsWith("-") && !sawFile) {
      out.file = a;
      sawFile = true;
    }
  }
  return out;
}

function mode(file: string, args: Args): "mount" | "serve" {
  if (args.serve) return "serve";
  if (args.mount) return "mount";
  return /\.serve\s*\(/.test(readFileSync(file, "utf8")) ? "serve" : "mount";
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    process.stdout.write(HELP);
    return;
  }
  if (cmd !== "dev" && cmd !== "build" && cmd !== "serve") {
    process.stderr.write(`knobkit: unknown command "${cmd}"\n\n${HELP}`);
    process.exit(1);
  }

  const args = parse(rest);
  const root = process.cwd();
  const file = resolve(root, args.file);
  if (!existsSync(file)) {
    process.stderr.write(`knobkit: no such file: ${args.file}\n`);
    process.exit(1);
  }
  ensureTsconfig(root);

  if (cmd === "build") return buildMount(root, file);
  if (cmd === "serve") return runServe(file);
  if (mode(file, args) === "serve") return runServe(file);
  return devMount(root, file, args.port);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
