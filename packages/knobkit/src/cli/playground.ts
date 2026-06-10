import { devMount } from "./mount.js";
import { runServe } from "./serve.js";

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

  process.env.KNOBKIT_PG_FILE = file;
  process.env.KNOBKIT_PG_PREVIEW = preview;
  process.env.KNOBKIT_PG_PORT = String(pgPort);
  process.env.KNOBKIT_PG_TIER = tier;

  console.log(`\n  knobkit playground  →  http://localhost:${pgPort}/\n`);
  await import("./playground-app.js");
}
