import { expect, test, vi } from "vitest";
import { connect as netConnect } from "node:net";
import { io, type Socket } from "socket.io-client";
import { knobkit } from "../lib/knobkit.js";
import { audio, button, chat, text } from "../lib/widgets/index.js";
import { serve } from "./serve.js";
import type { KnobkitServer } from "../lib/types.js";
import type { Path } from "../lib/bound.js";

function connect(url: string): Socket {
  return io(url, { path: "/socket.io/", transports: ["websocket"], reconnection: false });
}

function withTimeout<T>(run: (resolve: (value: T) => void, reject: (err: Error) => void) => void, ms = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    run(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function readPath(state: Record<string, any>, key: string, path: Path): unknown {
  let node: any = state[key];
  for (const p of path) node = node?.[p as keyof typeof node];
  return node;
}

function rawHttpStatus(url: string, path: string): Promise<number> {
  const { hostname, port } = new URL(url);
  return new Promise((resolve, reject) => {
    let data = "";
    const socket = netConnect(Number(port), hostname, () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
    });
    socket.on("error", reject);
    socket.on("end", () => {
      const status = Number(data.match(/^HTTP\/1\.1 (\d+)/)?.[1]);
      Number.isFinite(status) ? resolve(status) : reject(new Error(`no HTTP status in response: ${data}`));
    });
  });
}

function connected(socket: Socket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return withTimeout<void>((resolve) => {
    socket.on("connect", () => resolve());
  });
}

async function stop(server: KnobkitServer, socket?: Socket): Promise<void> {
  socket?.disconnect();
  await server.stop();
}

test("serve executes handlers through read/edit/enable/busy and emits returned events for client re-entry", async () => {
  const convo = chat();
  const relay = text();
  const app = knobkit({ widgets: [convo, relay] })
    .on(
      convo.sent,
      convo.busy(async ({ text }: { text: string }) => {
        convo.disable();
        const history = await convo.history();
        convo.say({ role: "user", content: text });
        convo.enable();
        return relay.changed(String(history.length));
      }),
    )
    .on(relay.changed, (count: string) => {
      convo.say({ role: "assistant", content: `followed:${count}` });
    });
  const convoKey = app.keyFor(convo);
  const server = await serve(app, { port: 0, quiet: true });
  const socket = connect(server.url);
  const state: Record<string, any> = { [convoKey]: { messages: [{ role: "user", content: "before" }] } };
  const reads: Array<{ key: string; path: Path }> = [];
  const edits: any[] = [];
  const busies: any[] = [];
  const enables: any[] = [];
  const returned: any[] = [];

  socket.on("read", ({ key, path }: { key: string; path: Path }, ack: (value: unknown) => void) => {
    reads.push({ key, path });
    ack(readPath(state, key, path));
  });
  socket.on("edit", (m) => {
    edits.push(m);
    if (m.op === "append") {
      const target = readPath(state, m.key, m.path) as unknown[];
      target.push(m.value);
    }
  });
  socket.on("busy", (m) => busies.push(m));
  socket.on("enable", (m) => enables.push(m));
  socket.on("emit", (m) => {
    returned.push(m);
    socket.emit("request", m);
  });

  try {
    await withTimeout<void>((resolve) => {
      socket.on("edit", (m: { value?: { content?: string } }) => {
        if (m.value?.content === "followed:1") resolve();
      });
      socket.on("connect", () => socket.emit("request", { type: convo.sent.type, payload: { text: "hi" } }));
    });

    expect(reads).toEqual([{ key: convoKey, path: ["messages"] }]);
    expect(busies).toEqual([
      { key: convoKey, value: true },
      { key: convoKey, value: false },
    ]);
    expect(enables).toEqual([
      { key: convoKey, value: false },
      { key: convoKey, value: true },
    ]);
    expect(returned).toEqual([{ type: relay.changed.type, payload: "1" }]);
    expect(edits).toEqual([
      { key: convoKey, op: "append", path: ["messages"], value: { role: "user", content: "hi" } },
      { key: convoKey, op: "append", path: ["messages"], value: { role: "assistant", content: "followed:1" } },
    ]);
  } finally {
    await stop(server, socket);
  }
});

test("serve exposes a complete declaration and host routes with app-level document attributes", async () => {
  const box = text({ placeholder: "hi" });
  const app = knobkit({
    title: "T",
    loading: "Loading shell",
    theme: "dark",
    density: "sm",
    fill: true,
    widgets: [box],
  }).on(box.changed, () => {});
  const server = await serve(app, { port: 0, quiet: true });
  try {
    const declRes = await fetch(`${server.url}api/decl`);
    expect(declRes.headers.get("content-type")).toContain("application/json");
    const decl = await declRes.json();
    expect(decl).toMatchObject({ title: "T", theme: "dark", density: "sm", fill: true });
    const rootDecl = decl.widgets.find((w: any) => w.key === decl.root);
    const boxDecl = decl.widgets.find((w: any) => w.type === "text");
    expect(rootDecl.state.items).toEqual([app.keyFor(box)]);
    expect(boxDecl).toMatchObject({
      key: app.keyFor(box),
      state: { value: "" },
      props: { placeholder: "hi", lines: 1 },
      events: { changed: box.changed.type },
    });
    expect(decl.serverEvents).toEqual([box.changed.type]);

    const homeRes = await fetch(server.url);
    expect(homeRes.headers.get("content-type")).toContain("text/html");
    const home = await homeRes.text();
    expect(home).toContain('<html lang="en" data-theme="dark" data-density="sm" data-fill>');
    expect(home).toContain("<title>T</title>");
    expect(home).toContain('<div id="root">Loading shell</div>');
    expect(home).toContain('<script type="module" src="/client.js"></script>');

    const missing = await fetch(`${server.url}missing`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Not found");

    const missingAsset = await fetch(`${server.url}assets/no-such-chunk.js`);
    expect(missingAsset.status).toBe(404);
    expect(await missingAsset.text()).toBe("Not found");
    expect(await rawHttpStatus(server.url, "/assets/../client.js")).toBe(403);
  } finally {
    await server.stop();
  }
});

test("handlers pull only the widget state they explicitly read", async () => {
  const convo = chat();
  const spoken = audio();
  const app = knobkit({ widgets: [convo, spoken] }).on(convo.sent, async ({ text }: { text: string }) => {
    const history = await convo.history();
    convo.say({ role: "assistant", content: `[${history.length}] ${text}` });
  });
  const convoKey = app.keyFor(convo);
  const spokenKey = app.keyFor(spoken);
  const server = await serve(app, { port: 0, quiet: true });
  const socket = connect(server.url);
  const state: Record<string, any> = { [convoKey]: { messages: [] }, [spokenKey]: { src: "x".repeat(2_000_000) } };
  const reads: Array<{ key: string; path: Path }> = [];

  socket.on("read", ({ key, path }: { key: string; path: Path }, ack: (value: unknown) => void) => {
    reads.push({ key, path });
    ack(readPath(state, key, path));
  });

  try {
    await withTimeout<void>((resolve) => {
      socket.on("edit", (m: { value?: { content?: string } }) => {
        if (m.value?.content === "[0] hi") resolve();
      });
      socket.on("connect", () => socket.emit("request", { type: convo.sent.type, payload: { text: "hi" } }));
    });
    expect(reads).toEqual([{ key: convoKey, path: ["messages"] }]);
    expect(reads.some((r) => r.key === spokenKey)).toBe(false);
  } finally {
    await stop(server, socket);
  }
});

test("serve ignores malformed requests and restores Buffer payloads to Float32Array", async () => {
  const convo = chat();
  const app = knobkit({ widgets: [convo] }).on(convo.recorded, (pcm: Float32Array) => {
    convo.say({ role: "user", content: `${pcm.constructor.name}:${pcm.length}:${pcm[0].toFixed(2)}` });
  });
  const key = app.keyFor(convo);
  const server = await serve(app, { port: 0, quiet: true });
  const socket = connect(server.url);
  const edits: any[] = [];
  socket.on("edit", (m) => edits.push(m));

  try {
    await withTimeout<void>((resolve) => {
      socket.on("connect", () => {
        socket.emit("request", null);
        socket.emit("request", { type: 123, payload: "bad" });
        const pcm = new Float32Array([0.25, 0.5]);
        socket.emit("request", { type: convo.recorded.type, payload: Buffer.from(pcm.buffer) });
      });
      socket.on("edit", (m: { value?: { content?: string } }) => {
        if (m.value?.content === "Float32Array:2:0.25") resolve();
      });
    });
    expect(edits).toEqual([
      {
        key,
        op: "append",
        path: ["messages"],
        value: { role: "user", content: "Float32Array:2:0.25" },
      },
    ]);
  } finally {
    await stop(server, socket);
  }
});

test("serve runs setup functions for each browser connection with bound edit and enable controls", async () => {
  const box = text();
  const app = knobkit({ widgets: [box] }).setup(() => {
    box.set("ready");
    box.disable();
  });
  const key = app.keyFor(box);
  const server = await serve(app, { port: 0, quiet: true });
  const first = connect(server.url);
  const second = connect(server.url);
  const seen: any[] = [];

  for (const socket of [first, second]) {
    socket.on("edit", (m) => seen.push({ socket: socket.id, ...m }));
    socket.on("enable", (m) => seen.push({ socket: socket.id, ...m }));
  }

  try {
    await withTimeout<void>((resolve) => {
      const check = () => {
        const edits = seen.filter((m) => m.op === "set");
        const enables = seen.filter((m) => "value" in m && m.key === key && m.value === false);
        if (edits.length === 2 && enables.length === 2) resolve();
      };
      first.on("edit", check);
      first.on("enable", check);
      second.on("edit", check);
      second.on("enable", check);
    });

    expect(seen.filter((m) => m.op === "set")).toEqual([
      expect.objectContaining({ key, op: "set", path: ["value"], value: "ready" }),
      expect.objectContaining({ key, op: "set", path: ["value"], value: "ready" }),
    ]);
    expect(seen.filter((m) => m.key === key && m.value === false)).toEqual([
      expect.objectContaining({ key, value: false }),
      expect.objectContaining({ key, value: false }),
    ]);
  } finally {
    first.disconnect();
    await stop(server, second);
  }
});

test("serve clears busy state and keeps the socket usable when a handler throws", async () => {
  const convo = chat();
  const ping = button({ label: "Ping" });
  const app = knobkit({ widgets: [convo, ping] })
    .on(
      convo.sent,
      convo.busy(async () => {
        throw new Error("handler failed");
      }),
    )
    .on(ping.clicked, () => {
      convo.say({ role: "assistant", content: "socket-alive" });
    });
  const key = app.keyFor(convo);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const server = await serve(app, { port: 0, quiet: true });
  const socket = connect(server.url);
  const busies: any[] = [];
  const edits: any[] = [];
  socket.on("busy", (m) => busies.push(m));
  socket.on("edit", (m) => edits.push(m));

  try {
    await withTimeout<void>((resolve) => {
      socket.on("busy", (m: { key: string; value: boolean }) => {
        if (m.key === key && m.value === false) resolve();
      });
      socket.on("connect", () => socket.emit("request", { type: convo.sent.type, payload: { text: "boom" } }));
    });
    expect(busies).toEqual([
      { key, value: true },
      { key, value: false },
    ]);
    expect(edits).toEqual([]);
    expect(errorSpy).toHaveBeenCalledOnce();

    await withTimeout<void>((resolve) => {
      socket.on("edit", (m: { value?: { content?: string } }) => {
        if (m.value?.content === "socket-alive") resolve();
      });
      socket.emit("request", { type: ping.clicked.type, payload: undefined });
    });
    expect(edits).toEqual([
      { key, op: "append", path: ["messages"], value: { role: "assistant", content: "socket-alive" } },
    ]);
  } finally {
    errorSpy.mockRestore();
    await stop(server, socket);
  }
});

test("serve keeps concurrent socket read contexts isolated", async () => {
  const convo = chat();
  const app = knobkit({ widgets: [convo] }).on(convo.sent, async ({ text }: { text: string }) => {
    const history = await convo.history();
    convo.say({ role: "assistant", content: `[${history.length}] ${text}` });
  });
  const key = app.keyFor(convo);
  const server = await serve(app, { port: 0, quiet: true });
  const first = connect(server.url);
  const second = connect(server.url);
  const firstState = { [key]: { messages: [{ role: "user", content: "one" }] } };
  const secondState = {
    [key]: {
      messages: [
        { role: "user", content: "one" },
        { role: "assistant", content: "two" },
        { role: "user", content: "three" },
      ],
    },
  };
  const reads: Array<{ client: string; key: string; path: Path }> = [];

  first.on("read", ({ key, path }: { key: string; path: Path }, ack: (value: unknown) => void) => {
    reads.push({ client: "first", key, path });
    setTimeout(() => ack(readPath(firstState, key, path)), 20);
  });
  second.on("read", ({ key, path }: { key: string; path: Path }, ack: (value: unknown) => void) => {
    reads.push({ client: "second", key, path });
    ack(readPath(secondState, key, path));
  });

  try {
    await Promise.all([connected(first), connected(second)]);
    const firstEdit = withTimeout<any>((resolve) => {
      first.on("edit", (m: { value?: { content?: string } }) => {
        if (m.value?.content === "[1] alpha") resolve(m);
      });
    });
    const secondEdit = withTimeout<any>((resolve) => {
      second.on("edit", (m: { value?: { content?: string } }) => {
        if (m.value?.content === "[3] beta") resolve(m);
      });
    });

    first.emit("request", { type: convo.sent.type, payload: { text: "alpha" } });
    second.emit("request", { type: convo.sent.type, payload: { text: "beta" } });

    await expect(Promise.all([firstEdit, secondEdit])).resolves.toEqual([
      { key, op: "append", path: ["messages"], value: { role: "assistant", content: "[1] alpha" } },
      { key, op: "append", path: ["messages"], value: { role: "assistant", content: "[3] beta" } },
    ]);
    expect(reads).toEqual(
      expect.arrayContaining([
        { client: "first", key, path: ["messages"] },
        { client: "second", key, path: ["messages"] },
      ]),
    );
  } finally {
    first.disconnect();
    await stop(server, second);
  }
});
