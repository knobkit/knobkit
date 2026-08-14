import { describe, expect, test } from "vitest";
import { emptyDoc, reduce, reduceAll } from "./doc.js";
import { instanceAddEdit } from "./ops.js";
import type { MediaRef } from "./types.js";

const ref = (id: string): MediaRef => ({ $m: id, mime: "image/png", size: 3 });

function counter() {
  const counts = new Map<string, number>();
  return {
    counts,
    fx: {
      refEnter: (r: MediaRef) => counts.set(r.$m, (counts.get(r.$m) ?? 0) + 1),
      refLeave: (r: MediaRef) => counts.set(r.$m, (counts.get(r.$m) ?? 0) - 1),
    },
  };
}

describe("MediaRef refcounting", () => {
  test("enter on instanceAdd and set; leave on overwrite and instanceRemove", () => {
    const { counts, fx } = counter();
    let doc = reduce(emptyDoc(), instanceAddEdit("#0", { type: "image", props: {}, state: { src: ref("a") } }), fx);
    expect(counts.get("a")).toBe(1);

    doc = reduce(doc, ["#0", "set", ["src"], ref("b")], fx);
    expect(counts.get("a")).toBe(0);
    expect(counts.get("b")).toBe(1);

    doc = reduce(doc, ["#0", "instanceRemove", []], fx);
    expect(counts.get("b")).toBe(0);
  });

  test("array ops: append enters, removeAt leaves, nested refs found", () => {
    const { counts, fx } = counter();
    let doc = reduce(emptyDoc(), instanceAddEdit("#0", { type: "gallery", props: {}, state: { items: [] } }), fx);
    doc = reduceAll(
      doc,
      [
        ["#0", "append", ["items"], { pic: ref("a") }],
        ["#0", "appendN", ["items"], [{ pic: ref("b") }, { pic: ref("c") }]],
        ["#0", "removeAt", ["items"], 1],
      ],
      fx,
    );
    expect(counts.get("a")).toBe(1);
    expect(counts.get("b")).toBe(0);
    expect(counts.get("c")).toBe(1);
    expect(doc.instances["#0"]!.state["items"]).toEqual([{ pic: ref("a") }, { pic: ref("c") }]);
  });

  test("patch: leaves overwritten keys only", () => {
    const { counts, fx } = counter();
    let doc = reduce(
      emptyDoc(),
      instanceAddEdit("#0", { type: "x", props: {}, state: { o: { a: ref("a"), b: ref("b") } } }),
      fx,
    );
    doc = reduce(doc, ["#0", "patch", ["o"], { a: ref("c") }], fx);
    expect(counts.get("a")).toBe(0);
    expect(counts.get("b")).toBe(1);
    expect(counts.get("c")).toBe(1);
  });
});
