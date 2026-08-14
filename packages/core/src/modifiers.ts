type Fn<P, R> = (payload: P) => R;

/** Run one at a time; while running keep only the newest arrival, run it after. */
export function latest<P, R>(fn: Fn<P, R>): Fn<P, Promise<void>> {
  let running = false;
  let pending: { payload: P } | null = null;
  return async function run(payload: P): Promise<void> {
    if (running) {
      pending = { payload };
      return;
    }
    running = true;
    try {
      await fn(payload);
    } finally {
      running = false;
      if (pending) {
        const next = pending.payload;
        pending = null;
        await run(next);
      }
    }
  };
}

/** Strict FIFO: each call waits for the previous to finish. */
export function queue<P, R>(fn: Fn<P, R>): Fn<P, Promise<Awaited<R>>> {
  let chain: Promise<unknown> = Promise.resolve();
  return (payload: P) => {
    const next = chain.then(() => fn(payload)) as Promise<Awaited<R>>;
    chain = next.catch(() => {});
    return next;
  };
}

/** Trailing-edge debounce: runs once with the newest payload after `ms` of quiet. */
export function debounce<P, R>(ms: number, fn: Fn<P, R>): Fn<P, void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (payload: P) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void fn(payload);
    }, ms);
  };
}

/** Leading edge + trailing latest: at most one run per `ms`, newest payload wins in between. */
export function throttle<P, R>(ms: number, fn: Fn<P, R>): Fn<P, void> {
  let last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let newest: { payload: P } | null = null;
  const fire = (payload: P): void => {
    last = Date.now();
    void fn(payload);
  };
  return (payload: P) => {
    const wait = last + ms - Date.now();
    if (wait <= 0 && !timer) {
      fire(payload);
      return;
    }
    newest = { payload };
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (newest) {
          const p = newest.payload;
          newest = null;
          fire(p);
        }
      }, Math.max(wait, 0));
    }
  };
}
