import { puFrame, puFrameEmpty } from "./frame.css.js";
import { useEffect, useRef } from "react";
import type { ViewProps } from "@knobkit/core/client";

export default function FrameView({ state }: ViewProps<{ src: string; reloads: number }>) {
  const page = useRef<HTMLIFrameElement>(null);
  const reloads = state.reloads ?? 0;
  const seen = useRef(reloads);
  useEffect(() => {
    if (reloads === seen.current) return;
    seen.current = reloads;
    // assigning the address it already has is what navigates an embedded page again; its own
    // reload() is out of reach when the page is from another site
    if (page.current) page.current.src = state.src;
  }, [reloads, state.src]);

  if (!state.src) return <div className={`${puFrame} ${puFrameEmpty}`}>—</div>;
  return <iframe ref={page} className={puFrame} title="frame" src={state.src} />;
}
