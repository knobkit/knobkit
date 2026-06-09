import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface FileWidget extends Widget<{ name: string; url: string }> {
  // Offer a file for download — the output counterpart to `upload`. Pass a URL (or data URL) and an
  // optional display name; the name defaults to the URL's last path segment.
  set(value: { name?: string; url: string } | string): void;
}

export function file(): FileWidget {
  return {
    type: "file",
    state: { name: "", url: "" },
    ...controls,
    set(value: { name?: string; url: string } | string): void {
      const v = typeof value === "string" ? { url: value } : value;
      const b = bound(this);
      b.edit(this, "set", ["url"], v.url);
      b.edit(this, "set", ["name"], v.name ?? v.url.split("/").pop()?.split("?")[0] ?? "download");
    },
  };
}
