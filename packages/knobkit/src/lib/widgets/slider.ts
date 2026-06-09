import { value } from "./value.js";

export function slider(opts: { value?: number; min?: number; max?: number; step?: number } = {}) {
  const min = opts.min ?? 0;
  const max = opts.max ?? 100;
  return value("slider", opts.value ?? min, { min, max, step: opts.step ?? 1 });
}
