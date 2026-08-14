import type { CSSProperties } from "react";
import type { ViewProps } from "@knobkit/core/client";

export function LayoutBase({ dir, view, style }: { dir: string; view: ViewProps<{ items: string[] }>; style?: CSSProperties }) {
  return (
    <div className={`pu-layout pu-layout-${dir}`} style={style}>
      {(view.state.items ?? []).map((id) => view.slot(id))}
    </div>
  );
}
