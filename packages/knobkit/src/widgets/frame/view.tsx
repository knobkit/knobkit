import { puFrame, puFrameEmpty } from "./frame.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function FrameView({ state }: ViewProps<{ src: string }>) {
  if (!state.src) return <div className={`${puFrame} ${puFrameEmpty}`}>—</div>;
  return <iframe className={puFrame} title="frame" src={state.src} />;
}
