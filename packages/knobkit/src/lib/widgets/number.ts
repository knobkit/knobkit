import { value } from "./value.js";

export function number(opts: { value?: number; min?: number; max?: number } = {}) {
  return value("number", opts.value ?? 0, { min: opts.min, max: opts.max });
}
