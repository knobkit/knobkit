import "./status-badge.css";
import type { ViewProps } from "@knobkit/core/client";
import type { StatusBadgeVariant } from "./def.js";

const VARIANTS = new Set(["idle", "running", "waiting", "completed", "failed", "error"]);

export default function StatusBadgeView({ props, state }: ViewProps<{ status: string }, { variants: Record<string, StatusBadgeVariant> }>) {
  const status = state.status || "idle";
  const variant = props.variants[status] ?? (VARIANTS.has(status) ? status : "idle");
  return (
    <span className={`pu-status-badge pu-status-badge--${variant}`}>
      <span className="pu-status-badge-dot" />
      <span className="pu-status-badge-label">{status}</span>
    </span>
  );
}
