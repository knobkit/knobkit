import { value } from "./value.js";

export function dropdown(opts: { choices: string[]; value?: string }) {
  return value("dropdown", opts.value ?? opts.choices[0]!, { choices: opts.choices });
}
