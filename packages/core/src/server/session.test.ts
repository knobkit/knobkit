import { afterEach, describe, expect, test, vi } from "vitest";
import { knobkit } from "../app.js";
import type { App } from "../app.js";
import { decode } from "../codec.js";
import { createLink } from "../protocol.js";
import type { Frame } from "../protocol.js";
import { createStore } from "../client/store.js";
import { defineWidget, idOf } from "../widget.js";
import { t } from "../schema.js";
import { installNodeContext } from "./context.js";
import { createSession } from "./session.js";
import type { Session, SessionConn } from "./session.js";

installNodeContext();

const feed = defineWidget({
  type: "feed",
  state: { lines: { initial: [] as string[] }, value: { initial: "" } },
  events: { poked: { payload: t<string>() } },
  ops: (at) => ({ push: at("lines").op("append"), set: at("value").op("set") }),
  methods: (self) => ({ all: () => self.at("lines").get() }),
});

// A protocol-faithful in-memory client: applies edit frames to a real client store, answers reads,
// dedups via its own link — what socket.ts does minus WebSocket/DOM. `online=false` models frames
// lost in flight after a connection drop.
function fakeClient(app: App) {
  const store = createStore(structuredClone(app.declare()));
  const link = createLink();
  const received: Frame[] = [];
  let session: Session | null = null;
  let online = true;

  const conn: SessionConn = {
    send(bytes: Uint8Array) {
      if (!online) return;
      for (const frame of decode(bytes) as Frame[]) {
        received.push(frame);
        link.onAck(frame.ack);
        if (!link.accept(frame)) continue;
        if (frame.kind === "edit") store.apply(frame.edits);
        if (frame.kind === "read") {
          const values = frame.targets.map(([id, path]) => store.readAt(id, path));
          session!.handleFrame(link.stamp({ kind: "result", rid: frame.rid, values }));
        }
      }
    },
  };

  return {
    store,
    link,
    received,
    conn,
    bind: (s: Session) => (session = s),
    setOnline: (v: boolean) => (online = v),
    sendEvent(src: string, name: string, payload: unknown, corr: string) {
      session!.handleFrame(link.stamp({ kind: "event", corr, src, name, payload }));
    },
  };
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  vi.useRealTimers();
});

describe("session", () => {
  test("event → handler → edits reach the client; reads observe queued writes (RYOW over the wire)", async () => {
    const f = feed();
    const app = knobkit({ widgets: f });
    const observed: string[][] = [];
    app.on(f.poked, async (v) => {
      f.push(`got ${v}`);
      f.push("second");
      observed.push((await f.all()) as string[]); // read barrier must flush both appends first
    });

    const client = fakeClient(app);
    const session = createSession(app, { dev: false });
    client.bind(session);
    session.attach(client.conn, undefined);

    client.sendEvent(idOf(f), "poked", "hello", "c1");
    await tick();

    expect(observed).toEqual([["got hello", "second"]]);
    expect(client.store.readAt(idOf(f), ["lines"])).toEqual(["got hello", "second"]);
  });

  test("resume: frames lost mid-stream are replayed once, in order; setups not rerun", async () => {
    const f = feed();
    const app = knobkit({ widgets: f });
    let setupRuns = 0;
    app.setup(() => {
      setupRuns++;
      f.push("from setup");
    });
    app.on(f.poked, (v) => {
      f.push(String(v));
    });

    const client = fakeClient(app);
    const session = createSession(app, { dev: false });
    client.bind(session);
    session.attach(client.conn, undefined);
    session.start();
    await tick();
    expect(setupRuns).toBe(1);

    client.sendEvent(idOf(f), "poked", "a", "c1");
    await tick();

    // connection dies; the next writes never arrive
    client.setOnline(false);
    session.detach();
    client.sendEvent(idOf(f), "poked", "b", "c2");
    client.sendEvent(idOf(f), "poked", "c", "c3");
    await tick();
    expect(client.store.readAt(idOf(f), ["lines"])).toEqual(["from setup", "a"]);

    // reconnect: hello {session, cursor} → resume + replay of everything past the client cursor
    client.setOnline(true);
    session.attach(client.conn, client.link.cursor());
    await tick();

    expect(client.store.readAt(idOf(f), ["lines"])).toEqual(["from setup", "a", "b", "c"]);
    expect(setupRuns).toBe(1); // per session, not per connection

    // replaying again must not duplicate (link dedup)
    session.attach(client.conn, 0);
    await tick();
    expect(client.store.readAt(idOf(f), ["lines"])).toEqual(["from setup", "a", "b", "c"]);
  });

  test("acks prune the resend buffer", async () => {
    const f = feed();
    const app = knobkit({ widgets: f });
    app.on(f.poked, (v) => {
      f.push(String(v));
    });
    const client = fakeClient(app);
    const session = createSession(app, { dev: false });
    client.bind(session);
    session.attach(client.conn, undefined);

    client.sendEvent(idOf(f), "poked", "a", "c1");
    await tick();
    // the client's next frame carries ack = its cursor; send one to deliver it
    client.sendEvent(idOf(f), "poked", "b", "c2");
    await tick();
    client.sendEvent(idOf(f), "poked", "z", "c3");
    await tick();
    expect(session.link.replayFrom(0).length).toBeLessThanOrEqual(2); // earlier frames acked away
  });

  test("session GC: expired after 5 min detached", () => {
    vi.useFakeTimers();
    const f = feed();
    const app = knobkit({ widgets: f });
    const session = createSession(app, { dev: false });
    session.attach({ send: () => {} }, undefined);
    expect(session.expired()).toBe(false);
    session.detach();
    vi.advanceTimersByTime(4 * 60_000);
    expect(session.expired()).toBe(false);
    vi.advanceTimersByTime(2 * 60_000);
    expect(session.expired()).toBe(true);
  });
});
