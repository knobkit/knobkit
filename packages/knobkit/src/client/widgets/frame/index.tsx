import "./frame.css";
import type { ViewProps } from "../../view.js";

export function FrameView({ widget, state, emit }: ViewProps<any, { src: string; doc: string }>) {
  const { src, doc } = state;
  if (!src && !doc) return <div className="pu-frame pu-frame-empty">—</div>;
  const onLoad = () => emit((widget.loaded as () => { type: string; payload: unknown })());
  const sandbox = widget.sandbox as string | undefined;
  const title = widget.title as string;
  return doc ? (
    <iframe className="pu-frame" title={title} sandbox={sandbox} srcDoc={doc} onLoad={onLoad} />
  ) : (
    <iframe className="pu-frame" title={title} sandbox={sandbox} src={src} onLoad={onLoad} />
  );
}
