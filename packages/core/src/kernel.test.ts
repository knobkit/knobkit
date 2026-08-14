import { describe, expect, test } from "vitest";
import { knobkit } from "./app.js";
import type { App } from "./app.js";
import { createReadBatcher } from "./context.js";
import type { Bound } from "./context.js";
import { createDispatcher } from "./dispatch.js";
import { reduceAll } from "./doc.js";
import type { Doc } from "./types.js";
import { createOutbox } from "./outbox.js";
import { readAt } from "./path.js";
import { defineWidget, idOf, spawnTree } from "./widget.js";
import { t } from "./schema.js";
import type { StandardSchemaV1 } from "./schema.js";

// ---- test widgets (registered once per type across the file) ----

const text = defineWidget({
  type: "text",
  state: { value: { initial: "" } },
  props: { placeholder: { default: "" } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({ set: at("value").op("set"), clear: at("value").op("set", "") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
});

type Message = { role: string; content: string };
const chat = defineWidget({
  type: "chat",
  state: { messages: { initial: [] as Message[] } },
  props: { placeholder: { default: "" } },
  events: { sent: { payload: t<{ text: string }>() } },
  channels: { clip: { policy: "latest", data: t<Float32Array>() } },
  ops: (at) => ({
    say: at("messages").op("append"),
    append: at("messages", -1, "content").op("appendText"),
    clear: at("messages").op("set", []),
  }),
  methods: (self) => ({ history: () => self.at("messages").get() }),
});

const col = defineWidget({ type: "col", state: { items: { initial: [] as string[] } } });

// ---- a mount-like realm: local doc, local bound, real outbox + dispatcher ----

function realm(app: App) {
  let doc: Doc = structuredClone(app.declare());
  const notes: Array<{ level: string; message: string }> = [];
  const spans = new Map<string, number>();
  let corrN = 0;
  let spawnN = 0;

  const outbox = createOutbox((bodies) => {
    for (const b of bodies) if (b.kind === "edit") doc = reduceAll(doc, b.edits);
  });

  const makeBound = (corr: string, snap?: Map<string, unknown>): Bound => {
    const readOne = createReadBatcher(async (targets) => {
      outbox.flush(); // read barrier
      return targets.map(([id, path]) => readAt(doc.instances[id]?.state, path));
    });
    return {
      session: "s1",
      corr,
      snap,
      spans,
      read: (targets) => Promise.all(targets.map((target) => readOne(target))),
      edit: (e) => outbox.edit(corr, e),
      mintId: () => `#s${spawnN++}`,
      spawn(inst) {
        const id = this.mintId();
        this.edit([id, "instanceAdd", [], inst]);
        return id;
      },
      dispose: (id) => outbox.edit(corr, [id, "instanceRemove", []]),
      note: (level, message) => notes.push({ level, message }),
    };
  };

  const dispatcher = createDispatcher(app, {
    session: "s1",
    makeBound,
    note: (level, message) => notes.push({ level, message }),
    gated: (id) => {
      const s = doc.instances[id]?.state;
      return s ? s["$enabled"] === false || s["$busy"] === true : undefined;
    },
  });

  return {
    dispatcher,
    notes,
    outbox,
    corr: () => `c${corrN++}`,
    doc: () => doc,
    state: (id: string) => doc.instances[id]!.state,
    flushAll: async () => {
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 0));
        outbox.flush();
      }
    },
  };
}

describe("declare walk", () => {
  test("ids in tree order, uniform seeding, nested handles lowered, #app root", () => {
    const input = text({ placeholder: "Label", value: "seeded" });
    const convo = chat();
    const app = knobkit({ title: "T", widgets: [input, convo] });
    const doc = app.declare();

    expect(idOf(input)).toBe("#1"); // #0 = the implicit col
    expect(idOf(convo)).toBe("#2");
    expect(doc.instances["#0"]).toMatchObject({ type: "col", state: { items: ["#1", "#2"] } });
    expect(doc.instances["#1"]).toMatchObject({
      type: "text",
      props: { placeholder: "Label" },
      state: { value: "seeded", $enabled: true, $busy: false },
    });
    expect(doc.instances["#app"]!.state).toMatchObject({ root: "#0", title: "T" });
  });

  test("unknown factory options throw with the valid names", () => {
    expect(() => text({ placehlder: "x" } as never)).toThrow(/placehlder.*placeholder/s);
  });

  test("a handle can only join one app", () => {
    const w = text();
    knobkit({ widgets: w }).declare();
    expect(() => knobkit({ widgets: w }).declare()).toThrow(/already part/);
  });
});

