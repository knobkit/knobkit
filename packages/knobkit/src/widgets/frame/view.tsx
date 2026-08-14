import "./frame.css";
import type { ViewProps } from "@knobkit/core/client";

export default function FrameView({ state }: ViewProps<{ src: string }>) {
  if (!state.src) return <div className="pu-frame pu-frame-empty">—</div>;
  return <iframe className="pu-frame" title="frame" src={state.src} />;
}
