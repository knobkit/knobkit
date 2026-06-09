import "./video.css";
import type { ViewProps } from "../../view.js";

export function VideoView({ widget, state }: ViewProps<any, { src: string }>) {
  return state.src ? (
    <video src={state.src} controls autoPlay={Boolean(widget.autoplay)} loop={Boolean(widget.loop)} muted={Boolean(widget.autoplay)} />
  ) : (
    <div className="pu-output">—</div>
  );
}
