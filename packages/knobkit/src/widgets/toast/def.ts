import { defineWidget, viewRef } from "@knobkit/core";

export interface Toast {
  key: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
}

export const toast = defineWidget({
  type: "toast",
  state: { items: { initial: [] as Toast[] } },
  methods: (self) => ({
    // a method, not an op: it mints the key and defaults the variant
    show: (message: string, variant: Toast["variant"] = "info") =>
      self.at("items").append({ key: Date.now() + "_" + Math.random().toString(36).slice(2), message, variant }),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
