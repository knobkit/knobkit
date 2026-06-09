import "./audio.css";
import type { ViewProps } from "../../view.js";

export function AudioView({ widget, state }: ViewProps<any, { src: string }>) {
  return state.src ? <audio src={state.src} controls autoPlay={Boolean(widget.autoplay)} /> : null;
}
