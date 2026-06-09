import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface GalleryItem {
  src: string; // URL or data URL
  caption?: string;
}

export interface GalleryWidget extends Widget<{ items: GalleryItem[] }> {
  set(items: GalleryItem[]): void; // replace the whole grid
  add(item: GalleryItem): void; // append one image
}

// A grid of images (the canonical output for batched image generation). Not a layout container — its
// `items` are image records, not child widget keys.
export function gallery(): GalleryWidget {
  return {
    type: "gallery",
    state: { items: [] },
    ...controls,
    set(items: GalleryItem[]): void {
      bound(this).edit(this, "set", ["items"], items);
    },
    add(item: GalleryItem): void {
      bound(this).edit(this, "append", ["items"], item);
    },
  };
}
