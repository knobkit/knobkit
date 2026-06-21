import "./split-pane.css";
import { useRef, useState, useCallback } from "react";
import type { ViewProps } from "../../view.js";
import type { SplitPaneWidget, SplitPaneState } from "../../../lib/widgets/split-pane.js";

export function SplitPaneView({ widget, state, slot }: ViewProps<SplitPaneWidget, SplitPaneState>) {
  const items = state.items ?? [];
  const direction = widget.direction ?? "horizontal";
  const isHorizontal = direction === "horizontal";
  const containerRef = useRef<HTMLDivElement>(null);
  const [localRatio, setLocalRatio] = useState<number | null>(null);
  const ratio = localRatio ?? state.ratio ?? 0.5;

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const onMouseMove = (ev: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        let r: number;
        if (isHorizontal) {
          r = (ev.clientX - rect.left) / rect.width;
        } else {
          r = (ev.clientY - rect.top) / rect.height;
        }
        r = Math.max(0.1, Math.min(0.9, r));
        setLocalRatio(r);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        setLocalRatio(null);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [isHorizontal],
  );

  const pctA = `${ratio * 100}%`;
  const pctB = `${(1 - ratio) * 100}%`;
  const template = `${pctA} 6px ${pctB}`;

  return (
    <div
      ref={containerRef}
      className={`pu-split-pane pu-split-pane--${direction}`}
      style={
        isHorizontal
          ? { gridTemplateColumns: template }
          : { gridTemplateRows: template }
      }
    >
      <div className="pu-split-pane-panel">{items[0] && slot(items[0])}</div>
      <div className="pu-split-pane-handle" onMouseDown={onMouseDown} />
      <div className="pu-split-pane-panel">{items[1] && slot(items[1])}</div>
    </div>
  );
}
