import { bound } from "./bound.js";
import type { Widget } from "./types.js";

// Spread into every widget factory so enable()/disable()/busy() are uniform. `enabled` and `busy` are
// two orthogonal runtime flags (both separate from state, both drop the widget's input events): enabled
// is a persistent "can't use this" (dimmed); busy is a transient "this is working" (a loading bar).
// `busyStart`/`busyEnd` mark a busy span by hand (e.g. across a setup() load); `busy(fn)` wraps an
// async fn in the same span. `this` is the widget at call time.
export const controls = {
  enable(this: Widget): void {
    bound(this).enable(this, true);
  },
  disable(this: Widget): void {
    bound(this).enable(this, false);
  },
  setEnabled(this: Widget, value: boolean): void {
    bound(this).enable(this, value);
  },
  busyStart(this: Widget): void {
    bound(this).busy(this, true);
  },
  busyEnd(this: Widget): void {
    bound(this).busy(this, false);
  },
  busy(this: Widget, run: (payload: any) => any): (payload: any) => Promise<any> {
    const self = this;
    return async (payload: any) => {
      self.busyStart();
      try {
        return await run(payload);
      } finally {
        self.busyEnd();
      }
    };
  },
};
