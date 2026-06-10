import "./annotated-image.css";
import { useState } from "react";
import type { ViewProps } from "../../view.js";
import type { Annotation } from "../../../lib/widgets/annotated-image.js";
import { seriesPalette, useThemeVersion } from "../../theme.js";

function colorFor(label: string, colorMap: Record<string, string>, palette: string[]): string {
  if (colorMap[label]) return colorMap[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export function AnnotatedImageView({
  state,
}: ViewProps<any, { src: string; annotations: Annotation[]; colorMap: Record<string, string> }>) {
  // The image's natural pixel size — only known once the <img> loads — turns the author's pixel boxes
  // into percentages of the (possibly resized) displayed image. Boxes wait for it.
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  useThemeVersion();
  const palette = seriesPalette();
  if (!state.src) return <div className="pu-output">—</div>;
  const annotations = state.annotations ?? [];
  const colorMap = state.colorMap ?? {};
  // Distinct labels for the legend, in first-seen order.
  const labels = [...new Set(annotations.map((a) => a.label))];
  return (
    <div className="pu-annimg">
      <div className="pu-annimg-frame">
        <img
          className="pu-annimg-base"
          src={state.src}
          alt=""
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        {nat &&
          annotations.map((a, i) => {
            const color = colorFor(a.label, colorMap, palette);
            return (
              <span key={i}>
                {a.mask && <img className="pu-annimg-mask" src={a.mask} alt="" />}
                {a.box && (
                  <span
                    className="pu-annimg-box"
                    style={{
                      left: `${(a.box[0] / nat.w) * 100}%`,
                      top: `${(a.box[1] / nat.h) * 100}%`,
                      width: `${((a.box[2] - a.box[0]) / nat.w) * 100}%`,
                      height: `${((a.box[3] - a.box[1]) / nat.h) * 100}%`,
                      borderColor: color,
                    }}
                  >
                    <span className="pu-annimg-tag" style={{ background: color }}>
                      {a.label}
                    </span>
                  </span>
                )}
              </span>
            );
          })}
      </div>
      {labels.length > 0 && (
        <div className="pu-annimg-legend">
          {labels.map((l) => (
            <span key={l} className="pu-annimg-chip">
              <span className="pu-annimg-swatch" style={{ background: colorFor(l, colorMap, palette) }} />
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
