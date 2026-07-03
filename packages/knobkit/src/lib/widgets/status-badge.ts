import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export type StatusBadgeVariant = "idle" | "running" | "waiting" | "completed" | "failed" | "error";

export interface StatusBadgeState {
  variant: StatusBadgeVariant;
  label?: string;
}

export interface StatusBadgeWidget extends Widget<StatusBadgeState> {
  set(variant: StatusBadgeVariant, label?: string): void;
}

export function statusBadge(variant: StatusBadgeVariant = "idle", label?: string): StatusBadgeWidget {
  return {
    type: "statusBadge",
    state: { variant, label },
    ...controls,
    set(variant: StatusBadgeVariant, label?: string): void {
      const b = bound(this);
      b.edit(this, "set", ["variant"], variant);
      if (label !== undefined) b.edit(this, "set", ["label"], label);
    },
  };
}
