import { value } from "./value.js";

export function checkbox(opts: { label?: string; value?: boolean } = {}) {
  return value("checkbox", opts.value ?? false, { label: opts.label });
}
