import "./upload.css";
import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function UploadView({ widget, state, emit, set }: ViewProps<ValueWidget<string | null>, { value: string | null }>) {
  return (
    <div className="pu-upload">
      <label className="pu-upload-drop">
        <input
          type="file"
          hidden
          accept={widget.accept as string}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => {
              const url = String(r.result);
              set(["value"], url);
              emit(widget.changed(url));
            };
            r.readAsDataURL(f);
          }}
        />
        <span>{state.value ? "Choose another image" : "Choose an image…"}</span>
      </label>
      {state.value && <img className="pu-image" src={state.value} alt="" />}
    </div>
  );
}
