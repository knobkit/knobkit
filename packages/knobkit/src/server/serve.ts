import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";
import { Server } from "socket.io";
import type { KnobkitServer, Event } from "../lib/types.js";
import type { Knobkit } from "../lib/knobkit.js";
import { declare, type AppDecl } from "../lib/declare.js";
import { makeBound } from "../lib/ctx.js";
import { run } from "./context.js";

const CLIENT_JS = fileURLToPath(new URL("../../dist/client.js", import.meta.url));
const CLIENT_CSS = fileURLToPath(new URL("../../dist/client.css", import.meta.url));
const ASSETS = fileURLToPath(new URL("../../dist/assets", import.meta.url));

const isEvent = (x: any): x is Event => x != null && typeof x.type === "string" && "payload" in x;

function html(decl: AppDecl, loading: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${decl.title ?? "knobkit"}</title><link rel="stylesheet" href="/client.css" /></head>
<body><div id="root">${loading}</div><script type="module" src="/client.js"></script></body></html>`;
}

// node-only. The browser owns state and renders; the server is stateless. It serves the decl + client
// bundle, then for each `request` (just `{type, payload}` — no state shipped) resolves the event's
// `on(...)` handlers. Their context reads state by pulling one attribute from the client on demand
// (`read` ack), applies state with `edit`/`enable`, and re-emits produced events with `emit`.
export async function serve(knobkit: Knobkit, opts?: { port?: number }): Promise<KnobkitServer> {
  const decl = declare(knobkit.config, knobkit.serverEvents());

  let js = "";
  let css = "";
  try {
    [js, css] = await Promise.all([readFile(CLIENT_JS, "utf8"), readFile(CLIENT_CSS, "utf8")]);
  } catch {
    js = `document.getElementById("root").textContent="knobkit: build the browser client (pnpm -F knobkit build:client).";`;
  }

  const server = createServer(async (req, res) => {
    if (req.url === "/api/decl") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(decl));
    } else if (req.url === "/client.js") {
      res.setHeader("content-type", "text/javascript; charset=utf-8");
      res.end(js);
    } else if (req.url === "/client.css") {
      res.setHeader("content-type", "text/css; charset=utf-8");
      res.end(css);
    } else if (req.url?.startsWith("/assets/") && req.url.endsWith(".js")) {
      // code-split chunks (e.g. lazy-loaded CodeMirror grammars). Resolve under dist/assets and
      // confirm the result stays inside it before serving — never trust the request path.
      const file = resolve(ASSETS, req.url.slice("/assets/".length).split("?")[0]!);
      if (!file.startsWith(ASSETS + sep)) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("Forbidden");
        return;
      }
      try {
        const body = await readFile(file);
        res.setHeader("content-type", "text/javascript; charset=utf-8");
        res.setHeader("cache-control", "public, max-age=31536000, immutable"); // hashed name
        res.end(body);
      } catch {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found");
      }
    } else if (req.url === "/" || req.url === "/index.html") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(html(decl, knobkit.config.loading ?? ""));
    } else {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
  });

  // A `read` ack can carry a large attribute (e.g. an uploaded image data URL), so lift socket.io's
  // 1MB default clear of legitimate reads.
  const io = new Server(server, { path: "/socket.io/", maxHttpBufferSize: 1e8 });
  io.on("connection", (socket) => {
    const bound = makeBound({
      read: (key, path) => socket.timeout(15000).emitWithAck("read", { key, path }),
      edit: (key, op, path, value) => void socket.emit("edit", { key, op, path, value }),
      enable: (key, value) => void socket.emit("enable", { key, value }),
      busy: (key, value) => void socket.emit("busy", { key, value }),
      keyFor: (w) => knobkit.keyFor(w),
    });
    void (async () => {
      for (const fn of knobkit.setups) {
        try {
          await run(bound, fn);
        } catch (err) {
          console.error(err);
        }
      }
    })();
    socket.on("request", async (msg: { type: string; payload: unknown }) => {
      const { type } = msg ?? {};
      if (typeof type !== "string") return;
      let { payload } = msg;
      // socket.io delivers a typed-array payload (mic PCM samples) as a Buffer; restore the
      // Float32Array the handler expects.
      if (Buffer.isBuffer(payload)) {
        const bytes = Uint8Array.from(payload);
        payload = new Float32Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 4));
      }
      try {
        await run(bound, async () => {
          for (const handler of knobkit.handlers.get(type) ?? []) {
            const r = await handler(payload);
            if (isEvent(r)) socket.emit("emit", r);
          }
        });
      } catch (err) {
        console.error(err);
      }
    });
  });

  const port = opts?.port ?? 3000;
  await new Promise<void>((r) => server.listen(port, r));
  const addr = server.address();
  const boundPort = addr && typeof addr === "object" && addr ? addr.port : port;
  const url = `http://localhost:${boundPort}/`;
  console.log(`\n  knobkit  →  ${url}\n`);
  return {
    url,
    stop: () => new Promise<void>((r) => io.close(() => r())),
  };
}
