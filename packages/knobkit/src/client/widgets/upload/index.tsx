import "./upload.css";
import type { ViewProps } from "../../view.js";
import type { UploadWidget, UploadFile } from "../../../lib/widgets/upload.js";

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

function readFile(f: File): Promise<UploadFile> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: f.name, type: f.type, size: f.size, url: String(r.result) });
    r.readAsDataURL(f);
  });
}

export function UploadView({ widget, state, emit, set }: ViewProps<UploadWidget, { files: UploadFile[] }>) {
  const files = state.files ?? [];
  const multiple = widget.multiple as boolean;
  const accept = widget.accept as string;

  const commit = (next: UploadFile[]) => {
    set(["files"], next);
    emit(widget.changed(next));
  };
  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const read = await Promise.all(Array.from(list).map(readFile));
    commit(multiple ? [...files, ...read] : read.slice(-1));
  };
  const remove = (i: number) => commit(files.filter((_, j) => j !== i));

  return (
    <div className="pu-upload">
      <label className="pu-upload-drop">
        <input
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            void add(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
        <span>{files.length === 0 ? "Choose a file…" : multiple ? "Add more files…" : "Choose another file"}</span>
      </label>
      {files.length > 0 && (
        <ul className="pu-upload-list">
          {files.map((f, i) => (
            <li className="pu-upload-item" key={`${f.name}-${i}`}>
              {f.type.startsWith("image/") ? (
                <img className="pu-upload-thumb" src={f.url} alt="" />
              ) : (
                <span className="pu-upload-glyph" aria-hidden="true">
                  📄
                </span>
              )}
              <span className="pu-upload-name" title={f.name}>
                {f.name}
              </span>
              <span className="pu-upload-size">{humanSize(f.size)}</span>
              <button
                type="button"
                className="pu-upload-remove"
                aria-label={`Remove ${f.name}`}
                onClick={() => remove(i)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
