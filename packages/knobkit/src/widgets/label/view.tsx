import { puLabel, puLabelBar, puLabelEmpty, puLabelName, puLabelRow, puLabelScore, puLabelTop } from "./label.css.js";
import type { ViewProps } from "@knobkit/core/client";
import type { LabelClass } from "./def.js";

export default function LabelView({ state }: ViewProps<{ label: string; confidences: LabelClass[] }>) {
  const confidences = [...(state.confidences ?? [])].sort((a, b) => b.score - a.score);
  if (!state.label && confidences.length === 0) return <div className={puLabelEmpty}>—</div>;
  return (
    <div className={puLabel}>
      {state.label && <div className={puLabelTop}>{state.label}</div>}
      {confidences.map((c) => (
        <div key={c.label} className={puLabelRow}>
          <div className={puLabelBar} style={{ width: `${Math.round(Math.max(0, Math.min(1, c.score)) * 100)}%` }} />
          <span className={puLabelName}>{c.label}</span>
          <span className={puLabelScore}>{(c.score * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
