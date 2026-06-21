import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface DiffFile {
  path: string;
  oldContent: string;
  newContent: string;
  language?: string;
  status?: "added" | "modified" | "deleted" | "renamed";
}

export interface DiffState {
  files: DiffFile[];
  mode: "unified" | "split";
  activeFile: number;
}

export interface DiffWidget extends Widget<DiffState> {
  accepted: EventCtor<{ file: number }>;
  rejected: EventCtor<{ file: number }>;
  fileSelected: EventCtor<{ file: number }>;
  setFiles(files: DiffFile[]): void;
  addFile(file: DiffFile): void;
  setMode(mode: "unified" | "split"): void;
  setActiveFile(index: number): void;
  clear(): void;
}

export function diff(opts?: { mode?: "unified" | "split" }): DiffWidget {
  return {
    type: "diff",
    state: { files: [], mode: opts?.mode ?? "unified", activeFile: 0 },
    accepted: event<{ file: number }>("diff.accepted"),
    rejected: event<{ file: number }>("diff.rejected"),
    fileSelected: event<{ file: number }>("diff.fileSelected"),
    ...controls,
    setFiles(files: DiffFile[]): void {
      const rt = bound(this);
      rt.edit(this, "set", ["files"], files);
      rt.edit(this, "set", ["activeFile"], 0);
    },
    addFile(file: DiffFile): void {
      bound(this).edit(this, "append", ["files"], file);
    },
    setMode(mode: "unified" | "split"): void {
      bound(this).edit(this, "set", ["mode"], mode);
    },
    setActiveFile(index: number): void {
      bound(this).edit(this, "set", ["activeFile"], index);
    },
    clear(): void {
      const rt = bound(this);
      rt.edit(this, "set", ["files"], []);
      rt.edit(this, "set", ["activeFile"], 0);
    },
  };
}
