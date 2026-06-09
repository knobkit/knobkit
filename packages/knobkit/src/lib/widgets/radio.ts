import { value } from "./value.js";

// Single-select from a fixed set, like dropdown but rendered as radios.
export function radio(opts: { choices: string[]; value?: string }) {
  return value("radio", opts.value ?? opts.choices[0]!, { choices: opts.choices });
}
