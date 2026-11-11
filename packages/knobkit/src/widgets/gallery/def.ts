import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export interface GalleryItem {
  src: MediaRef | string;
  caption?: string;
}

export const gallery = defineWidget({
  type: "gallery",
  state: {
    items: { initial: [] as GalleryItem[] },
    // the thumbnail the user clicked last, by index; null when none is
    selected: { initial: null as number | null },
  },
  events: {
    clicked: { payload: t<{ index: number; caption?: string }>() },
  },
  ops: (at) => ({
    set: at("items").op("set"),
    add: at("items").op("append"),
    select: at("selected").op("set"),
  }),
  methods: (self) => ({
    selected: () => self.at("selected").get(),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
