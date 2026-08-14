import type { MediaRef } from "./types.js";

export interface MediaStore {
  put(data: Uint8Array | Blob, mime: string): MediaRef;
  bytes(ref: MediaRef): Promise<Uint8Array>;
  url(ref: MediaRef): string;
  release(ref: MediaRef): void;
}

let store: MediaStore | undefined;

export function setMediaStore(s: MediaStore): void {
  store = s;
}

export function mediaStore(): MediaStore {
  if (!store) throw new Error("knobkit: media store not initialized — is the app mounted/served?");
  return store;
}

/** Register bytes in the local tier's store; the returned ref is safe to put in state or payloads. */
export function toMedia(data: Uint8Array | Blob, mime: string): MediaRef {
  return mediaStore().put(data, mime);
}

export function mediaBytes(ref: MediaRef): Promise<Uint8Array<ArrayBuffer>> {
  // bytes are ArrayBuffer-backed in practice; typed so callers can hand them to Blob/File APIs
  return mediaStore().bytes(ref) as Promise<Uint8Array<ArrayBuffer>>;
}

/** A URL usable in the current tier: object URL on the client, `/__media/:id` on the server. */
export function mediaUrl(ref: MediaRef): string {
  return mediaStore().url(ref);
}
