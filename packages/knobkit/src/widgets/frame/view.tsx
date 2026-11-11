import { puFrame, puFrameAddress, puFrameBar, puFrameBox, puFrameEmpty, puFrameOpen, puFrameRefused } from "./frame.css.js";
import { useEffect, useRef } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { EmbedStatus } from "./def.js";

// an arrow leaving a box: "opens elsewhere"
function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 3.5h-3v9h9v-3" />
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5 7.5 8.5" />
    </svg>
  );
}

export default function FrameView({ state, emit }: ViewProps<{ src: string; reloads: number; embed: EmbedStatus }>) {
  const page = useRef<HTMLIFrameElement>(null);
  const { src } = state;
  const embed = state.embed ?? "unknown";
  const reloads = state.reloads ?? 0;
  const seen = useRef(reloads);
  useEffect(() => {
    if (reloads === seen.current) return;
    seen.current = reloads;
    // assigning the address it already has is what navigates an embedded page again; its own
    // reload() is out of reach when the page is from another site
    if (page.current) page.current.src = src;
  }, [reloads, src]);

  // The browser says "loaded" for a page that refused to be embedded too. Where the server is
  // asking the site, that answer is waited for, and a refusal is not reported as a load.
  const arrived = useRef<string | null>(null);
  const report = (): void => {
    if (arrived.current !== src || embed === "checking" || embed === "refused") return;
    arrived.current = null;
    emit("loaded", { src });
  };
  useEffect(report);

  if (!src) return <div className={`${puFrame} ${puFrameEmpty}`}>—</div>;
  return (
    <div className={puFrameBox}>
      <div className={puFrameBar}>
        <span className={puFrameAddress}>{src}</span>
        <a className={puFrameOpen} href={src} target="_blank" rel="noopener noreferrer" title="Open in a new window" aria-label="Open in a new window">
          <OpenIcon />
        </a>
      </div>
      {embed === "refused" ? (
        <div className={`${puFrame} ${puFrameRefused}`} role="status">
          <p>This site does not allow being shown inside another page.</p>
          <a href={src} target="_blank" rel="noopener noreferrer">
            Open it in a new window
          </a>
        </div>
      ) : (
        <iframe
          ref={page}
          className={puFrame}
          title="frame"
          src={src}
          onLoad={() => {
            arrived.current = src;
            report();
          }}
        />
      )}
    </div>
  );
}
