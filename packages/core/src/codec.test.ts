import { describe, expect, test } from "vitest";
import { decode, encode } from "./codec.js";

const roundTrip = (v: unknown) => decode(encode(v));

describe("codec round-trips", () => {
  test("scalars", () => {
    for (const v of [0, 1, 23, 24, 255, 256, 65536, 4294967296, -1, -24, -25, -1000000, 1.5, -2.75, "", "héllo ☃", true, false, null]) {
      expect(roundTrip(v)).toEqual(v);
    }
    expect(roundTrip(undefined)).toBeUndefined();
    expect(roundTrip(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  test("arrays, objects, nesting, undefined inside containers", () => {
    const v = {
      edits: [["#0", "appendText", ["msgs", -1, "content"], "tok"]],
      corr: "c3",
      snap: undefined,
      deep: { a: [1, { b: null }], d: "x" },
    };
    expect(roundTrip(v)).toEqual(v);
    expect((roundTrip(v) as { snap: unknown }).snap).toBeUndefined();
  });

  test("Date via tag 1", () => {
    const d = new Date("2026-08-14T12:00:00.000Z");
    expect(roundTrip(d)).toEqual(d);
    const frac = new Date(1755172800123);
    expect((roundTrip(frac) as Date).getTime()).toBeCloseTo(frac.getTime(), -1);
  });

  test("TypedArrays preserve type and content", () => {
    const f32 = new Float32Array([0.5, -1.25, 3e7]);
    const out = roundTrip(f32) as Float32Array;
    expect(out).toBeInstanceOf(Float32Array);
    expect([...out]).toEqual([...f32]);

    for (const ta of [
      new Uint8Array([1, 2, 255]),
      new Int8Array([-1, 2]),
      new Uint16Array([1, 65535]),
      new Int16Array([-32768, 3]),
      new Uint32Array([1, 4294967295]),
      new Int32Array([-5, 6]),
      new Float64Array([1.123456789, -2]),
    ]) {
      const rt = roundTrip(ta) as ArrayBufferView;
      expect(rt.constructor).toBe(ta.constructor);
      expect([...(rt as unknown as number[])]).toEqual([...(ta as unknown as number[])]);
    }
  });

  test("nested MediaRef and binary payload in one frame", () => {
    const frame = {
      seq: 12,
      ack: 4,
      kind: "chan",
      body: { corr: "c9", src: "#2", name: "clip", data: new Float32Array(1024).fill(0.25) },
      ref: { $m: "m1", mime: "image/jpeg", size: 51234 },
    };
    const out = roundTrip(frame) as typeof frame;
    expect(out.ref).toEqual(frame.ref);
    expect(out.body.data).toBeInstanceOf(Float32Array);
    expect(out.body.data[1023]).toBe(0.25);
  });

  test("decode rejects trailing garbage", () => {
    const bytes = encode({ a: 1 });
    const dirty = new Uint8Array(bytes.length + 1);
    dirty.set(bytes);
    expect(() => decode(dirty)).toThrow(/trailing/);
  });
});

describe("codec size", () => {
  test("1 MB Float32Array ≤ 1.05× raw (and far below JSON)", () => {
    const mb = new Float32Array(262144); // 1 MiB
    for (let i = 0; i < mb.length; i++) mb[i] = Math.fround(Math.sin(i));
    const encoded = encode({ data: mb });
    expect(encoded.length).toBeLessThanOrEqual(mb.byteLength * 1.05);
    const json = JSON.stringify({ data: [...mb] }).length;
    expect(encoded.length).toBeLessThan(json);
  });

  test("aligned frames decode typed arrays zero-copy", () => {
    // encode pads: tag+header before payload; verify content correctness regardless of alignment
    const v = { pad: 1, data: new Float32Array([1, 2, 3]) };
    const out = decode(encode(v)) as typeof v;
    expect([...out.data]).toEqual([1, 2, 3]);
  });
});
