import "./gallery.css";
import type { ViewProps } from "../../view.js";
import type { GalleryItem } from "../../../lib/widgets/gallery.js";

export function GalleryView({ state }: ViewProps<any, { items: GalleryItem[] }>) {
  const items = state.items ?? [];
  if (items.length === 0) return <div className="pu-output">—</div>;
  return (
    <div className="pu-gallery">
      {items.map((it, i) => (
        <figure key={i} className="pu-gallery-cell">
          <img src={it.src} alt={it.caption ?? ""} />
          {it.caption && <figcaption>{it.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
