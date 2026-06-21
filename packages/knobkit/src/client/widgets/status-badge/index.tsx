import "./status-badge.css";
import type { ViewProps } from "../../view.js";
import type { StatusBadgeWidget, StatusBadgeState } from "../../../lib/widgets/status-badge.js";

export function StatusBadgeView({ state }: ViewProps<StatusBadgeWidget, StatusBadgeState>) {
  const variant = state.variant ?? "idle";
  return (
    <span className={`pu-status-badge pu-status-badge--${variant}`}>
      <span className="pu-status-badge-dot" />
      {state.label && <span className="pu-status-badge-label">{state.label}</span>}
    </span>
  );
}
