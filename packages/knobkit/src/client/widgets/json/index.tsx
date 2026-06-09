import type { ViewProps } from "../../view.js";

export function JsonView({ state }: ViewProps<any, { value: unknown }>) {
  return <pre className="pu-output">{JSON.stringify(state.value, null, 2)}</pre>;
}
