import { MEDIA_PATH } from "../protocol.js";
import { isMediaRef, scanMediaRefs } from "../types.js";
import type { MediaRef } from "../types.js";
import type { MediaStore } from "../media.js";

interface Entry {
  data: Uint8Array | Blob;
  mime: string;
  url?: string;
  pins: number;
  posted: boolean;
  seq: number;
}

const ZERO_PIN_BUDGET = 64 * 1024 * 1024;

export interface ClientMediaStore extends MediaStore {
  pin(ref: MediaRef): void;
  unpin(ref: MediaRef): void;
  uploadRefs(value: unknown): void;
}

export function createClientMediaStore(remote: boolean): ClientMediaStore {
  const entries = new Map<string, Entry>();
  let clock = 0;
  let counter = 0;
  const prefix = Math.random().toString(36).slice(2, 8);

  const sizeOf = (d: Uint8Array | Blob): number => (d instanceof Blob ? d.size : d.byteLength);

  // refs that never enter state (e.g. per-frame channel payloads) are only reclaimable by LRU; state refs are pinned
  const evict = (): void => {
    let zeroPinned = [...entries.entries()].filter(([, e]) => e.pins === 0);
    let total = zeroPinned.reduce((n, [, e]) => n + sizeOf(e.data), 0);
    zeroPinned.sort((a, b) => a[1].seq - b[1].seq);
    for (const [id, e] of zeroPinned) {
      if (total <= ZERO_PIN_BUDGET) break;
      if (e.url) URL.revokeObjectURL(e.url);
      entries.delete(id);
      total -= sizeOf(e.data);
    }
  };

  const bytesOf = async (e: Entry): Promise<Uint8Array> =>
    e.data instanceof Blob ? new Uint8Array(await e.data.arrayBuffer()) : e.data;

  return {
    put(data, mime) {
      const id = `${prefix}-${counter++}`;
      entries.set(id, { data, mime, pins: 0, posted: false, seq: clock++ });
      evict();
      return { $m: id, mime, size: sizeOf(data) };
    },

    async bytes(ref) {
      const e = entries.get(ref.$m);
      if (e) {
        e.seq = clock++;
        return bytesOf(e);
      }
      const res = await fetch(`${MEDIA_PATH}/${encodeURIComponent(ref.$m)}`);
      if (!res.ok) throw new Error(`knobkit: media ${ref.$m} unavailable (${res.status})`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      entries.set(ref.$m, { data: bytes, mime: ref.mime, pins: 0, posted: true, seq: clock++ });
      return bytes;
    },

    url(ref) {
      const e = entries.get(ref.$m);
      if (!e) return `${MEDIA_PATH}/${encodeURIComponent(ref.$m)}`;
      if (!e.url) e.url = URL.createObjectURL(e.data instanceof Blob ? e.data : new Blob([e.data as BlobPart], { type: e.mime }));
      e.seq = clock++;
      return e.url;
    },

    release(ref) {
      const e = entries.get(ref.$m);
      if (!e) return;
      if (e.url) URL.revokeObjectURL(e.url);
      entries.delete(ref.$m);
    },

    pin(ref) {
      const e = entries.get(ref.$m);
      if (e) e.pins++;
    },

    unpin(ref) {
      const e = entries.get(ref.$m);
      if (!e) return;
      e.pins = Math.max(0, e.pins - 1);
      if (e.pins === 0) evict();
    },

    uploadRefs(value) {
      if (!remote) return;
      scanMediaRefs(value, (ref) => {
        if (!isMediaRef(ref)) return;
        const e = entries.get(ref.$m);
        if (!e || e.posted) return;
        e.posted = true;
        void bytesOf(e).then((bytes) =>
          fetch(`${MEDIA_PATH}/${encodeURIComponent(ref.$m)}`, {
            method: "POST",
            headers: { "content-type": e.mime },
            body: bytes as unknown as BodyInit,
          }).catch(() => {
            e.posted = false; // retry on next crossing
          }),
        );
      });
    },
  };
}
