import { describe, expect, test } from "vitest";
import { emptyDoc, reduce, reduceAll } from "./doc.js";
import { coalesce, instanceAddEdit } from "./ops.js";
import type { Edit } from "./ops.js";
import { readAt } from "./path.js";

const base = () =>
  reduce(emptyDoc(), instanceAddEdit("#0", {
    type: "t",
    props: {},
    state: {
      s: "ab",
      n: 1,
      arr: [1, 2, 3],
      obj: { a: 1, b: 2 },
      msgs: [{ role: "user", content: "hi" }],
    },
  }));

const state = (doc: ReturnType<typeof base>): any => doc.instances["#0"]!.state;

describe("ops", () => {
  test("set replaces at path", () => {
    expect(state(reduce(base(), ["#0", "set", ["s"], "x"])).s).toBe("x");
    expect(state(reduce(base(), ["#0", "set", ["msgs", -1, "content"], "yo"])).msgs).toEqual([
      { role: "user", content: "yo" },
    ]);
  });

  test("append / appendN push", () => {
    expect(state(reduce(base(), ["#0", "append", ["arr"], 4])).arr).toEqual([1, 2, 3, 4]);
    expect(state(reduce(base(), ["#0", "appendN", ["arr"], [4, 5]])).arr).toEqual([1, 2, 3, 4, 5]);
  });

  test("appendText concatenates", () => {
    expect(state(reduce(base(), ["#0", "appendText", ["s"], "c"])).s).toBe("abc");
    expect(state(reduce(base(), ["#0", "appendText", ["msgs", -1, "content"], "!"])).msgs[0]).toEqual({
      role: "user",
      content: "hi!",
    });
  });

  test("insert / removeAt / move splice", () => {
    expect(state(reduce(base(), ["#0", "insert", ["arr"], 1, 9])).arr).toEqual([1, 9, 2, 3]);
    expect(state(reduce(base(), ["#0", "insert", ["arr"], -1, 9])).arr).toEqual([1, 2, 9, 3]);
    expect(state(reduce(base(), ["#0", "removeAt", ["arr"], 0])).arr).toEqual([2, 3]);
    expect(state(reduce(base(), ["#0", "removeAt", ["arr"], 0, 2])).arr).toEqual([3]);
    expect(state(reduce(base(), ["#0", "move", ["arr"], 0, 2])).arr).toEqual([2, 3, 1]);
  });

  test("inc adds; patch shallow-merges", () => {
    expect(state(reduce(base(), ["#0", "inc", ["n"], 41])).n).toBe(42);
    expect(state(reduce(base(), ["#0", "patch", ["obj"], { b: 9, c: 3 }])).obj).toEqual({ a: 1, b: 9, c: 3 });
  });

  test("instanceAdd / instanceRemove", () => {
    const doc = reduce(base(), instanceAddEdit("#1", { type: "u", props: {}, state: {} }));
    expect(Object.keys(doc.instances)).toEqual(["#0", "#1"]);
    expect(Object.keys(reduce(doc, ["#1", "instanceRemove", []]).instances)).toEqual(["#0"]);
  });

  test("structural sharing along the spine only", () => {
    const before = base();
    const after = reduce(before, ["#0", "set", ["msgs", -1, "content"], "yo"]);
    expect(after.instances["#0"]!.state["arr"]).toBe(before.instances["#0"]!.state["arr"]);
    expect(after.instances["#0"]!.state["msgs"]).not.toBe(before.instances["#0"]!.state["msgs"]);
  });

  test("edits to unknown instances are no-ops", () => {
    const doc = base();
    expect(reduce(doc, ["#9", "set", ["s"], "x"])).toBe(doc);
  });
});

