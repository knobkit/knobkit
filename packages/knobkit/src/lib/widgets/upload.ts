import { value } from "./value.js";

// state is the chosen image as a data URL
export function upload(opts: { accept?: string } = {}) {
  return value<string | null>("upload", null, { accept: opts.accept ?? "image/*" });
}
