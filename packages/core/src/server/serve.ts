import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { App } from "../app.js";
import { decode, encode } from "../codec.js";
import { setMediaStore } from "../media.js";
import { APP_PATH, MEDIA_PATH, WS_PATH } from "../protocol.js";
import type { Frame } from "../protocol.js";
import type { KnobkitServer } from "../types.js";
import { createViteDev, HMR_PATH } from "./bundler.js";
import type { DevMiddleware } from "./bundler.js";
import { installNodeContext } from "./context.js";
import { FAVICON_TAG } from "./favicon.js";
import { createServerMediaStore } from "./media.js";
import { createSession } from "./session.js";
import type { Session } from "./session.js";

const HEARTBEAT_MS = 15_000;

function htmlPage(app: App, opts: { css: boolean }): string {
  const c = app.config;
  const attrs = `${c.theme ? ` data-theme="${c.theme}"` : ""}${c.density ? ` data-density="${c.density}"` : ""}${c.fill ? " data-fill" : ""}`;
  return `<!doctype html><html lang="en"${attrs}><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${c.title ?? "knobkit"}</title>${FAVICON_TAG}${opts.css ? `<link rel="stylesheet" href="${APP_PATH}/style.css" />` : ""}</head>
<body><div id="root"></div><script type="module" src="${APP_PATH}/entry.js"></script></body></html>`;
}

async function readBody(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

const MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export async function serveApp(
  app: App,
  opts?: { port?: number; quiet?: boolean; heartbeatMs?: number },
): Promise<KnobkitServer> {
  installNodeContext();
  app.declare();

  if (process.env["KNOBKIT_BUILD"] === "1") {
    const { buildServeClient } = await import("./bundler.js");
    await buildServeClient(resolve(process.cwd(), "dist/client"));
    process.exit(0);
  }

  const subs = app.subDecls();
  const media = createServerMediaStore();
  setMediaStore(media);

  const port = opts?.port ?? (process.env["KNOBKIT_PORT"] ? Number(process.env["KNOBKIT_PORT"]) : 3000);
  const dev = process.env["KNOBKIT_DEV"] === "1";
  const viewDeps = process.env["KNOBKIT_VIEW_DEPS"]?.split(",").filter(Boolean) ?? [];
  const root = process.cwd();
  const distClient = resolve(root, "dist/client");
  if (!dev && !existsSync(resolve(distClient, "entry.js"))) {
    throw new Error(
      `knobkit: no client bundle at ${distClient} — run \`knobkit build\` first (or \`knobkit dev\` for development)`,
    );
  }
  const hasCss = !dev && existsSync(resolve(distClient, "style.css"));

  const sessions = new Map<string, Session>();
  const sweep = setInterval(() => {
    for (const [id, s] of sessions) if (s.expired()) sessions.delete(id);
  }, 60_000);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = (req.url ?? "/").split("?")[0]!;
    try {
      if (url === "/" || url === "/index.html") {
        let html = htmlPage(app, { css: hasCss });
        if (vite) html = await vite.transformHtml("/", html);
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(html);
      } else if (url.startsWith(`${MEDIA_PATH}/`)) {
        const id = decodeURIComponent(url.slice(MEDIA_PATH.length + 1));
        if (req.method === "POST") {
          media.handlePost(id, req.headers["content-type"] ?? "application/octet-stream", await readBody(req));
          res.statusCode = 204;
          res.end();
        } else {
          const entry = media.handleGet(id);
          if (!entry) {
            res.statusCode = 404;
            res.end("Not found");
          } else {
            res.setHeader("content-type", entry.mime);
            res.setHeader("cache-control", "private, max-age=31536000, immutable");
            res.end(Buffer.from(entry.bytes));
          }
        }
      } else if (!dev && url.startsWith(`${APP_PATH}/`)) {
        const file = resolve(distClient, url.slice(APP_PATH.length + 1));
        if (!file.startsWith(distClient + sep)) {
          res.statusCode = 403;
          return void res.end("Forbidden");
        }
        try {
          const body = await readFile(file);
          const ext = file.slice(file.lastIndexOf("."));
          res.setHeader("content-type", MIME[ext] ?? "application/octet-stream");
          if (url.includes("/assets/")) res.setHeader("cache-control", "public, max-age=31536000, immutable");
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end("Not found");
        }
      } else if (vite) {
        vite.handle(req, res);
      } else {
        res.statusCode = 404;
        res.end("Not found");
      }
    } catch (err) {
      console.error("knobkit: request failed", err);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });

  // after the http server exists so vite's HMR websocket can ride it instead of opening its own port
  const vite: DevMiddleware | null = dev ? await createViteDev({ root, server, port, viewDeps }) : null;

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === WS_PATH) {
      return void wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    }
    // in dev vite is a second upgrade consumer on this server — leave HMR to vite's own listener
    // rather than destroying it out from under it. Everything else is still ours to close: once a
    // listener exists node stops closing unhandled upgrades, so an unclaimed socket would sit open
    // until the peer times out.
    if (!dev || path !== HMR_PATH) socket.destroy();
  });

  wss.on("connection", (ws: WebSocket) => {
    let session: Session | null = null;
    let missedPongs = 0;

    const sendSys = (frames: Frame[]): void => {
      if (ws.readyState === ws.OPEN) ws.send(encode(frames));
    };

    const heartbeat = setInterval(() => {
      if (missedPongs >= 2) return ws.terminate();
      missedPongs++;
      sendSys([{ seq: -1, ack: session?.link.cursor() ?? 0, kind: "sys", op: "ping" }]);
    }, opts?.heartbeatMs ?? HEARTBEAT_MS);

    ws.on("message", (data: Buffer) => {
      let frames: Frame[];
      try {
        frames = decode(new Uint8Array(data)) as Frame[];
      } catch (err) {
        console.error("knobkit: undecodable frame batch", err);
        return;
      }
      for (const frame of frames) {
        if (frame.kind === "sys") {
          if (frame.op === "pong") missedPongs = 0;
          else if (frame.op === "hello") {
            const existing = frame.session ? sessions.get(frame.session) : undefined;
            if (existing && !existing.expired()) {
              session = existing;
              session.attach({ send: (b) => ws.send(b) }, frame.cursor ?? 0);
            } else {
              session = createSession(app, { dev });
              sessions.set(session.id, session);
              session.attach({ send: (b) => ws.send(b) }, undefined);
              sendSys([
                { seq: -1, ack: 0, kind: "sys", op: "welcome", session: session.id, doc: app.declare(), subs, dev },
              ]);
              session.start(); // setups run once per session, after the doc is on its way
            }
          }
          continue;
        }
        session?.handleFrame(frame);
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      session?.detach();
    });
  });

  await new Promise<void>((r) => server.listen(port, r));
  const addr = server.address();
  const boundPort = addr && typeof addr === "object" ? addr.port : port;
  const url = `http://localhost:${boundPort}/`;
  if (!(opts?.quiet || process.env["KNOBKIT_QUIET"])) console.log(`\n  knobkit  →  ${url}\n`);

  return {
    url,
    stop: async () => {
      clearInterval(sweep);
      await vite?.close();
      await new Promise<void>((r) => {
        wss.clients.forEach((c) => c.terminate());
        wss.close(() => server.close(() => r()));
      });
    },
  };
}
