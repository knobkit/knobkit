import { defineWidget, isMediaRef, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export const file = defineWidget({
  type: "file",
  state: { name: { initial: "" }, url: { initial: null as MediaRef | string | null } },
  methods: (self) => ({
    // Offer a file for download — the output counterpart to `upload`. Pass a URL, data URL, or
    // MediaRef, with an optional display name; the name defaults to the URL's last path segment.
    set(value: { name?: string; url: MediaRef | string } | MediaRef | string): void {
      const v = typeof value === "string" || isMediaRef(value) ? { url: value } : value;
      const name =
        v.name ?? (typeof v.url === "string" ? (v.url.split("/").pop()?.split("?")[0] ?? "download") : "download");
      self.at().patch({ url: v.url, name });
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