describe("coalescing", () => {
  test("adjacent appends merge to appendN", () => {
    expect(
      coalesce([
        ["#0", "append", ["arr"], 4],
        ["#0", "append", ["arr"], 5],
        ["#0", "append", ["arr"], 6],
      ]),
    ).toEqual([["#0", "appendN", ["arr"], [4, 5, 6]]]);
  });

  test("appendText merges; inc sums; patch merges later-wins", () => {
    expect(
      coalesce([
        ["#0", "appendText", ["s"], "c"],
        ["#0", "appendText", ["s"], "d"],
        ["#0", "inc", ["n"], 1],
        ["#0", "inc", ["n"], 2],
        ["#0", "patch", ["obj"], { a: 9 }],
        ["#0", "patch", ["obj"], { b: 9 }],
      ]),
    ).toEqual([
      ["#0", "appendText", ["s"], "cd"],
      ["#0", "inc", ["n"], 3],
      ["#0", "patch", ["obj"], { a: 9, b: 9 }],
    ]);
  });

  test("set absorbs prior ops at same or descendant paths, chained", () => {
    expect(
      coalesce([
        ["#0", "append", ["msgs"], { role: "a", content: "" }],
        ["#0", "appendText", ["msgs", -1, "content"], "tok"],
        ["#0", "set", ["msgs"], []],
      ]),
    ).toEqual([["#0", "set", ["msgs"], []]]);
  });

  test("set does not absorb across another id or a non-descendant path", () => {
    const edits: Edit[] = [
      ["#1", "append", ["arr"], 1],
      ["#0", "append", ["msgs"], "m"],
      ["#0", "set", ["s"], "x"],
    ];
    expect(coalesce(edits)).toEqual(edits);
  });

  test("property: coalesced queue ≡ originals in order", () => {
    let seed = 0xdecafbad;
    const rnd = () => {
      // mulberry32
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;

    const genEdit = (): Edit => {
      const kind = pick(["s", "n", "arr", "obj", "msgs"]);
      switch (kind) {
        case "s":
          return pick<Edit>([
            ["#0", "set", ["s"], `v${Math.floor(rnd() * 10)}`],
            ["#0", "appendText", ["s"], pick(["x", "yz", ""])],
          ]);
        case "n":
          return pick<Edit>([
            ["#0", "set", ["n"], Math.floor(rnd() * 10)],
            ["#0", "inc", ["n"], Math.floor(rnd() * 5) - 2],
          ]);
        case "arr":
          return pick<Edit>([
            ["#0", "set", ["arr"], [Math.floor(rnd() * 10)]],
            ["#0", "append", ["arr"], Math.floor(rnd() * 10)],
            ["#0", "appendN", ["arr"], [Math.floor(rnd() * 10), Math.floor(rnd() * 10)]],
            ["#0", "insert", ["arr"], Math.floor(rnd() * 4), 99],
            ["#0", "removeAt", ["arr"], Math.floor(rnd() * 3)],
            ["#0", "move", ["arr"], Math.floor(rnd() * 3), Math.floor(rnd() * 3)],
          ]);
        case "obj":
          return pick<Edit>([
            ["#0", "set", ["obj"], { a: Math.floor(rnd() * 10) }],
            ["#0", "patch", ["obj"], { [pick(["a", "b", "c"])]: Math.floor(rnd() * 10) }],
          ]);
        default:
          return pick<Edit>([
            ["#0", "set", ["msgs"], [{ role: "u", content: "seed" }]],
            ["#0", "append", ["msgs"], { role: "a", content: "" }],
            ["#0", "appendText", ["msgs", -1, "content"], pick(["t", "ok"])],
            ["#0", "set", ["msgs", -1, "content"], "reset"],
          ]);
      }
    };

    for (let round = 0; round < 200; round++) {
      const edits = Array.from({ length: 1 + Math.floor(rnd() * 20) }, genEdit);
      const plain = reduceAll(base(), edits);
      const merged = reduceAll(base(), coalesce(edits));
      expect(merged, `edits: ${JSON.stringify(edits)}`).toEqual(plain);
    }
  });
});

describe("readAt", () => {
  test("walks paths with -1", () => {
    const doc = base();
    expect(readAt(state(doc), ["msgs", -1, "content"])).toBe("hi");
    expect(readAt(state(doc), ["missing", "deep"])).toBeUndefined();
  });
});
