import "./file.css";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function FileView({ state }: ViewProps<{ name: string; url: MediaRef | string | null }>) {
  const url = state.url;
  if (!url) return <div className="pu-file-empty">—</div>;
  return (
    <a className="pu-file" href={typeof url === "string" ? url : mediaUrl(url)} download={state.name || true}>
      <span className="pu-file-icon">⭳</span>
      <span className="pu-file-name">{state.name || "Download"}</span>
    </a>
  );
}
