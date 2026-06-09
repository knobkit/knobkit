import { value } from "./value.js";

export function text(opts: { placeholder?: string; lines?: number } = {}) {
  return value("text", "", { placeholder: opts.placeholder, lines: opts.lines ?? 1 });
}
