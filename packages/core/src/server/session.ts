import { randomUUID } from "node:crypto";
import type { App } from "../app.js";
import { createReadBatcher } from "../context.js";
import type { Bound } from "../context.js";
import { createDispatcher } from "../dispatch.js";
import type { Dispatcher } from "../dispatch.js";
import { encode } from "../codec.js";
import { createLink } from "../protocol.js";
import type { Body, Frame } from "../protocol.js";
import { createOutbox } from "../outbox.js";
import type { Outbox } from "../outbox.js";
import { samePath } from "../path.js";
import { BUSY, ENABLED } from "../types.js";
import type { Id } from "../types.js";

const READ_TIMEOUT_MS = 15_000;
const GC_MS = 5 * 60_000;

export interface SessionConn {
  send(data: Uint8Array): void;
}

export interface Session {
  readonly id: string;
  readonly link: ReturnType<typeof createLink>;
  readonly outbox: Outbox;
  readonly dispatcher: Dispatcher;
  attach(conn: SessionConn, resumeCursor: number | undefined): void;
  detach(): void;
  handleFrame(frame: Frame): void;
  start(): void;
  expired(): boolean;
}

export function createSession(app: App, opts: { dev: boolean; onNote?: (level: string, message: string) => void }): Session {
  const id = randomUUID();
  const link = createLink();
  let conn: SessionConn | null = null;
  let detachedAt: number | null = null;
  const spans = new Map<string, number>();
  const gate = new Map<Id, { enabled: boolean; busy: boolean }>();
  const pendingReads = new Map<number, { resolve: (values: unknown[]) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let rid = 0;
  let corrN = 0;
  let spawnN = 0;
  const mintCorr = (): string => `s${corrN++}`;

  const outbox = createOutbox((bodies: Body[]) => {
    const frames = bodies.map((b) => link.stamp(b));
    if (conn) conn.send(encode(frames));
  });

  // mirror only the $enabled/$busy edits this session itself sent — the server holds no other UI state
  const trackGate = (edit: [Id, string, (string | number)[], ...unknown[]]): void => {
    const [target, op, path, value] = edit;
    if (op !== "set" || path.length !== 1) return;
    if (path[0] !== ENABLED && path[0] !== BUSY) return;
    const g = gate.get(target) ?? { enabled: true, busy: false };
    if (path[0] === ENABLED) g.enabled = value !== false;
    else g.busy = value === true;
    gate.set(target, g);
  };

  const readOne = createReadBatcher(async (targets) => {
    // flush queued writes before issuing the read so the client answers after applying them
    const readCorr = mintCorr();
    const thisRid = rid++;
    return new Promise<unknown[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingReads.delete(thisRid);
        reject(new Error("knobkit: read timed out — client unreachable"));
      }, READ_TIMEOUT_MS);
      pendingReads.set(thisRid, { resolve, reject, timer });
      outbox.push({ kind: "read", corr: readCorr, rid: thisRid, targets });
    });
  });

  const makeBound = (corr: string, snap?: Map<string, unknown>): Bound => ({
    session: id,
    corr,
    snap,
    spans,
    read: (targets) => Promise.all(targets.map((t) => readOne(t))),
    edit: (e) => {
      trackGate(e as [Id, string, (string | number)[], ...unknown[]]);
      outbox.edit(corr, e);
    },
    mintId: () => `#s${spawnN++}`,
    spawn(inst) {
      const instId = this.mintId();
      this.edit([instId, "instanceAdd", [], inst]);
      return instId;
    },
    dispose: (target) => outbox.edit(corr, [target, "instanceRemove", []]),
    note: (level, message, src) => note(level, message, { src, corr }),
  });

  const note = (level: "drop" | "error" | "warn", message: string, extra?: { corr?: string; src?: Id; stack?: string }): void => {
    if (level === "error") console.error(`knobkit [session ${id.slice(0, 8)}]: ${message}${extra?.stack ? `\n${extra.stack}` : ""}`);
    opts.onNote?.(level, message);
    outbox.push({ kind: "note", level, message, corr: extra?.corr, src: extra?.src, stack: opts.dev ? extra?.stack : undefined });
  };

  const dispatcher = createDispatcher(app, {
    session: id,
    makeBound,
    note,
    gated: (target) => {
      const g = gate.get(target);
      if (g && (!g.enabled || g.busy)) return true;
      for (const [key, count] of spans) {
        if (count > 0 && key.startsWith(target + " ")) return true;
      }
      return false;
    },
  });

  return {
    id,
    link,
    outbox,
    dispatcher,

    attach(newConn, resumeCursor) {
      conn = newConn;
      detachedAt = null;
      if (resumeCursor !== undefined) {
        const frames: Frame[] = [
          { seq: -1, ack: link.cursor(), kind: "sys", op: "resume", cursor: link.cursor() },
          ...link.replayFrom(resumeCursor),
        ];
        newConn.send(encode(frames));
      }
    },

    detach() {
      conn = null;
      detachedAt = Date.now();
    },

    handleFrame(frame) {
      link.onAck(frame.ack);
      if (!link.accept(frame)) return;
      switch (frame.kind) {
        case "event":
          dispatcher.dispatchEvent(frame.src, frame.name, frame.payload, frame.corr, frame.snap);
          break;
        case "chan":
          dispatcher.dispatchChan(frame.src, frame.name, frame.data, frame.corr);
          break;
        case "edit":
          for (const edit of frame.edits) {
            for (const w of app.watches) {
              if (w.lens.__target() === edit[0] && samePath(w.lens.path, edit[2])) {
                dispatcher.dispatchWatch(w.wid, edit[3], frame.corr);
              }
            }
          }
          break;
        case "result": {
          const slot = pendingReads.get(frame.rid);
          if (slot) {
            pendingReads.delete(frame.rid);
            clearTimeout(slot.timer);
            slot.resolve(frame.values);
          }
          break;
        }
        case "note":
          console.warn(`knobkit [client note]: ${frame.message}`);
          break;
        default:
          break;
      }
    },

    start() {
      for (const w of app.watches) {
        outbox.push({
          kind: "watch",
          op: "add",
          wid: w.wid,
          target: [w.lens.__target(), w.lens.path],
          throttleMs: w.throttleMs,
        });
      }
      void dispatcher.runSetups(mintCorr());
    },

    expired: () => (detachedAt !== null && Date.now() - detachedAt > GC_MS) || link.broken(),
  };
}
