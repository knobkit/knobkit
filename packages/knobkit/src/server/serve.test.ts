import { test, expect } from "vitest";
import { io } from "socket.io-client";
import { knobkit } from "../lib/knobkit.js";
import { serve } from "./serve.js";
import { audio, chat, text } from "../lib/widgets/index.js";

test("serve runs handlers: reads via ack, applies via edit, brackets with busy", async () => {
  const convo = chat();
  const app = knobkit({ widgets: [convo] }).on(
    convo.sent,
    convo.busy(async ({ text }: { text: string }) => {
      const history = await convo.history(); // pulled from the client (one attribute)
      convo.say({ role: "user", content: text });
      convo.say({ role: "assistant", content: `[${history.length}] ${text}` });
    }),
  );
  const key = app.keyFor(convo);
  const server = await serve(app, { port: 0 });
  const socket = io(server.url, { path: "/socket.io/", transports: ["websocket"], reconnection: false });

  // act as the browser: answer reads from a local state, collect inbound edits/busies
  const state: Record<string, any> = { [key]: { messages: [{ role: "user", content: "hi" }] } };
  socket.on("read", ({ key, path }: { key: string; path: (string | number)[] }, ack: (v: unknown) => void) => {
    let node: any = state[key];
    for (const p of path) node = node?.[p];
    ack(node);
  });
  const edits: any[] = [];
  const busies: any[] = [];
  socket.on("edit", (m) => edits.push(m));

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 8000);
      socket.on("busy", (m: { key: string; value: boolean }) => {
        busies.push(m);
        if (m.key === key && m.value === false) {
          clearTimeout(timer);
          resolve();
        }
      });
      socket.on("connect", () => socket.emit("request", { type: convo.sent.type, payload: { text: "hi" } }));
    });
    expect(busies).toEqual([
      { key, value: true },
      { key, value: false },
    ]);
    expect(edits).toEqual([
      { key, op: "append", path: ["messages"], value: { role: "user", content: "hi" } },
      { key, op: "append", path: ["messages"], value: { role: "assistant", content: "[1] hi" } },
    ]);
  } finally {
    socket.disconnect();
    await server.stop();
  }
});

test("serve serves the decl (with serverEvents) and host html", async () => {
  const box = text({ placeholder: "hi" });
  const app = knobkit({ title: "T", widgets: [box] }).on(box.changed, () => {});
  const server = await serve(app, { port: 0 });
  try {
    const decl = await (await fetch(`${server.url}api/decl`)).json();
    expect(decl.title).toBe("T");
    const rootDecl = decl.widgets.find((w: any) => w.key === decl.root);
    expect(rootDecl.type).toBe("col");
    expect(rootDecl.state.items).toEqual([app.keyFor(box)]);
    const boxDecl = decl.widgets.find((w: any) => w.type === "text");
    expect(boxDecl.key).toBe(app.keyFor(box));
    expect(boxDecl.state).toEqual({ value: "" });
    expect(boxDecl.events.changed).toBe(box.changed.type);
    expect(decl.serverEvents).toContain(box.changed.type);
    const home = await (await fetch(server.url)).text();
    expect(home).toContain('<div id="root">');
  } finally {
    await server.stop();
  }
});

test("the handler pulls only what it reads — a large output (audio) never crosses the wire", async () => {
  const convo = chat();
  const spoken = audio();
  const app = knobkit({ widgets: [convo, spoken] }).on(convo.sent, async ({ text }: { text: string }) => {
    const history = await convo.history(); // reads the conversation only
    convo.say({ role: "user", content: text });
    convo.say({ role: "assistant", content: `[${history.length}] ${text}` });
  });
  const convoKey = app.keyFor(convo);
  const spokenKey = app.keyFor(spoken);
  const server = await serve(app, { port: 0 });
  const socket = io(server.url, { path: "/socket.io/", transports: ["websocket"], reconnection: false });

  // client state where `spoken` holds a huge audio data URL — the kind that used to crash the socket
  const state: Record<string, any> = { [convoKey]: { messages: [] }, [spokenKey]: { src: "x".repeat(2_000_000) } };
  const reads: string[] = [];
  socket.on("read", ({ key, path }: { key: string; path: (string | number)[] }, ack: (v: unknown) => void) => {
    reads.push(key);
    let node: any = state[key];
    for (const p of path) node = node?.[p];
    ack(node);
  });

  try {
    const replied = await new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 8000);
      socket.on("edit", (m: { value?: { content?: string } }) => {
        if (m.value?.content === "[0] hi") {
          clearTimeout(timer);
          resolve(true);
        }
      });
      socket.on("connect", () => socket.emit("request", { type: convo.sent.type, payload: { text: "hi" } }));
    });
    expect(replied).toBe(true);
    expect(reads).toContain(convoKey); // it pulled the conversation
    expect(reads).not.toContain(spokenKey); // it never pulled (or shipped) the audio
  } finally {
    socket.disconnect();
    await server.stop();
  }
});
