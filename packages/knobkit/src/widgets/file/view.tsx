import { puFile, puFileEmpty, puFileIcon, puFileName } from "./file.css.js";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function FileView({ state }: ViewProps<{ name: string; url: MediaRef | string | null }>) {
  const url = state.url;
  if (!url) return <div className={puFileEmpty}>—</div>;
  return (
    <a className={puFile} href={typeof url === "string" ? url : mediaUrl(url)} download={state.name || true}>
      {/* drawn, not a text character: the arrow glyph is in no system font */}
      <svg className={puFileIcon} viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2v8.5" />
        <path d="M4.5 7 8 10.5 11.5 7" />
        <path d="M3 13.5h10" />
      </svg>
      <span className={puFileName}>{state.name || "Download"}</span>
    </a>
  );
}
