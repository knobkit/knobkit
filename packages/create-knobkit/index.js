#!/usr/bin/env node
import { existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve, join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const PKG_ROOT = dirname(fileURLToPath(import.meta.url));
// Versioned in lockstep with knobkit: our own version is the knobkit the templates were built for.
const KNOBKIT_VERSION = `^${JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).version}`;

const TEMPLATES = resolve(PKG_ROOT, "templates");
const TIERS = ["mount", "serve"];

function parseArgs(argv) {
  const out = { dir: undefined, tier: undefined, yes: false };
  for (const a of argv) {
    if (a === "--mount") out.tier = "mount";
    else if (a === "--serve") out.tier = "serve";
    else if (a === "-y" || a === "--yes") out.yes = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (!a.startsWith("-") && out.dir === undefined) out.dir = a;
  }
  return out;
}

const HELP = `create-knobkit — scaffold a new knobkit app

Usage:
  npm create knobkit@latest [dir] [options]

Options:
  --mount      Runs entirely in the browser (state + handlers client-side)
  --serve      Handlers run on a stateless Node server (browser keeps state)
  -y, --yes    Accept defaults without prompting
  -h, --help   Show this help
`;

function detectPM() {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

function isEmptyDir(dir) {
  if (!existsSync(dir)) return true;
  const entries = readdirSync(dir).filter((e) => e !== ".git");
  return entries.length === 0;
}

function copyTemplate(srcDir, destDir, tokens) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const src = join(srcDir, entry);
    const name = entry === "_gitignore" ? ".gitignore" : entry;
    const dest = join(destDir, name);
    if (statSync(src).isDirectory()) {
      copyTemplate(src, dest, tokens);
      continue;
    }
    let content = readFileSync(src, "utf8");
    for (const [k, v] of Object.entries(tokens)) content = content.replaceAll(k, v);
    writeFileSync(dest, content);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    stdout.write(HELP);
    return;
  }

  const interactive = stdin.isTTY && !args.yes;
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;
  const ask = async (q, def) => {
    if (!rl) return def;
    const a = (await rl.question(`${q} ${def ? `(${def}) ` : ""}`)).trim();
    return a || def;
  };

  try {
    let dir = args.dir ?? (await ask("Project directory:", "my-knobkit-app"));
    dir = dir.trim() || "my-knobkit-app";
    const target = resolve(process.cwd(), dir);
    const name = basename(target);

    if (!isEmptyDir(target)) {
      stdout.write(`\n  Target directory "${dir}" exists and is not empty. Aborting.\n`);
      process.exitCode = 1;
      return;
    }

    let tier = args.tier;
    if (!tier) {
      const a = (await ask("Runtime — mount (browser) or serve (node)?", "mount")).toLowerCase();
      tier = a.startsWith("s") ? "serve" : "mount";
    }
    if (!TIERS.includes(tier)) tier = "mount";

    copyTemplate(join(TEMPLATES, tier), target, {
      __PROJECT_NAME__: name,
      __KNOBKIT_VERSION__: KNOBKIT_VERSION,
    });

    const pm = detectPM();
    const run = pm === "npm" ? "npm run" : pm;
    stdout.write(
      `\n  Created ${name} (${tier}) in ${dir}\n\n` +
        `  Next steps:\n` +
        `    cd ${dir}\n` +
        `    ${pm} install\n` +
        `    ${run} dev\n\n`,
    );
  } finally {
    rl?.close();
  }
}

main().catch((err) => {
  stdout.write(`\n  ${err?.message ?? err}\n`);
  process.exitCode = 1;
});
