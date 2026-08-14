import type { ViewProps } from "@knobkit/core/client";
import { LayoutBase } from "./base.js";

export default function ColView(view: ViewProps<{ items: string[] }>) {
  return <LayoutBase dir="col" view={view} />;
}
