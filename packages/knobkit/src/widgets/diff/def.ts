import { defineWidget, viewRef } from "@knobkit/core";

export interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  language?: string;
  status?: "added" | "modified" | "deleted" | "renamed";
}

export const diff = defineWidget({
  type: "diff",
  state: { files: { initial: [] as FileDiff[] } },
  ops: (at) => ({ setFiles: at("files").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
