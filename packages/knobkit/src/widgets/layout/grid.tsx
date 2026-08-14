import type { ViewProps } from "@knobkit/core/client";
import { LayoutBase } from "./base.js";

export default function GridView(view: ViewProps<{ items: string[] }, { cols: number }>) {
  return (
    <LayoutBase
      dir="grid"
      view={view}
      style={{ gridTemplateColumns: `repeat(${view.props.cols ?? 2}, minmax(0, 1fr))` }}
    />
  );
}
