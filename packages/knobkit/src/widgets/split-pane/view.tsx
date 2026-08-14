import "./split-pane.css";
import { useCallback, useRef } from "react";
import type { ViewProps } from "@knobkit/core/client";

export default function SplitPaneView({ props, state, set, slot }: ViewProps<{ items: string[]; ratio: number }, { direction: string }>) {
  const items = state.items ?? [];
  const isHorizontal = props.direction !== "vertical";
  const containerRef = useRef<HTMLDivElement>(null);
  const ratio = state.ratio ?? 0.5;

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const onMouseMove = (ev: MouseEvent): void => {
        const rect = container.getBoundingClientRect();
        const r = isHorizontal ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
        set(["ratio"], Math.max(0.1, Math.min(0.9, r))); // local edit — no round-trip while dragging
      };
      const onMouseUp = (): void => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [isHorizontal, set],
  );

  const template = `${ratio * 100}% 6px ${(1 - ratio) * 100}%`;
  return (
    <div
      ref={containerRef}
      className={`pu-split-pane pu-split-pane--${isHorizontal ? "horizontal" : "vertical"}`}
      style={isHorizontal ? { gridTemplateColumns: template } : { gridTemplateRows: template }}
    >
      <div className="pu-split-pane-panel">{items[0] && slot(items[0])}</div>
      <div className="pu-split-pane-handle" onMouseDown={onMouseDown} />
      <div className="pu-split-pane-panel">{items[1] && slot(items[1])}</div>
    </div>
  );
}
