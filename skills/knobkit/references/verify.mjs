// Install each reference project and typecheck it against knobkit, so the references can't silently
// drift from the API. Run: node verify.mjs  (needs Node + npm, same as knobkit).
import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "projects");
const names = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const failed = [];
for (const name of names) {
  console.log(`── ${name}`);
  const cwd = join(root, name);
  try {
    execSync("npm install --no-audit --no-fund --silent --package-lock=false", {
      cwd,
      stdio: ["ignore", "ignore", "inherit"],
    });
    execSync("npm run --silent typecheck", { cwd, stdio: "inherit" });
    console.log("   ✓ typecheck clean");
  } catch {
    console.log("   ✗ FAILED");
    failed.push(name);
  }
}

if (failed.length) {
  console.log(`\nfailed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("\nall reference projects typecheck ✓");
