import { puVideo, puVideoEmpty } from "./video.css.js";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function VideoView({
  props,
  state,
}: ViewProps<{ src: MediaRef | string | null }, { autoplay: boolean; loop: boolean }>) {
  const src = state.src;
  if (!src) return <div className={puVideoEmpty}>—</div>;
  return (
    <video
      className={puVideo}
      src={typeof src === "string" ? src : mediaUrl(src)}
      controls
      autoPlay={props.autoplay}
      loop={props.loop}
      muted={props.autoplay}
    />
  );
}
