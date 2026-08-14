import { afterAll, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { knobkit } from "../app.js";
import { decode, encode } from "../codec.js";
import type { Frame } from "../protocol.js";
import { defineWidget } from "../widget.js";
import { serveApp } from "./serve.js";

const beacon = defineWidget({ type: "beacon", state: { on: { initial: false } } });

const cwd = process.cwd();
const dir = mkdtempSync(join(tmpdir(), "pu-serve-"));
mkdirSync(join(dir, "dist/client"), { recursive: true });
writeFileSync(join(dir, "dist/client/entry.js"), "// stub client bundle for tests\n");
process.chdir(dir);

const app = knobkit({ title: "T&C", widgets: beacon() });
const serverPromise = serveApp(app, { port: 0, quiet: true, heartbeatMs: 40 });

afterAll(async () => {
  const server = await serverPromise;
  await server.stop();
  process.chdir(cwd);
});

const openSocket = async (url: string): Promise<WebSocket> => {
  const ws = new WebSocket(url.replace("http", "ws") + "__pu");
  ws.binaryType = "arraybuffer";
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return ws;
};

describe("serveApp", () => {
  test("serves HTML with theme attrs and escapes nothing it shouldn't", async () => {
    const { url } = await serverPromise;
    const html = await (await fetch(url)).text();
    expect(html).toContain("<title>T&C</title>");
    expect(html).toContain('<div id="root">');
    expect(html).toContain("/__app/entry.js");
  });

  test("media POST → GET round-trip", async () => {
    const { url } = await serverPromise;
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const post = await fetch(`${url}__media/test-1`, {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: bytes,
    });
    expect(post.status).toBe(204);
    const got = await fetch(`${url}__media/test-1`);
    expect(got.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes);
    expect((await fetch(`${url}__media/nope`)).status).toBe(404);
  });

  test("hello → welcome carries session, doc and subs", async () => {
    const { url } = await serverPromise;
    const ws = await openSocket(url);
    const welcome = new Promise<Frame>((resolve) => {
      ws.onmessage = (ev) => {
        for (const f of decode(new Uint8Array(ev.data as ArrayBuffer)) as Frame[]) {
          if (f.kind === "sys" && f.op === "welcome") resolve(f);
          if (f.kind === "sys" && f.op === "ping") {
            ws.send(encode([{ seq: -1, ack: 0, kind: "sys", op: "pong" }]) as Uint8Array<ArrayBuffer>);
          }
        }
      };
    });
    ws.send(encode([{ seq: -1, ack: 0, kind: "sys", op: "hello" }]) as Uint8Array<ArrayBuffer>);
    const frame = await welcome;
    if (frame.kind !== "sys" || frame.op !== "welcome") throw new Error("unreachable");
    expect(frame.session).toBeTruthy();
    expect(frame.doc.instances["#app"]).toBeTruthy();
    expect(frame.doc.instances["#0"]!.type).toBe("beacon");
    ws.close();
  });

  test("heartbeat: a client that never pongs is terminated; a ponging one survives", async () => {
    const { url } = await serverPromise;
    const silent = await openSocket(url);
    const closed = new Promise<void>((resolve) => (silent.onclose = () => resolve()));
    await Promise.race([
      closed,
      new Promise((_, reject) => setTimeout(() => reject(new Error("not closed")), 1500)),
    ]);

    const polite = await openSocket(url);
    let alive = true;
    polite.onclose = () => (alive = false);
    polite.onmessage = (ev) => {
      for (const f of decode(new Uint8Array(ev.data as ArrayBuffer)) as Frame[]) {
        if (f.kind === "sys" && f.op === "ping") {
          polite.send(encode([{ seq: -1, ack: 0, kind: "sys", op: "pong" }]) as Uint8Array<ArrayBuffer>);
        }
      }
    };
    await new Promise((r) => setTimeout(r, 300));
    expect(alive).toBe(true);
    polite.close();
  });
});
