// tsc emits only .ts outputs; carry .css files (imported by client modules, resolved by the
// consumer's bundler) into dist alongside their modules.
import { cpSync, globSync } from "node:fs";
import { join } from "node:path";

for (const file of globSync("src/**/*.css")) {
  cpSync(file, join("dist", file.slice("src/".length)));
}
