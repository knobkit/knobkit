import "./video.css";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function VideoView({
  props,
  state,
}: ViewProps<{ src: MediaRef | string | null }, { autoplay: boolean; loop: boolean }>) {
  const src = state.src;
  if (!src) return <div className="pu-video-empty">—</div>;
  return (
    <video
      className="pu-video"
      src={typeof src === "string" ? src : mediaUrl(src)}
      controls
      autoPlay={props.autoplay}
      loop={props.loop}
      muted={props.autoplay}
    />
  );
}
