import type { ViewProps } from "@knobkit/core/client";
import { LayoutBase } from "./base.js";

export default function RowView(view: ViewProps<{ items: string[] }>) {
  return <LayoutBase dir="row" view={view} />;
}
