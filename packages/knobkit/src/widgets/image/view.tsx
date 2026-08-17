import { puImage } from "../_primitives/media.css.js";
import { puImageEmpty } from "./image.css.js";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function ImageView({ state }: ViewProps<{ src: MediaRef | string | null }>) {
  const src = state.src;
  if (!src) return <div className={puImageEmpty}>—</div>;
  return <img className={puImage} src={typeof src === "string" ? src : mediaUrl(src)} alt="" />;
}
