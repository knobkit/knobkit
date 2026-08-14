import { MEDIA_PATH } from "../protocol.js";
import type { MediaStore } from "../media.js";

const DEFAULT_BUDGET = 256 * 1024 * 1024;
const PENDING_TIMEOUT_MS = 30_000;

interface Entry {
  bytes: Uint8Array;
  mime: string;
  seq: number;
}

export interface ServerMediaStore extends MediaStore {
  handlePost(id: string, mime: string, bytes: Uint8Array): void;
  handleGet(id: string): { bytes: Uint8Array; mime: string } | undefined;
}

export function createServerMediaStore(budget = DEFAULT_BUDGET): ServerMediaStore {
  const entries = new Map<string, Entry>();
  const pending = new Map<string, { promise: Promise<Uint8Array>; resolve: (b: Uint8Array) => void }>();
  let clock = 0;
  let counter = 0;
  const prefix = `srv-${Math.random().toString(36).slice(2, 8)}`;

  const evict = (): void => {
    let total = 0;
    for (const e of entries.values()) total += e.bytes.byteLength;
    if (total <= budget) return;
    const byAge = [...entries.entries()].sort((a, b) => a[1].seq - b[1].seq);
    for (const [id, e] of byAge) {
      if (total <= budget) break;
      entries.delete(id);
      total -= e.bytes.byteLength;
    }
  };

  const store = (id: string, bytes: Uint8Array, mime: string): void => {
    entries.set(id, { bytes, mime, seq: clock++ });
    evict();
  };

  return {
    put(data, mime) {
      if (data instanceof Blob) throw new Error("knobkit: pass Uint8Array to toMedia() on the server");
      const id = `${prefix}-${counter++}`;
      store(id, data, mime);
      return { $m: id, mime, size: data.byteLength };
    },

    bytes(ref) {
      const e = entries.get(ref.$m);
      if (e) {
        e.seq = clock++;
        return Promise.resolve(e.bytes);
      }
      // bytes may still be in flight from the client — park the read on a slot the POST resolves
      let slot = pending.get(ref.$m);
      if (!slot) {
        let resolve!: (b: Uint8Array) => void;
        let reject!: (e: Error) => void;
        const promise = new Promise<Uint8Array>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        const timer = setTimeout(() => {
          pending.delete(ref.$m);
          reject(new Error(`knobkit: media ${ref.$m} never arrived`));
        }, PENDING_TIMEOUT_MS);
        slot = {
          promise,
          resolve: (b) => {
            clearTimeout(timer);
            resolve(b);
          },
        };
        pending.set(ref.$m, slot);
      }
      return slot.promise;
    },

    url(ref) {
      return `${MEDIA_PATH}/${encodeURIComponent(ref.$m)}`;
    },

    release(ref) {
      entries.delete(ref.$m);
    },

    handlePost(id, mime, bytes) {
      store(id, bytes, mime);
      const slot = pending.get(id);
      if (slot) {
        pending.delete(id);
        slot.resolve(bytes);
      }
    },

    handleGet(id) {
      const e = entries.get(id);
      if (!e) return undefined;
      e.seq = clock++;
      return { bytes: e.bytes, mime: e.mime };
    },
  };
}
