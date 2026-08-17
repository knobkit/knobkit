import { puProgress, puProgressFill, puProgressLabel, puProgressTrack } from "./progress.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function ProgressView({ state }: ViewProps<{ value: number; label: string }>) {
  const pct = Math.round(Math.max(0, Math.min(1, state.value ?? 0)) * 100);
  return (
    <div className={puProgress}>
      <div className={puProgressTrack}>
        <div className={puProgressFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={puProgressLabel}>{state.label || `${pct}%`}</span>
    </div>
  );
}
