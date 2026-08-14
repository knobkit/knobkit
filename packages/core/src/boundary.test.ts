import { expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

test("@knobkit/core has zero imports from knobkit", () => {
  const offenders = sources(SRC).filter((file) =>
    /from\s+["']knobkit["'/]|import\s*\(\s*["']knobkit["'/]/.test(readFileSync(file, "utf8")),
  );
  expect(offenders).toEqual([]);
});
