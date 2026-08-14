import "./image.css";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function ImageView({ state }: ViewProps<{ src: MediaRef | string | null }>) {
  const src = state.src;
  if (!src) return <div className="pu-image-empty">—</div>;
  return <img className="pu-image" src={typeof src === "string" ? src : mediaUrl(src)} alt="" />;
}
