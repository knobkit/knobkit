import "./upload.css";
import { mediaUrl, toMedia } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

export default function UploadView({ props, state, emit, set }: ViewProps<{ value: MediaRef | null }, { label: string }>) {
  const ref = state.value;
  return (
    <div className="pu-upload">
      <label className="pu-upload-drop">
        <input
          type="file"
          hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (!f) return;
            // bytes go to the media store — only the ref rides in state and the event payload
            const picked = toMedia(f, f.type);
            set(["value"], picked);
            emit("picked", picked);
          }}
        />
        <span>{props.label || (ref ? "Choose another file…" : "Choose a file…")}</span>
      </label>
      {ref &&
        (ref.mime.startsWith("image/") ? (
          <img className="pu-image" src={mediaUrl(ref)} alt="" />
        ) : (
          <div className="pu-upload-file">{ref.mime}</div>
        ))}
    </div>
  );
}
