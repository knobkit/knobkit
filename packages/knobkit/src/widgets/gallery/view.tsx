import { puGallery, puGalleryCell, puGalleryEmpty, puGallerySelected } from "./gallery.css.js";
import { mediaUrl } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import type { GalleryItem } from "./def.js";

export default function GalleryView({ state, emit, set }: ViewProps<{ items: GalleryItem[]; selected: number | null }>) {
  const items = state.items ?? [];
  if (items.length === 0) return <div className={puGalleryEmpty}>—</div>;
  const pick = (i: number): void => {
    set(["selected"], i);
    const caption = items[i]?.caption;
    emit("clicked", caption === undefined ? { index: i } : { index: i, caption });
  };
  return (
    <div className={puGallery}>
      {items.map((it, i) => (
        <figure
          key={i}
          className={state.selected === i ? `${puGalleryCell} ${puGallerySelected}` : puGalleryCell}
          role="button"
          tabIndex={0}
          aria-pressed={state.selected === i}
          onClick={() => pick(i)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            pick(i);
          }}
        >
          <img src={typeof it.src === "string" ? it.src : mediaUrl(it.src)} alt={it.caption ?? ""} />
          {it.caption && <figcaption>{it.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
