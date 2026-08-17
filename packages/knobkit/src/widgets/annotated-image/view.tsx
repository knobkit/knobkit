import { puAnnimg, puAnnimgBase, puAnnimgBox, puAnnimgChip, puAnnimgEmpty, puAnnimgFrame, puAnnimgLegend, puAnnimgMask, puAnnimgSwatch, puAnnimgTag } from "./annotated-image.css.js";
import { useState } from "react";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import { seriesPalette, useThemeVersion } from "@knobkit/core/client";
import type { ViewProps } from "@knobkit/core/client";
import type { Annotation } from "./def.js";

function url(src: MediaRef | string): string {
  return typeof src === "string" ? src : mediaUrl(src);
}

function colorFor(label: string, colorMap: Record<string, string>, palette: string[]): string {
  if (colorMap[label]) return colorMap[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export default function AnnotatedImageView({
  state,
}: ViewProps<{ src: MediaRef | string | null; annotations: Annotation[]; colorMap: Record<string, string> }>) {
  // The image's natural pixel size — only known once the <img> loads — turns the author's pixel boxes
  // into percentages of the (possibly resized) displayed image. Boxes wait for it.
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  useThemeVersion();
  const palette = seriesPalette();
  if (!state.src) return <div className={puAnnimgEmpty}>—</div>;
  const annotations = state.annotations ?? [];
  const colorMap = state.colorMap ?? {};
  const labels = [...new Set(annotations.map((a) => a.label))];
  return (
    <div className={puAnnimg}>
      <div className={puAnnimgFrame}>
        <img
          className={puAnnimgBase}
          src={url(state.src)}
          alt=""
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        {nat &&
          annotations.map((a, i) => {
            const color = colorFor(a.label, colorMap, palette);
            return (
              <span key={i}>
                {a.mask && <img className={puAnnimgMask} src={url(a.mask)} alt="" />}
                {a.box && (
                  <span
                    className={puAnnimgBox}
                    style={{
                      left: `${(a.box[0] / nat.w) * 100}%`,
                      top: `${(a.box[1] / nat.h) * 100}%`,
                      width: `${((a.box[2] - a.box[0]) / nat.w) * 100}%`,
                      height: `${((a.box[3] - a.box[1]) / nat.h) * 100}%`,
                      borderColor: color,
                    }}
                  >
                    <span className={puAnnimgTag} style={{ background: color }}>
                      {a.label}
                    </span>
                  </span>
                )}
              </span>
            );
          })}
      </div>
      {labels.length > 0 && (
        <div className={puAnnimgLegend}>
          {labels.map((l) => (
            <span key={l} className={puAnnimgChip}>
              <span className={puAnnimgSwatch} style={{ background: colorFor(l, colorMap, palette) }} />
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
