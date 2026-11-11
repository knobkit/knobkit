import { puFolder, puFolderBar, puFolderChoose, puFolderEmpty, puFolderError, puFolderItem, puFolderList, puFolderPath, puFolderPick, puFolderPicked, puFolderUp } from "./folder-picker.css.js";
import { useEffect } from "react";
import { toMedia } from "@knobkit/core";
import { titleWhenCut } from "../_primitives/cut-title.js";
import type { ViewProps } from "@knobkit/core/client";
import type { FolderFile, FolderListing, PickedFolder } from "./def.js";

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

type State = { picked: PickedFolder | null; listing: FolderListing | null };
type Props = { root: string; label: string; server: boolean };

const FolderIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.75 4.25v8a1 1 0 0 0 1 1h10.5a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H8L6.5 3.25H2.75a1 1 0 0 0-1 1Z" />
  </svg>
);

/** Browser-only: the system's folder chooser. It hands over the folder's files, not its path. */
function Chooser({ props, state, emit, set }: ViewProps<State, Props>) {
  const picked = state.picked;
  const take = (list: FileList | null): void => {
    if (!list || list.length === 0) return;
    const all = Array.from(list);
    // every file's webkitRelativePath starts with the picked folder's own name
    const name = all[0]!.webkitRelativePath.split("/")[0] ?? "";
    const files: FolderFile[] = all.map((f) => ({
      path: f.webkitRelativePath.split("/").slice(1).join("/") || f.name,
      size: f.size,
      ref: toMedia(f, f.type || "application/octet-stream"),
    }));
    const next: PickedFolder = { name, path: "", files };
    set(["picked"], next);
    emit("picked", next);
  };
  return (
    <div className={puFolder}>
      <label className={puFolderPick}>
        <input
          type="file"
          hidden
          multiple
          {...({ webkitdirectory: "" } as object)}
          onChange={(e) => {
            take(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
        <FolderIcon />
        <span>{props.label || (picked ? "Choose another folder…" : "Choose a folder…")}</span>
      </label>
      {picked && (
        <div className={puFolderPicked}>
          {picked.name} — {picked.files.length} {picked.files.length === 1 ? "file" : "files"}, {humanSize(picked.files.reduce((a, f) => a + f.size, 0))}
        </div>
      )}
    </div>
  );
}

/** Served: the folders of the server's machine, from the starting folder down. */
function Browser({ props, state, emit }: ViewProps<State, Props>) {
  const listing = state.listing;
  useEffect(() => {
    if (!listing) emit("browse", { path: "" });
    // asked once, when first shown; after that the list changes as the user opens folders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!listing) return <div className={puFolderEmpty}>…</div>;
  const atStart = listing.path === "";
  const parent = listing.path.split("/").slice(0, -1).join("/");
  const open = (path: string): void => void emit("browse", { path });
  return (
    <div className={puFolder}>
      <div className={puFolderBar}>
        <button type="button" className={puFolderUp} disabled={atStart} aria-label="Up to the folder above" onClick={() => open(parent)}>
          ↑
        </button>
        <span className={puFolderPath} onMouseEnter={(e) => titleWhenCut(e.currentTarget)}>
          {listing.path ? `${listing.start}/${listing.path}` : listing.start}
        </span>
        <button type="button" className={puFolderChoose} onClick={() => emit("choose", { path: listing.path })}>
          {props.label || "Choose this folder"}
        </button>
      </div>
      {listing.error && <div className={puFolderError}>{listing.error}</div>}
      {listing.folders.length === 0 ? (
        <div className={puFolderEmpty}>No folders here</div>
      ) : (
        <ul className={puFolderList}>
          {listing.folders.map((name) => (
            <li key={name}>
              <button type="button" className={puFolderItem} onClick={() => open(listing.path ? `${listing.path}/${name}` : name)}>
                <FolderIcon />
                <span>{name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.picked && <div className={puFolderPicked}>{state.picked.path}</div>}
    </div>
  );
}

export default function FolderPickerView(v: ViewProps<State, Props>) {
  return v.props.server ? <Browser {...v} /> : <Chooser {...v} />;
}
