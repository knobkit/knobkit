import { devMount } from "./mount.js";
import { runServe } from "./serve.js";
import { devEnv } from "./view-deps.js";

export async function runPlayground(
  root: string,
  file: string,
  tier: "mount" | "serve",
  opts: { port?: number } = {},
): Promise<void> {
  const pgPort = opts.port ?? 4317;
  const appPort = pgPort + 1;

  let preview: string;
  if (tier === "mount") {
    preview = (await devMount(root, file, { port: appPort, quiet: true })) ?? `http://localhost:${appPort}/`;
  } else {
    void runServe(file, { port: appPort, quiet: true });
    preview = `http://localhost:${appPort}/`;
  }

  // the playground UI is itself a serve app, but it runs in *this* process — runServe sets the dev
  // env only for the child it spawns, so set it here too or serveApp takes the dist/client branch.
  Object.assign(process.env, devEnv());
  process.env["KNOBKIT_PG_FILE"] = file;
  process.env["KNOBKIT_PG_PREVIEW"] = preview;
  process.env["KNOBKIT_PG_PORT"] = String(pgPort);
  process.env["KNOBKIT_PG_TIER"] = tier;

  console.log(`\n  knobkit playground  →  http://localhost:${pgPort}/\n`);
  await import("./playground-app.js");
}
