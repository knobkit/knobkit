import { test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WIDGETS = dirname(fileURLToPath(import.meta.url));

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? cssFiles(p) : name.endsWith(".css") ? [p] : [];
  });
}

test("widget CSS uses only --pu-* tokens, no raw color literals", () => {
  const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;
  const offenders: string[] = [];
  for (const file of cssFiles(WIDGETS)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (COLOR.test(line)) offenders.push(`${file.slice(WIDGETS.length + 1)}:${i + 1}  ${line.trim()}`);
      });
  }
  expect(offenders, `raw color literals found — use a --pu-* token instead:\n${offenders.join("\n")}`).toEqual([]);
});
