import { puJson } from "./json.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function JsonView({ state }: ViewProps<{ value: unknown }>) {
  return <pre className={puJson}>{JSON.stringify(state.value, null, 2)}</pre>;
}
