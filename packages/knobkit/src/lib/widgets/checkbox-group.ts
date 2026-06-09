import { value } from "./value.js";

// Multi-select from a fixed set; its `value` is the array of checked choices.
export function checkboxGroup(opts: { choices: string[]; value?: string[] }) {
  return value<string[]>("checkboxGroup", opts.value ?? [], { choices: opts.choices });
}
