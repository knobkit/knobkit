import "./audio.css";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function AudioView({ props, state }: ViewProps<{ src: MediaRef | string | null }, { autoplay: boolean }>) {
  const src = state.src;
  if (!src) return null;
  return <audio src={typeof src === "string" ? src : mediaUrl(src)} controls autoPlay={props.autoplay} />;
}