describe("handlers: ops, lenses, RYOW, busy", () => {
  test("generated ops write; methods read-your-own-writes through the queue", async () => {
    const convo = chat();
    const done = Promise.withResolvers<Message[]>();
    const app = knobkit({ widgets: convo });
    app.on(convo.sent, async ({ text: said }) => {
      convo.say({ role: "user", content: said });
      convo.say({ role: "assistant", content: "" });
      convo.append("hi there");
      done.resolve(await convo.history()); // must observe the un-flushed writes above
    });

    const r = realm(app);
    r.dispatcher.dispatchEvent(idOf(convo), "sent", { text: "yo" }, r.corr());
    expect(await done.promise).toEqual([
      { role: "user", content: "yo" },
      { role: "assistant", content: "hi there" },
    ]);
  });

  test("busy(fn) brackets $busy; chained same-corr handlers keep the net span coherent", async () => {
    const convo = chat();
    const input = text();
    const app = knobkit({ widgets: [convo, input] });
    const seen: boolean[] = [];
    app.on(
      input.changed,
      convo.busy(async () => {
        await new Promise((r) => setTimeout(r, 5));
        seen.push(true);
        return convo.sent({ text: "chained" });
      }),
    );
    app.on(
      convo.sent,
      convo.busy(async () => {
        seen.push(true);
      }),
    );

    const r = realm(app);
    r.dispatcher.dispatchEvent(idOf(input), "changed", "go", r.corr());
    await r.flushAll();
    expect(seen).toHaveLength(2);
    expect(r.state(idOf(convo))["$busy"]).toBe(false); // span fully closed at the end
  });

  test("spawnTree adds instances children-first and containers can reference them", async () => {
    const panel = col();
    const app = knobkit({ widgets: panel });
    const done = Promise.withResolvers<void>();
    app.setup(() => {
      const w = text({ value: "spawned" });
      const id = spawnTree(w);
      panel.at("items").append(id);
      done.resolve();
    });

    const r = realm(app);
    await r.dispatcher.runSetups(r.corr());
    await done.promise;
    await r.flushAll();
    const items = r.state(idOf(panel))["items"] as string[];
    expect(items).toHaveLength(1);
    expect(r.state(items[0]!)["value"]).toBe("spawned");
  });
});

describe("dispatch policies", () => {
  function policyApp(policy: "serial" | "concurrent" | "latest" | "queue" | undefined, delayMs: number) {
    const input = text();
    const log: string[] = [];
    const app = knobkit({ widgets: input });
    app.on(
      input.changed,
      async (v) => {
        log.push(`start ${v}`);
        await new Promise((r) => setTimeout(r, delayMs));
        log.push(`end ${v}`);
      },
      policy ? { policy } : undefined,
    );
    return { input, log, app };
  }

  test("serial (default): FIFO, one at a time", async () => {
    const { input, log, app } = policyApp(undefined, 5);
    const r = realm(app);
    for (const v of ["a", "b"]) r.dispatcher.dispatchEvent(idOf(input), "changed", v, r.corr());
    await new Promise((res) => setTimeout(res, 40));
    expect(log).toEqual(["start a", "end a", "start b", "end b"]);
  });

  test("concurrent: overlapping runs", async () => {
    const { input, log, app } = policyApp("concurrent", 5);
    const r = realm(app);
    for (const v of ["a", "b"]) r.dispatcher.dispatchEvent(idOf(input), "changed", v, r.corr());
    await new Promise((res) => setTimeout(res, 40));
    expect(log).toEqual(["start a", "start b", "end a", "end b"]);
  });

  test("latest: intermediate payloads skipped, newest runs", async () => {
    const { input, log, app } = policyApp("latest", 10);
    const r = realm(app);
    for (const v of ["a", "b", "c"]) r.dispatcher.dispatchEvent(idOf(input), "changed", v, r.corr());
    await new Promise((res) => setTimeout(res, 60));
    expect(log).toEqual(["start a", "end a", "start c", "end c"]);
  });

  test("chan latest: frames during a running handler are dropped, no note", async () => {
    const convo = chat();
    const log: number[] = [];
    const app = knobkit({ widgets: convo });
    app.on(convo.clip, async (samples) => {
      log.push((samples as Float32Array).length);
      await new Promise((r) => setTimeout(r, 15));
    });
    const r = realm(app);
    r.dispatcher.dispatchChan(idOf(convo), "clip", new Float32Array(1), r.corr());
    r.dispatcher.dispatchChan(idOf(convo), "clip", new Float32Array(2), r.corr());
    r.dispatcher.dispatchChan(idOf(convo), "clip", new Float32Array(3), r.corr());
    await new Promise((res) => setTimeout(res, 40));
    expect(log).toEqual([1]);
    expect(r.notes).toHaveLength(0);
  });
});

