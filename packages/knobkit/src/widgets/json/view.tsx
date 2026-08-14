import "./json.css";
import type { ViewProps } from "@knobkit/core/client";

export default function JsonView({ state }: ViewProps<{ value: unknown }>) {
  return <pre className="pu-json">{JSON.stringify(state.value, null, 2)}</pre>;
}
