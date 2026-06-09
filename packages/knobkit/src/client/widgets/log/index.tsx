import type { ViewProps } from "../../view.js";

export function LogView({ state }: ViewProps<any, { lines: string[] }>) {
  return <pre className="pu-output">{state.lines.join("\n")}</pre>;
}
