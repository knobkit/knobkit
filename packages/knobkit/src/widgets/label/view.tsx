import "./label.css";
import type { ViewProps } from "@knobkit/core/client";
import type { LabelClass } from "./def.js";

export default function LabelView({ state }: ViewProps<{ label: string; confidences: LabelClass[] }>) {
  const confidences = [...(state.confidences ?? [])].sort((a, b) => b.score - a.score);
  if (!state.label && confidences.length === 0) return <div className="pu-label-empty">—</div>;
  return (
    <div className="pu-label">
      {state.label && <div className="pu-label-top">{state.label}</div>}
      {confidences.map((c) => (
        <div key={c.label} className="pu-label-row">
          <div className="pu-label-bar" style={{ width: `${Math.round(Math.max(0, Math.min(1, c.score)) * 100)}%` }} />
          <span className="pu-label-name">{c.label}</span>
          <span className="pu-label-score">{(c.score * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
