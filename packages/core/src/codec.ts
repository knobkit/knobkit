const MAJOR_UINT = 0;
const MAJOR_NINT = 1;
const MAJOR_BYTES = 2;
const MAJOR_TEXT = 3;
const MAJOR_ARRAY = 4;
const MAJOR_MAP = 5;
const MAJOR_TAG = 6;

// RFC 8746 typed-array tags, little-endian variants. JS TypedArrays are platform-endian; every
// supported platform is LE, so bytes copy straight through.
const TA_TAGS: Array<[tag: number, ctor: { new (b: ArrayBufferLike, o?: number, l?: number): ArrayBufferView; BYTES_PER_ELEMENT: number }]> = [
  [64, Uint8Array],
  [68, Uint8ClampedArray],
  [69, Uint16Array],
  [70, Uint32Array],
  [72, Int8Array],
  [77, Int16Array],
  [78, Int32Array],
  [85, Float32Array],
  [86, Float64Array],
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class Writer {
  buf = new Uint8Array(256);
  view = new DataView(this.buf.buffer);
  len = 0;

  ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  u8(v: number): void {
    this.ensure(1);
    this.buf[this.len++] = v;
  }

  bytes(v: Uint8Array): void {
    this.ensure(v.length);
    this.buf.set(v, this.len);
    this.len += v.length;
  }

  head(major: number, arg: number): void {
    if (arg < 24) return this.u8((major << 5) | arg);
    if (arg < 0x100) {
      this.u8((major << 5) | 24);
      return this.u8(arg);
    }
    if (arg < 0x10000) {
      this.ensure(3);
      this.buf[this.len] = (major << 5) | 25;
      this.view.setUint16(this.len + 1, arg);
      this.len += 3;
      return;
    }
    if (arg < 0x100000000) {
      this.ensure(5);
      this.buf[this.len] = (major << 5) | 26;
      this.view.setUint32(this.len + 1, arg);
      this.len += 5;
      return;
    }
    this.ensure(9);
    this.buf[this.len] = (major << 5) | 27;
    this.view.setBigUint64(this.len + 1, BigInt(arg));
    this.len += 9;
  }

  float64(v: number): void {
    this.ensure(9);
    this.buf[this.len] = 0xfb;
    this.view.setFloat64(this.len + 1, v);
    this.len += 9;
  }
}

function encodeValue(w: Writer, v: unknown): void {
  if (v === undefined) return w.u8(0xf7);
  if (v === null) return w.u8(0xf6);
  if (v === true) return w.u8(0xf5);
  if (v === false) return w.u8(0xf4);

  switch (typeof v) {
    case "number":
      if (Number.isSafeInteger(v)) {
        if (v >= 0) return w.head(MAJOR_UINT, v);
        return w.head(MAJOR_NINT, -1 - v);
      }
      return w.float64(v);
    case "string": {
      const bytes = encoder.encode(v);
      w.head(MAJOR_TEXT, bytes.length);
      return w.bytes(bytes);
    }
    case "object":
      break;
    default:
      throw new Error(`knobkit codec: cannot encode ${typeof v}`);
  }

  if (v instanceof Uint8Array) {
    w.head(MAJOR_BYTES, v.length);
    return w.bytes(v);
  }
  if (ArrayBuffer.isView(v)) {
    for (const [tag, ctor] of TA_TAGS) {
      if (v.constructor === ctor) {
        w.head(MAJOR_TAG, tag);
        const raw = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        w.head(MAJOR_BYTES, raw.length);
        return w.bytes(raw);
      }
    }
    throw new Error(`knobkit codec: unsupported typed array ${v.constructor.name}`);
  }
  if (v instanceof ArrayBuffer) {
    w.head(MAJOR_BYTES, v.byteLength);
    return w.bytes(new Uint8Array(v));
  }
  if (v instanceof Date) {
    w.head(MAJOR_TAG, 1);
    const ms = v.getTime();
    if (Number.isSafeInteger(ms / 1000) && ms % 1000 === 0) return w.head(MAJOR_UINT, ms / 1000);
    return w.float64(ms / 1000);
  }
  if (Array.isArray(v)) {
    w.head(MAJOR_ARRAY, v.length);
    for (const item of v) encodeValue(w, item);
    return;
  }

  const entries = Object.entries(v as Record<string, unknown>);
  w.head(MAJOR_MAP, entries.length);
  for (const [k, item] of entries) {
    const kb = encoder.encode(k);
    w.head(MAJOR_TEXT, kb.length);
    w.bytes(kb);
    encodeValue(w, item);
  }
}

export function encode(value: unknown): Uint8Array {
  const w = new Writer();
  encodeValue(w, value);
  return w.buf.subarray(0, w.len);
}

class Reader {
  view: DataView;
  pos = 0;

  constructor(public buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  u8(): number {
    return this.buf[this.pos++]!;
  }

  arg(info: number): number {
    if (info < 24) return info;
    if (info === 24) return this.u8();
    if (info === 25) {
      const v = this.view.getUint16(this.pos);
      this.pos += 2;
      return v;
    }
    if (info === 26) {
      const v = this.view.getUint32(this.pos);
      this.pos += 4;
      return v;
    }
    if (info === 27) {
      const v = this.view.getBigUint64(this.pos);
      this.pos += 8;
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("knobkit codec: integer exceeds 2^53");
      return Number(v);
    }
    throw new Error("knobkit codec: indefinite lengths unsupported");
  }

  raw(n: number): Uint8Array {
    const v = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }
}

function decodeValue(r: Reader): unknown {
  const initial = r.u8();
  const major = initial >> 5;
  const info = initial & 0x1f;

  switch (major) {
    case MAJOR_UINT:
      return r.arg(info);
    case MAJOR_NINT:
      return -1 - r.arg(info);
    case MAJOR_BYTES:
      // zero-copy view into the input; frames are decoded once and consumed
      return r.raw(r.arg(info));
    case MAJOR_TEXT:
      return decoder.decode(r.raw(r.arg(info)));
    case MAJOR_ARRAY: {
      const n = r.arg(info);
      const arr = new Array(n);
      for (let i = 0; i < n; i++) arr[i] = decodeValue(r);
      return arr;
    }
    case MAJOR_MAP: {
      const n = r.arg(info);
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < n; i++) {
        const key = decodeValue(r);
        if (typeof key !== "string") throw new Error("knobkit codec: non-string map key");
        obj[key] = decodeValue(r);
      }
      return obj;
    }
    case MAJOR_TAG: {
      const tag = r.arg(info);
      if (tag === 1) {
        const epoch = decodeValue(r);
        return new Date((epoch as number) * 1000);
      }
      for (const [t, ctor] of TA_TAGS) {
        if (t !== tag) continue;
        const raw = decodeValue(r) as Uint8Array;
        const bpe = ctor.BYTES_PER_ELEMENT;
        if ((raw.byteOffset % bpe) === 0) {
          return new ctor(raw.buffer, raw.byteOffset, raw.byteLength / bpe);
        }
        // misaligned in the frame: copy once into an aligned buffer
        const copy = new Uint8Array(raw.byteLength);
        copy.set(raw);
        return new ctor(copy.buffer, 0, raw.byteLength / bpe);
      }
      throw new Error(`knobkit codec: unknown tag ${tag}`);
    }
    default: {
      // major 7: simple values + floats
      if (initial === 0xf4) return false;
      if (initial === 0xf5) return true;
      if (initial === 0xf6) return null;
      if (initial === 0xf7) return undefined;
      if (initial === 0xfa) {
        const v = r.view.getFloat32(r.pos);
        r.pos += 4;
        return v;
      }
      if (initial === 0xfb) {
        const v = r.view.getFloat64(r.pos);
        r.pos += 8;
        return v;
      }
      throw new Error(`knobkit codec: unsupported item 0x${initial.toString(16)}`);
    }
  }
}

export function decode(bytes: Uint8Array): unknown {
  const r = new Reader(bytes);
  const value = decodeValue(r);
  if (r.pos !== bytes.length) throw new Error("knobkit codec: trailing bytes");
  return value;
}
