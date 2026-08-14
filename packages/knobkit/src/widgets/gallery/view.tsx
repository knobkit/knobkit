import "./gallery.css";
import { mediaUrl } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import type { GalleryItem } from "./def.js";

export default function GalleryView({ state }: ViewProps<{ items: GalleryItem[] }>) {
  const items = state.items ?? [];
  if (items.length === 0) return <div className="pu-gallery-empty">—</div>;
  return (
    <div className="pu-gallery">
      {items.map((it, i) => (
        <figure key={i} className="pu-gallery-cell">
          <img src={typeof it.src === "string" ? it.src : mediaUrl(it.src)} alt={it.caption ?? ""} />
          {it.caption && <figcaption>{it.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
