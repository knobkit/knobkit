import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface Annotation {
  label: string;
  // A bounding box as [xmin, ymin, xmax, ymax] in pixels of the image's natural size — the format
  // detection models emit (and what gr.AnnotatedImage takes). The view divides by the loaded image's
  // natural width/height to place it, so any displayed size works.
  box?: [number, number, number, number];
  // Optionally, a full-size mask image (URL or data URL) overlaid for this region (segmentation).
  mask?: string;
}

export interface AnnotatedImageWidget
  extends Widget<{ src: string; annotations: Annotation[]; colorMap: Record<string, string> }> {
  // A base image with labeled regions on top: the standard output for detection / segmentation.
  // `colorMap` pins a color per label; unmapped labels get a stable auto color in the view.
  set(src: string, annotations?: Annotation[], colorMap?: Record<string, string>): void;
}

export function annotatedImage(): AnnotatedImageWidget {
  return {
    type: "annotatedImage",
    state: { src: "", annotations: [], colorMap: {} },
    ...controls,
    set(src: string, annotations?: Annotation[], colorMap?: Record<string, string>): void {
      const b = bound(this);
      if (colorMap !== undefined) b.edit(this, "set", ["colorMap"], colorMap);
      b.edit(this, "set", ["annotations"], annotations ?? []);
      b.edit(this, "set", ["src"], src);
    },
  };
}
