import "./file.css";
import type { ViewProps } from "../../view.js";

export function FileView({ state }: ViewProps<any, { name: string; url: string }>) {
  if (!state.url) return <div className="pu-output">—</div>;
  return (
    <a className="pu-file" href={state.url} download={state.name || true}>
      <span className="pu-file-icon">⭳</span>
      <span className="pu-file-name">{state.name || "Download"}</span>
    </a>
  );
}
