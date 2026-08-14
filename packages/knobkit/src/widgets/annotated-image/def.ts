import { defineWidget, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export interface Annotation {
  label: string;
  /** [xmin, ymin, xmax, ymax] in pixels of the image's natural size — what detection models emit; the view scales to the displayed size */
  box?: [number, number, number, number];
  /** full-size mask image overlaid for this region (segmentation) */
  mask?: MediaRef | string;
}

export const annotatedImage = defineWidget({
  type: "annotatedImage",
  state: {
    src: { initial: null as MediaRef | string | null },
    annotations: { initial: [] as Annotation[] },
    colorMap: { initial: {} as Record<string, string> },
  },
  methods: (self) => ({
    set: (src: MediaRef | string, annotations?: Annotation[], colorMap?: Record<string, string>) =>
      self
        .at()
        .patch(
          colorMap === undefined
            ? { src, annotations: annotations ?? [] }
            : { src, annotations: annotations ?? [], colorMap },
        ),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
