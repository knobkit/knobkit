import type { ViewProps } from "../../view.js";

export function ImageView({ state }: ViewProps<any, { src: string }>) {
  return state.src ? <img className="pu-image" src={state.src} alt="" /> : <div className="pu-output">—</div>;
}
