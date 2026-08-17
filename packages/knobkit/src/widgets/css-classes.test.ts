import { expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, AMBIENT_DIRS } from "../../scripts/gen-css-classes.mjs";

/*
 * Class names reach views only as imported constants, so naming a class is what loads its rules.
 * Two things keep that true: the generated modules must match their stylesheets, and no view may
 * reintroduce a raw literal to sidestep the import.
 */

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(PKG, "src");

test("generated .css.ts modules match their stylesheets", () => {
  const expected = generate({
    root: SRC,
    ambientDirs: AMBIENT_DIRS.map((d) => resolve(PKG, d)),
    write: false,
  });
  const stale: string[] = [];
  for (const [file, body] of expected) {
    let actual: string | null = null;
    try {
      actual = readFileSync(file, "utf8");
    } catch {
      /* missing */
    }
    if (actual !== body) stale.push(relative(PKG, file));
  }
  expect(stale, `stale generated modules — run \`pnpm gen:css\`:\n${stale.join("\n")}`).toEqual([]);
});

function views(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? views(p) : name.endsWith(".tsx") ? [p] : [];
  });
}

test("views name classes through imports, never as string literals", () => {
  const offenders: string[] = [];
  for (const file of views(join(SRC, "widgets"))) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        // a bare "pu-…" / 'pu-…' string is a class name that bypassed its stylesheet's module.
        // Interpolated variants inside a template (`pu-toast--${v}`) are fine: the base constant
        // imported alongside them has already pulled the sheet that defines every variant.
        if (/(["'])pu-[a-zA-Z0-9_-]*\1/.test(line) && !line.includes(".css.js"))
          offenders.push(`${relative(SRC, file)}:${i + 1}  ${line.trim()}`);
      });
  }
  expect(
    offenders,
    `class-name literal in a view — import the constant from the stylesheet's generated module so the
rules travel with the name:\n${offenders.join("\n")}`,
  ).toEqual([]);
});