describe("snapshots, gate, validation", () => {
  test("snapshot: get() resolves from the emit-time snapshot, immune to later edits", async () => {
    const input = text({ value: "at-emit" });
    const other = text();
    const app = knobkit({ widgets: [input, other] });
    const done = Promise.withResolvers<string>();
    app.on(
      other.changed,
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        done.resolve(await input.at("value").get());
      },
      { snap: [input.at("value")] },
    );

    const r = realm(app);
    const snap: [string, (string | number)[], unknown][] = [[idOf(input), ["value"], "at-emit"]];
    r.dispatcher.dispatchEvent(idOf(other), "changed", "x", r.corr(), snap);
    // an edit lands between emit and the handler's read — the snapshot must win
    r.doc().instances[idOf(input)]!.state["value"] = "changed-later";
    expect(await done.promise).toBe("at-emit");
  });

  test("gated source → handler skipped + note{drop}; gate:false subscription still runs", async () => {
    const input = text();
    const app = knobkit({ widgets: input });
    const runs: string[] = [];
    app.on(input.changed, () => void runs.push("gated"));
    app.on(input.changed, () => void runs.push("ungated"), { gate: false });

    const r = realm(app);
    r.doc().instances[idOf(input)]!.state["$enabled"] = false;
    r.dispatcher.dispatchEvent(idOf(input), "changed", "x", r.corr());
    await new Promise((res) => setTimeout(res, 10));
    expect(runs).toEqual(["ungated"]);
    expect(r.notes.some((n) => n.level === "drop")).toBe(true);
  });

  test("schema validation failure → note{error}, handler not called", async () => {
    const numberOnly: StandardSchemaV1<number> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v) => (typeof v === "number" ? { value: v } : { issues: [{ message: "expected number" }] }),
      },
    };
    const gauge = defineWidget({
      type: "gauge",
      state: { value: { initial: 0 } },
      events: { adjusted: { payload: numberOnly } },
    });
    const g = gauge();
    const app = knobkit({ widgets: g });
    const runs: unknown[] = [];
    app.on(g.adjusted, (v) => void runs.push(v));

    const r = realm(app);
    r.dispatcher.dispatchEvent(idOf(g), "adjusted", "not-a-number", r.corr());
    r.dispatcher.dispatchEvent(idOf(g), "adjusted", 5, r.corr());
    await new Promise((res) => setTimeout(res, 10));
    expect(runs).toEqual([5]);
    expect(r.notes.some((n) => n.level === "error" && /expected number/.test(n.message))).toBe(true);
  });

  test("handler throw → note{error} with stack", async () => {
    const input = text();
    const app = knobkit({ widgets: input });
    app.on(input.changed, () => {
      throw new Error("boom");
    });
    const r = realm(app);
    r.dispatcher.dispatchEvent(idOf(input), "changed", "x", r.corr());
    await new Promise((res) => setTimeout(res, 10));
    expect(r.notes.some((n) => n.level === "error" && n.message === "boom")).toBe(true);
  });

  test("returned event re-dispatches with the same corr", async () => {
    const input = text();
    const convo = chat();
    const app = knobkit({ widgets: [input, convo] });
    const corrs: string[] = [];
    app.on(input.changed, (v, ctx) => {
      corrs.push(ctx!.corr);
      return convo.sent({ text: String(v) });
    });
    app.on(convo.sent, (_p, ctx) => {
      corrs.push(ctx!.corr);
    });
    const r = realm(app);
    r.dispatcher.dispatchEvent(idOf(input), "changed", "x", "c42");
    await new Promise((res) => setTimeout(res, 10));
    expect(corrs).toEqual(["c42", "c42"]);
  });
});

describe("defineWidget validation", () => {
  test("prop/state name overlap throws", () => {
    expect(() =>
      defineWidget({ type: "clash", state: { value: { initial: "" } }, props: { value: { default: "" } } }),
    ).toThrow(/both a prop and a state attr/);
  });

  test("duplicate type with different definition throws; same shape is fine", () => {
    defineWidget({ type: "dupe", state: { a: { initial: 1 } } });
    expect(() => defineWidget({ type: "dupe", state: { a: { initial: 2 } } })).not.toThrow();
    expect(() => defineWidget({ type: "dupe", state: { b: { initial: 1 } } })).toThrow(/already registered/);
  });

  test("bad type names rejected", () => {
    expect(() => defineWidget({ type: "Nope", state: {} })).toThrow(/invalid widget type/);
    expect(() => defineWidget({ type: "my-pkg/fancy", state: {} })).not.toThrow();
  });
});
