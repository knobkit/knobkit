import type { App, SubEntry } from "./app.js";
import { runBound, snapKey } from "./context.js";
import type { Bound } from "./context.js";
import type { NoteLevel } from "./protocol.js";
import { validate } from "./schema.js";
import { idOf, internalOf, isEventObj } from "./widget.js";
import type { EventObj } from "./widget.js";
import type { Id, Path } from "./types.js";

export interface DispatcherPort {
  session: string;
  makeBound(corr: string, snap?: Map<string, unknown>): Bound;
  note(level: NoteLevel, message: string, extra?: { corr?: string; src?: Id; stack?: string }): void;
  gated?(id: Id): boolean | undefined;
}

interface SubState {
  chain: Promise<unknown>;
  running: boolean;
  pendingLatest: (() => Promise<void>) | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

export interface Dispatcher {
  dispatchEvent(srcId: Id, name: string, payload: unknown, corr: string, snap?: [Id, Path, unknown][]): void;
  dispatchChan(srcId: Id, name: string, data: unknown, corr: string): void;
  dispatchWatch(wid: number, value: unknown, corr: string): void;
  runSetups(corr: string): Promise<void>;
  hasSub(srcId: Id, name: string): boolean;
}

export function createDispatcher(app: App, port: DispatcherPort): Dispatcher {
  const states = new Map<object, SubState>();
  const stateOf = (key: object): SubState => {
    let s = states.get(key);
    if (!s) {
      s = { chain: Promise.resolve(), running: false, pendingLatest: null, debounceTimer: null };
      states.set(key, s);
    }
    return s;
  };

  const runHandler =
    (sub: SubEntry, payload: unknown, corr: string, snap?: Map<string, unknown>) => async (): Promise<void> => {
      const b = port.makeBound(corr, snap);
      try {
        const result = await runBound(b, () => sub.handler(payload, { corr, session: port.session }));
        if (isEventObj(result)) reemit(result, corr);
      } catch (err) {
        const e = err as Error;
        port.note("error", e?.message ?? String(err), { corr, src: idOf(sub.src), stack: e?.stack });
      }
    };

  // Re-dispatched events are programmatic, not input: the gate must not drop a busy-wrapped
  // chain's own continuation, and the corr is inherited so busy spans extend across the chain.
  function reemit(event: EventObj, corr: string): void {
    const srcId = idOf(event.src);
    deliver(srcId, event.name, false, event.payload, corr, undefined, false);
  }

  function subsFor(srcId: Id, name: string, chan: boolean): SubEntry[] {
    return app.subs.filter((s) => s.name === name && s.chan === chan && internalOf(s.src).id === srcId);
  }

  function deliver(
    srcId: Id,
    name: string,
    chan: boolean,
    payload: unknown,
    corr: string,
    snap?: [Id, Path, unknown][],
    applyGate = true,
  ): void {
    const subs = subsFor(srcId, name, chan);
    if (subs.length === 0) return;

    const def = internalOf(subs[0]!.src).def;
    const spec = chan ? def.channels[name]?.data : def.events[name]?.payload;
    const verdict = validate(spec, payload);
    if (!verdict.ok) {
      port.note("error", `${def.type}.${name}: invalid payload — ${verdict.message}`, { corr, src: srcId });
      return;
    }

    const blocked = applyGate && port.gated?.(srcId) === true;
    const snapMap = snap ? new Map(snap.map(([id, path, value]) => [snapKey(id, path), value])) : undefined;

    let dropped = 0;
    for (const sub of subs) {
      if (blocked && sub.opts.gate !== false) {
        dropped++;
        continue;
      }
      const state = stateOf(sub);
      const unit = runHandler(sub, payload, corr, snapMap);
      const policy =
        sub.opts.policy ?? (chan && def.channels[name]?.policy === "latest" ? "chan-latest" : "serial");

      const schedule = (): void => {
        switch (policy) {
          case "concurrent":
            void unit();
            break;
          case "latest":
            if (state.running) {
              state.pendingLatest = unit;
            } else {
              state.running = true;
              const drain = (): void => {
                const next = state.pendingLatest;
                state.pendingLatest = null;
                if (next) void next().finally(drain);
                else state.running = false;
              };
              void unit().finally(drain);
            }
            break;
          case "chan-latest":
            // a running handler drops frames arriving meanwhile — newest-wins channels never queue a backlog
            if (state.running) break;
            state.running = true;
            void unit().finally(() => {
              state.running = false;
            });
            break;
          default:
            state.chain = state.chain.then(unit);
        }
      };

      if (sub.opts.debounceMs != null) {
        if (state.debounceTimer) clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(schedule, sub.opts.debounceMs);
      } else {
        schedule();
      }
    }
    if (dropped > 0) {
      port.note("drop", `${def.type}.${name}: dropped — widget is ${chan ? "gated" : "disabled or busy"}`, { corr, src: srcId });
    }
  }

  return {
    dispatchEvent: (srcId, name, payload, corr, snap) => deliver(srcId, name, false, payload, corr, snap),
    dispatchChan: (srcId, name, data, corr) => deliver(srcId, name, true, data, corr),

    dispatchWatch(wid, value, corr): void {
      const watch = app.watches[wid];
      if (!watch) return;
      const state = stateOf(watch);
      const unit = async (): Promise<void> => {
        const b = port.makeBound(corr);
        try {
          await runBound(b, () => watch.handler(value, { corr, session: port.session }));
        } catch (err) {
          const e = err as Error;
          port.note("error", e?.message ?? String(err), { corr, stack: e?.stack });
        }
      };
      state.chain = state.chain.then(unit);
    },

    async runSetups(corr): Promise<void> {
      for (const fn of app.setups) {
        const b = port.makeBound(corr);
        try {
          await runBound(b, fn);
        } catch (err) {
          const e = err as Error;
          port.note("error", e?.message ?? String(err), { corr, stack: e?.stack });
        }
      }
    },

    hasSub: (srcId, name) => app.subs.some((s) => s.name === name && internalOf(s.src).id === srcId),
  };
}
