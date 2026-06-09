import "./progress.css";
import type { ViewProps } from "../../view.js";

export function ProgressView({ state }: ViewProps<any, { value: number; label: string }>) {
  const pct = Math.round(Math.max(0, Math.min(1, state.value ?? 0)) * 100);
  return (
    <div className="pu-progress">
      <div className="pu-progress-track">
        <div className="pu-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pu-progress-label">{state.label || `${pct}%`}</span>
    </div>
  );
}
