// carry .css files, and libraries kept in the package (vendor/), into dist alongside the tsc-emitted modules
import { cpSync, globSync } from "node:fs";
import { join } from "node:path";

for (const file of [...globSync("src/**/*.css"), ...globSync("src/**/vendor/**/*.*"), ...globSync("src/**/vendor/**/LICENSE")]) {
  cpSync(file, join("dist", file.slice("src/".length)));
}
