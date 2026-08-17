import { puGallery, puGalleryCell, puGalleryEmpty } from "./gallery.css.js";
import { mediaUrl } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import type { GalleryItem } from "./def.js";

export default function GalleryView({ state }: ViewProps<{ items: GalleryItem[] }>) {
  const items = state.items ?? [];
  if (items.length === 0) return <div className={puGalleryEmpty}>—</div>;
  return (
    <div className={puGallery}>
      {items.map((it, i) => (
        <figure key={i} className={puGalleryCell}>
          <img src={typeof it.src === "string" ? it.src : mediaUrl(it.src)} alt={it.caption ?? ""} />
          {it.caption && <figcaption>{it.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
