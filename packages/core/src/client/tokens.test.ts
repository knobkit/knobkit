import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

test("client CSS uses only --pu-* tokens, no raw color literals", () => {
  const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;
  const offenders: string[] = [];
  for (const name of readdirSync(HERE)) {
    if (!name.endsWith(".css") || name === "styles.css") continue;
    readFileSync(join(HERE, name), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (COLOR.test(line)) offenders.push(`${name}:${i + 1}  ${line.trim()}`);
      });
  }
  expect(offenders, `raw color literals found — use a --pu-* token instead:\n${offenders.join("\n")}`).toEqual([]);
});
