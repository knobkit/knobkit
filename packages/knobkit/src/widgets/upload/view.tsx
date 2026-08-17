import { puImage } from "../_primitives/media.css.js";
import { puUpload, puUploadDrop, puUploadGlyph, puUploadItem, puUploadList, puUploadName, puUploadRemove, puUploadSize, puUploadThumb } from "./upload.css.js";
import { mediaUrl, toMedia } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import type { UploadFile } from "./def.js";

const UNITS = ["B", "KB", "MB", "GB"];
function humanSize(bytes: number): string {
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < UNITS.length - 1) {
    n /= 1024;
    u++;
  }
  return `${u === 0 ? n : n.toFixed(1)} ${UNITS[u]}`;
}

export default function UploadView({
  props,
  state,
  emit,
  set,
}: ViewProps<{ files: UploadFile[] }, { accept: string; multiple: boolean; label: string }>) {
  const files = state.files ?? [];

  const commit = (next: UploadFile[]) => {
    set(["files"], next);
    emit("changed", next);
  };
  const add = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const picked = Array.from(list).map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      ref: toMedia(f, f.type),
    }));
    for (const p of picked) emit("picked", p.ref);
    commit(props.multiple ? [...files, ...picked] : picked.slice(-1));
  };
  const remove = (i: number) => commit(files.filter((_, j) => j !== i));

  const single = !props.multiple && files.length === 1 ? files[0] : null;

  return (
    <div className={puUpload}>
      <label className={puUploadDrop}>
        <input
          type="file"
          hidden
          accept={props.accept}
          multiple={props.multiple}
          onChange={(e) => {
            add(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
        <span>
          {props.label ||
            (files.length === 0 ? "Choose a file…" : props.multiple ? "Add more files…" : "Choose another file…")}
        </span>
      </label>
      {files.length > 0 && (
        <ul className={puUploadList}>
          {files.map((f, i) => (
            <li className={puUploadItem} key={`${f.name}-${i}`}>
              {f.type.startsWith("image/") ? (
                <img className={puUploadThumb} src={mediaUrl(f.ref)} alt="" />
              ) : (
                <span className={puUploadGlyph} aria-hidden="true">
                  📄
                </span>
              )}
              <span className={puUploadName} title={f.name}>
                {f.name}
              </span>
              <span className={puUploadSize}>{humanSize(f.size)}</span>
              <button
                type="button"
                className={puUploadRemove}
                aria-label={`Remove ${f.name}`}
                onClick={() => remove(i)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {single && single.type.startsWith("image/") && (
        <img className={puImage} src={mediaUrl(single.ref)} alt={single.name} />
      )}
    </div>
  );
}
