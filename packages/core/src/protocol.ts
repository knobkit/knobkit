import type { Edit } from "./ops.js";
import type { Doc, Id, Path } from "./types.js";

export type NoteLevel = "drop" | "error" | "warn";

export type ChannelPolicy = "buffer" | "latest" | "drop" | { throttle: number };

/** What the client must know about a server-side subscription: routing, snapshots, gating. */
export interface SubDecl {
  src: Id;
  name: string;
  chan?: boolean;
  gate?: boolean;
  snap?: [Id, Path][];
  policy?: ChannelPolicy;
  debounceMs?: number;
}

export type Body =
  | { kind: "event"; corr: string; src: Id; name: string; payload: unknown; snap?: [Id, Path, unknown][] }
  | { kind: "chan"; corr: string; src: Id; name: string; data: unknown }
  | { kind: "edit"; corr: string; edits: Edit[] }
  | { kind: "read"; corr: string; rid: number; targets: [Id, Path][] }
  | { kind: "result"; rid: number; values: unknown[] }
  | { kind: "watch"; op: "add" | "remove"; wid: number; target: [Id, Path]; throttleMs?: number }
  | { kind: "note"; corr?: string; level: NoteLevel; src?: Id; message: string; stack?: string }
  | SysBody;

export type SysBody =
  | { kind: "sys"; op: "hello"; session?: string; cursor?: number }
  | { kind: "sys"; op: "welcome"; session: string; doc: Doc; subs: SubDecl[]; dev?: boolean }
  | { kind: "sys"; op: "resume"; cursor: number }
  | { kind: "sys"; op: "ping" }
  | { kind: "sys"; op: "pong" };

export type Frame = { seq: number; ack: number } & Body;

export const WS_PATH = "/__pu";
export const MEDIA_PATH = "/__media";
export const APP_PATH = "/__app";

const MAX_BUFFER = 8192;

export interface Link {
  /** Stamp a body into a frame: sequenced kinds get the next seq and enter the resend buffer. */
  stamp(body: Body): Frame;
  /** Peer told us its highest contiguous received seq: prune the resend buffer. */
  onAck(ack: number): void;
  /** Should this inbound frame be delivered? False for replay duplicates. Advances the cursor. */
  accept(frame: Frame): boolean;
  /** Highest contiguous inbound seq — sent as `ack` on every outbound frame. */
  cursor(): number;
  /** Buffered frames with seq > cursor, for resume replay. */
  replayFrom(cursor: number): Frame[];
  /** True once the resend buffer overflowed — the session can no longer resume losslessly. */
  broken(): boolean;
}

export function createLink(): Link {
  let nextSeq = 1;
  let received = 0;
  const buffer: Frame[] = [];
  let overflow = false;

  return {
    stamp(body: Body): Frame {
      if (body.kind === "sys") return { seq: -1, ack: received, ...body };
      const frame: Frame = { seq: nextSeq++, ack: received, ...body };
      buffer.push(frame);
      if (buffer.length > MAX_BUFFER) {
        overflow = true;
        buffer.shift();
      }
      return frame;
    },
    onAck(ack: number): void {
      while (buffer.length > 0 && buffer[0]!.seq <= ack) buffer.shift();
    },
    accept(frame: Frame): boolean {
      if (frame.kind === "sys" || frame.seq < 0) return true;
      if (frame.seq <= received) return false;
      received = frame.seq;
      return true;
    },
    cursor: () => received,
    replayFrom: (cursor: number) => buffer.filter((f) => f.seq > cursor),
    broken: () => overflow,
  };
}
