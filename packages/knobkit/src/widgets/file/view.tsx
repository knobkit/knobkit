import { puFile, puFileEmpty, puFileIcon, puFileName } from "./file.css.js";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function FileView({ state }: ViewProps<{ name: string; url: MediaRef | string | null }>) {
  const url = state.url;
  if (!url) return <div className={puFileEmpty}>—</div>;
  return (
    <a className={puFile} href={typeof url === "string" ? url : mediaUrl(url)} download={state.name || true}>
      <span className={puFileIcon}>⭳</span>
      <span className={puFileName}>{state.name || "Download"}</span>
    </a>
  );
}
