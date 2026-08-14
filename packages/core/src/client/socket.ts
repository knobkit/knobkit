import { decode, encode } from "../codec.js";
import { createLink, WS_PATH } from "../protocol.js";
import type { Body, Frame, SubDecl } from "../protocol.js";
import { createOutbox } from "../outbox.js";
import { setMediaStore } from "../media.js";
import type { Id } from "../types.js";
import { createClientMediaStore } from "./media.js";
import { createNotesHub } from "./notes.js";
import type { NotesHub } from "./notes.js";
import { renderApp } from "./render.js";
import { createStore } from "./store.js";
import type { Store } from "./store.js";
import { createWatchTable } from "./watch-table.js";
import type { WatchTable } from "./watch-table.js";

export function boot(rootSelector = "#root"): void {
  const el = document.querySelector(rootSelector);
  if (!el) throw new Error(`knobkit: no element matches "${rootSelector}"`);

  const media = createClientMediaStore(true);
  setMediaStore(media);

  let ws: WebSocket | null = null;
  let link = createLink();
  let session: string | null = null;
  let store: Store | null = null;
  let notes: NotesHub | null = null;
  let subs: SubDecl[] = [];
  let watchTable: WatchTable | null = null;
  let rendered = false;
  let attempts = 0;
  let corrN = 0;
  const mint = (): string => `c${corrN++}`;

  const sendFrames = (frames: Frame[]): void => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(encode(frames) as Uint8Array<ArrayBuffer>);
  };

  const outbox = createOutbox((bodies) => {
    const frames = bodies.map((b) => {
      media.uploadRefs(b);
      return link.stamp(b);
    });
    sendFrames(frames);
  });

  const subsFor = (id: Id, name: string, chan: boolean): SubDecl[] =>
    subs.filter((s) => s.src === id && s.name === name && Boolean(s.chan) === chan);

  const emit = (id: Id, name: string, payload: unknown): void => {
    const matching = subsFor(id, name, false);
    if (matching.length === 0 || !store) return; // no server handler — local-only event
    if (store.gated(id) && matching.every((s) => s.gate !== false)) {
      notes?.push("drop", `${name}: dropped — widget is disabled or busy`);
      return;
    }
    const targets = new Map<string, [Id, (string | number)[]]>();
    for (const s of matching) for (const [tid, path] of s.snap ?? []) targets.set(tid + JSON.stringify(path), [tid, path]);
    const snap = targets.size
      ? [...targets.values()].map(([tid, path]) => [tid, path, store!.readAt(tid, path)] as [Id, (string | number)[], unknown])
      : undefined;
    outbox.push({ kind: "event", corr: mint(), src: id, name, payload, snap });
  };

  const send = (id: Id, name: string, data: unknown): void => {
    const matching = subsFor(id, name, true);
    if (matching.length === 0 || !store) return;
    if (store.gated(id) && matching.every((s) => s.gate !== false)) return;
    outbox.chan(matching[0]!.policy ?? "buffer", { kind: "chan", corr: mint(), src: id, name, data });
  };

  const handleFrame = (frame: Frame): void => {
    link.onAck(frame.ack);
    if (!link.accept(frame)) return;

    switch (frame.kind) {
      case "edit":
        store?.apply(frame.edits);
        break;
      case "read": {
        const values = frame.targets.map(([id, path]) => store?.readAt(id, path));
        outbox.push({ kind: "result", rid: frame.rid, values });
        break;
      }
      case "watch":
        if (frame.op === "add") watchTable?.add(frame.wid, frame.target, frame.throttleMs);
        else watchTable?.remove(frame.wid);
        break;
      case "note":
        notes?.push(frame.level, frame.message, { stack: frame.stack, corr: frame.corr });
        break;
      case "sys":
        if (frame.op === "welcome") {
          if (rendered) {
            // the session expired server-side: local doc + seq space are stale — start clean
            location.reload();
            return;
          }
          session = frame.session;
          subs = frame.subs;
          link = createLink();
          notes = createNotesHub(frame.dev ?? false);
          const s = createStore(frame.doc, { refEnter: (r) => media.pin(r), refLeave: (r) => media.unpin(r) });
          store = s;
          watchTable = createWatchTable(s, (_wid, value, [id, path]) => outbox.edit(mint(), [id, "set", path, value]));
          s.onChange((dirty) => watchTable?.check(dirty));
          rendered = true;
          renderApp({ store: s, emit, send }, notes, el);
        } else if (frame.op === "resume") {
          sendFrames(link.replayFrom(frame.cursor));
        } else if (frame.op === "ping") {
          sendFrames([{ seq: -1, ack: link.cursor(), kind: "sys", op: "pong" }]);
        }
        break;
      default:
        break;
    }
  };

  const connect = (): void => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}${WS_PATH}`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      attempts = 0;
      sendFrames([
        session
          ? { seq: -1, ack: link.cursor(), kind: "sys", op: "hello", session, cursor: link.cursor() }
          : { seq: -1, ack: 0, kind: "sys", op: "hello" },
      ]);
    };

    ws.onmessage = (ev) => {
      const frames = decode(new Uint8Array(ev.data as ArrayBuffer)) as Frame[];
      for (const frame of frames) handleFrame(frame);
    };

    ws.onclose = () => {
      ws = null;
      attempts++;
      setTimeout(connect, Math.min(500 * attempts, 5000));
    };
  };

  connect();
}

export type { Body };
