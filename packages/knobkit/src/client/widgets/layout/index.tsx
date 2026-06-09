import type { CSSProperties } from "react";
import type { ViewProps } from "../../view.js";

export function LayoutView({ widget, state, slot }: ViewProps<any, { items: string[] }>) {
  const dir = (widget.type as string) ?? "col";
  const items = state.items ?? [];
  const style: CSSProperties | undefined =
    dir === "grid" ? { gridTemplateColumns: `repeat(${(widget.cols as number) ?? 2}, minmax(0, 1fr))` } : undefined;
  return (
    <div className={`pu-layout pu-layout-${dir}`} style={style}>
      {items.map((key) => slot(key))}
    </div>
  );
}
