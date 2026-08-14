// carry .css files into dist alongside their tsc-emitted modules
import { cpSync, globSync } from "node:fs";
import { join } from "node:path";

for (const file of globSync("src/**/*.css")) {
  cpSync(file, join("dist", file.slice("src/".length)));
}
