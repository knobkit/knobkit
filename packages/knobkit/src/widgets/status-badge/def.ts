import { defineWidget, viewRef } from "@knobkit/core";

/** The visual variants the view can render (dot color / pulse). */
export type StatusBadgeVariant = "idle" | "running" | "waiting" | "completed" | "failed" | "error";

const statusBadgeDef = defineWidget({
  type: "statusBadge",
  state: { status: { initial: "idle" } },
  // maps a status string to a visual variant; a status that already names a variant needs no entry
  props: { variants: { default: {} as Record<string, StatusBadgeVariant> } },
  ops: (at) => ({ set: at("status").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const statusBadge = (status = "idle", opts: { variants?: Record<string, StatusBadgeVariant> } = {}) =>
  statusBadgeDef({ status, variants: opts.variants });
