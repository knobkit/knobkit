import { pushEdit } from "./ops.js";
import type { Edit } from "./ops.js";
import type { Body, ChannelPolicy } from "./protocol.js";

const WINDOW_MS = 16;

interface QueuedChan {
  body: Extract<Body, { kind: "chan" }>;
  policy: ChannelPolicy;
  notBefore: number;
}

export interface Outbox {
  edit(corr: string, edit: Edit): void;
  chan(policy: ChannelPolicy, body: Extract<Body, { kind: "chan" }>): void;
  push(body: Body): void;
  flush(): void;
}

export function createOutbox(
  send: (bodies: Body[]) => void,
  opts?: { windowMs?: number; now?: () => number },
): Outbox {
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const now = opts?.now ?? (() => Date.now());

  const queue: Array<Extract<Body, { kind: "edit" }> | QueuedChan> = [];
  const lastSent = new Map<string, number>();
  let lastFlush = -Infinity;
  let scheduled: "micro" | ReturnType<typeof setTimeout> | null = null;

  // First edit after idle drains at the microtask checkpoint; under sustained load drains pace
  // to windowMs so frame count stays bounded regardless of arrival rate.
  function schedule(delayMs: number): void {
    if (scheduled !== null) return;
    if (delayMs <= 0) {
      scheduled = "micro";
      queueMicrotask(() => {
        if (scheduled === "micro") flush();
      });
    } else {
      scheduled = setTimeout(flush, delayMs);
    }
  }

  function flush(): void {
    if (scheduled !== null && scheduled !== "micro") clearTimeout(scheduled);
    scheduled = null;
    const t = now();
    const bodies: Body[] = [];
    let earliestHeld = Infinity;
    for (let i = 0; i < queue.length; ) {
      const item = queue[i]!;
      if (!("kind" in item) && item.notBefore > t) {
        // throttled channel not yet due — hold, keep order among held items
        earliestHeld = Math.min(earliestHeld, item.notBefore);
        i++;
        continue;
      }
      if ("kind" in item) {
        bodies.push(item);
      } else {
        bodies.push(item.body);
        lastSent.set(item.body.src + " " + item.body.name, t);
      }
      queue.splice(i, 1);
    }
    if (bodies.length > 0) {
      lastFlush = t;
      send(bodies);
    }
    if (earliestHeld < Infinity) schedule(earliestHeld - t);
  }

  return {
    edit(corr: string, edit: Edit): void {
      const tail = queue[queue.length - 1];
      if (tail && "kind" in tail && tail.corr === corr) {
        pushEdit(tail.edits, edit);
      } else {
        queue.push({ kind: "edit", corr, edits: [edit] });
      }
      schedule(lastFlush + windowMs - now());
    },

    chan(policy: ChannelPolicy, body: Extract<Body, { kind: "chan" }>): void {
      const key = body.src + " " + body.name;
      if (policy === "latest" || policy === "drop" || typeof policy === "object") {
        for (const item of queue) {
          if (!("kind" in item) && item.body.src === body.src && item.body.name === body.name) {
            if (policy !== "drop") item.body = body; // latest/throttle: newest wins; drop: discard new
            return;
          }
        }
      }
      const throttleMs = typeof policy === "object" ? policy.throttle : 0;
      const notBefore = throttleMs > 0 ? (lastSent.get(key) ?? -Infinity) + throttleMs : 0;
      queue.push({ body, policy, notBefore });
      schedule(lastFlush + windowMs - now());
    },

    push(body: Body): void {
      flush();
      send([body]);
    },

    flush,
  };
}
