import { defineWidget, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export interface GalleryItem {
  src: MediaRef | string;
  caption?: string;
}

export const gallery = defineWidget({
  type: "gallery",
  state: { items: { initial: [] as GalleryItem[] } },
  ops: (at) => ({
    set: at("items").op("set"),
    add: at("items").op("append"),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
