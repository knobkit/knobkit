export async function* stream<T>(run: (push: (value: T) => void) => Promise<void> | void): AsyncGenerator<T> {
  const buffer: T[] = [];
  let wake: (() => void) | null = null;
  let done = false;
  let failure: unknown = null;

  const push = (value: T): void => {
    buffer.push(value);
    wake?.();
    wake = null;
  };

  Promise.resolve(run(push)).then(
    () => {
      done = true;
      wake?.();
    },
    (err) => {
      failure = err;
      done = true;
      wake?.();
    },
  );

  while (true) {
    if (buffer.length) {
      yield buffer.shift()!;
      continue;
    }
    if (done) {
      if (failure) throw failure;
      return;
    }
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }
}
