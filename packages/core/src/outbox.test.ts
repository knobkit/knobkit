import { describe, expect, test } from "vitest";
import { createOutbox } from "./outbox.js";
import { createLink } from "./protocol.js";
import type { Body, Frame } from "./protocol.js";

const microtasks = () => new Promise<void>((r) => setTimeout(r, 0));
const chanBody = (data: unknown): Extract<Body, { kind: "chan" }> => ({
  kind: "chan",
  corr: "c1",
  src: "#1",
  name: "clip",
  data,
});

describe("outbox", () => {
  test("flush-if-idle: a singleton edit goes out within the current tick", async () => {
    const sent: Body[][] = [];
    const box = createOutbox((b) => sent.push(b));
    box.edit("c1", ["#0", "set", ["value"], "x"]);
    expect(sent).toHaveLength(0); // not synchronous…
    await microtasks();
    expect(sent).toHaveLength(1); // …but within the tick
    expect(sent[0]).toEqual([{ kind: "edit", corr: "c1", edits: [["#0", "set", ["value"], "x"]] }]);
  });

  test("same-tick edits coalesce into one frame", async () => {
    const sent: Body[][] = [];
    const box = createOutbox((b) => sent.push(b));
    for (const tok of ["a", "b", "c"]) box.edit("c1", ["#0", "appendText", ["value"], tok]);
    await microtasks();
    expect(sent).toHaveLength(1);
    expect(sent[0]![0]).toEqual({ kind: "edit", corr: "c1", edits: [["#0", "appendText", ["value"], "abc"]] });
  });

  test("streaming: frames are O(flushes), not O(tokens)", async () => {
    const sent: Body[][] = [];
    let t = 0;
    const box = createOutbox((b) => sent.push(b), { windowMs: 16, now: () => t });
    // 200 tokens arriving 1ms apart: every enqueue advances fake time and yields a macrotask
    for (let i = 0; i < 200; i++) {
      t += 1;
      box.edit("c1", ["#0", "appendText", ["value"], "t"]);
      if (i % 20 === 19) await microtasks(); // let timers run occasionally
    }
    box.flush();
    const frames = sent.flat().length;
    expect(frames).toBeLessThan(30); // 200ms / 16ms ≈ 13 flushes; allow slack
    const total = sent
      .flat()
      .filter((b): b is Extract<Body, { kind: "edit" }> => b.kind === "edit")
      .flatMap((b) => b.edits)
      .reduce((n, e) => n + (e[3] as string).length, 0);
    expect(total).toBe(200); // nothing lost
  });

  test("read barrier: flush() empties the queue synchronously ahead of a read", () => {
    const sent: Body[][] = [];
    const box = createOutbox((b) => sent.push(b));
    box.edit("c1", ["#0", "appendText", ["value"], "hello"]);
    box.push({ kind: "read", corr: "c1", rid: 1, targets: [["#0", ["value"]]] });
    expect(sent).toHaveLength(2);
    expect(sent[0]![0]!.kind).toBe("edit");
    expect(sent[1]![0]!.kind).toBe("read");
  });

  test("channel latest: unsent frame replaced by newer", async () => {
    const sent: Body[][] = [];
    const box = createOutbox((b) => sent.push(b), { windowMs: 1000, now: () => 0 });
    box.edit("c0", ["#9", "set", ["x"], 1]); // hold the window open so chans queue up
    box.flush();
    for (let i = 1; i <= 5; i++) box.chan("latest", chanBody(i));
    box.flush();
    const chans = sent.flat().filter((b) => b.kind === "chan");
    expect(chans).toEqual([chanBody(5)]);
  });

  test("channel drop: discard newest while one is unsent", () => {
    const sent: Body[][] = [];
    const box = createOutbox((b) => sent.push(b), { windowMs: 1000, now: () => 0 });
    box.edit("c0", ["#9", "set", ["x"], 1]);
    box.flush();
    box.chan("drop", chanBody(1));
    box.chan("drop", chanBody(2));
    box.flush();
    expect(sent.flat().filter((b) => b.kind === "chan")).toEqual([chanBody(1)]);
  });

  test("channel buffer: preserves order", () => {
    const sent: Body[][] = [];
    const box = createOutbox((b) => sent.push(b));
    box.chan("buffer", chanBody(1));
    box.chan("buffer", chanBody(2));
    box.flush();
    expect(sent.flat().filter((b) => b.kind === "chan").map((c) => (c as { data: unknown }).data)).toEqual([1, 2]);
  });

  test("channel throttle: paced by window, newest wins within it", async () => {
    const sent: Body[][] = [];
    let t = 0;
    const box = createOutbox((b) => sent.push(b), { windowMs: 0, now: () => t });
    box.chan({ throttle: 100 }, chanBody(1));
    box.flush(); // t=0: first goes out
    box.chan({ throttle: 100 }, chanBody(2));
    box.chan({ throttle: 100 }, chanBody(3));
    box.flush(); // t=0: held (within 100ms)
    expect(sent.flat().filter((b) => b.kind === "chan")).toEqual([chanBody(1)]);
    t = 120;
    box.flush();
    expect(sent.flat().filter((b) => b.kind === "chan")).toEqual([chanBody(1), chanBody(3)]);
  });
});

describe("link", () => {
  const frames = (link = createLink()) => {
    const f1 = link.stamp({ kind: "edit", corr: "c1", edits: [] });
    const f2 = link.stamp({ kind: "edit", corr: "c2", edits: [] });
    const f3 = link.stamp({ kind: "note", level: "warn", message: "m" });
    return { link, f1, f2, f3 };
  };

  test("stamps monotonic seq; sys frames unsequenced", () => {
    const { link, f1, f2 } = frames();
    expect([f1.seq, f2.seq]).toEqual([1, 2]);
    expect(link.stamp({ kind: "sys", op: "ping" }).seq).toBe(-1);
  });

  test("ack prunes the resend buffer; replayFrom returns the tail", () => {
    const { link, f3 } = frames();
    expect(link.replayFrom(0)).toHaveLength(3);
    link.onAck(2);
    expect(link.replayFrom(0)).toEqual([f3]);
    expect(link.replayFrom(3)).toEqual([]);
  });

  test("accept dedups replayed frames and advances the cursor", () => {
    const sender = createLink();
    const receiver = createLink();
    const a = sender.stamp({ kind: "edit", corr: "c1", edits: [] });
    const b = sender.stamp({ kind: "edit", corr: "c1", edits: [] });
    expect(receiver.accept(a)).toBe(true);
    expect(receiver.accept(b)).toBe(true);
    expect(receiver.accept(a as Frame)).toBe(false); // replayed duplicate
    expect(receiver.cursor()).toBe(2);
    expect(receiver.accept(sender.stamp({ kind: "sys", op: "ping" }))).toBe(true);
    expect(receiver.cursor()).toBe(2);
  });
});
